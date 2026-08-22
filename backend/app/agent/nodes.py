"""
Node implementations per TRD_Supply_Chain_Disruption_Agent_v2.md §4.

Deterministic nodes (impact_analysis, verify_claim, score_candidates,
constraint_validation, decision_gate) import the Phase 2 services directly and
never call the LLM — same principle as the original constraint-engine design:
the LLM chooses among validated options and explains, it never decides
pass/fail itself.
"""
import json
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.agent.state import MAX_REPLANS, AgentState
from app.agent.tools import (
    _check_tracking,
    _get_inventory_status,
    _get_production_schedule,
    _get_purchase_order,
    _update_erp,
)
from app.db.models import Decision, DisruptionEvent, PurchaseOrder, SupplierTrustEvent
from app.services.claim_verification import verify_claim
from app.services.constraints import SupplierCandidate, validate_all_candidates, validate_plan_cost
from app.services.coverage import Component, ProductionOrder, compute_coverage
from app.services.hashing import append_entry
from app.services.prioritization import find_deprioritizable_orders
from app.services.supplier_scoring import build_recovery_plan, rank_candidates, score_candidate


def _record_trust_event(session: Session, po_id: str, claim: str | None, tracking_status: str) -> None:
    """Writes a persistent SupplierTrustEvent — independent of whether this
    supplier later shows up as a scored candidate. Looks up the actual
    supplier via the PO, since the tracking_events table itself doesn't
    store who made the claim."""
    po = session.query(PurchaseOrder).filter_by(po_id=po_id).first()
    if not po:
        return  # no PO to attribute the claim to — nothing to record
    event = SupplierTrustEvent(
        supplier_id=po.supplier_id,
        po_id=po_id,
        decision_id=None,  # filled in later if this run produces a decision; not required for the record to be useful
        event_type="claim_contradicted",
        details=f"Claimed '{claim}' but tracking showed '{tracking_status}'",
    )
    session.add(event)
    session.commit()


def node_impact_analysis(state: AgentState, session: Session, today: date) -> AgentState:
    """Deterministic. TRD v2 §4: coverage.py vs. deadline -> coverage_days,
    shortfall_units, computed_risk."""
    inventory = _get_inventory_status(session, state["affected_component_id"])
    if "error" in inventory:
        state["reasoning_trace"].append(f"impact_analysis: {inventory['error']}")
        state["computed_risk"] = "Critical"
        state["requires_approval"] = True
        state["approval_reason"] = "Unable to locate component — manual review required"
        return state

    prod_rows = _get_production_schedule(session, state["affected_component_id"])
    prod_row = next(
        (p for p in prod_rows if p["production_order_id"] == state["affected_production_order_id"]),
        prod_rows[0] if prod_rows else None,
    )
    if prod_row is None:
        state["reasoning_trace"].append("impact_analysis: no production order found for this component")
        state["computed_risk"] = "Low"
        return state

    component = Component(
        component_id=inventory["component_id"],
        usable_stock=inventory["usable_stock"],
        daily_usage=inventory["daily_usage"],
        safety_stock=inventory["safety_stock"],
        quality_threshold=inventory["quality_threshold"],
    )
    production_order = ProductionOrder(
        production_order_id=prod_row["production_order_id"],
        required_component=state["affected_component_id"],
        units_planned=prod_row["units_planned"],
        component_required_per_unit=prod_row["component_required_per_unit"],
        deadline=date.fromisoformat(prod_row["deadline"]),
        priority=prod_row["priority"],
    )

    result = compute_coverage(component, production_order, today)

    state["affected_production_order_id"] = prod_row["production_order_id"]
    state["coverage_days"] = result.coverage_days
    state["shortfall_units"] = result.shortfall_units
    state["computed_risk"] = result.computed_risk
    state["reasoning_trace"].append(
        f"impact_analysis: {result.coverage_days:.1f} days of coverage, "
        f"shortfall {result.shortfall_units} units, risk={result.computed_risk}"
    )
    return state


def node_check_reprioritization(state: AgentState, session: Session) -> AgentState:
    """
    Deterministic. PS §8 Scenario 6 — when a high-priority order is short,
    check whether a lower-priority order sharing the same component could be
    delayed to reduce contention. Only runs when there's an actual shortfall
    and the affected order is high-priority (protecting a low-priority order
    that's already short isn't the scenario this addresses).

    Scope note: this proposes a candidate, it does not automatically delay
    anything — the actual reschedule happens only via an explicit
    POST /production-orders/{id}/reschedule call (a human or a future
    automation decision), same "propose, don't silently act" principle as
    every other escalation-worthy decision in this system.
    """
    if not state.get("shortfall_units") or state["shortfall_units"] <= 0:
        return state  # nothing to protect against

    prod_rows = _get_production_schedule(session, state["affected_component_id"])
    protected_id = state.get("affected_production_order_id")
    protected_row = next((p for p in prod_rows if p["production_order_id"] == protected_id), None)
    if not protected_row or protected_row["priority"] != "high":
        return state  # only protect high-priority orders per PS §8 Scenario 6's framing

    competing = [p for p in prod_rows if p["production_order_id"] != protected_id]
    if not competing:
        return state

    # _get_production_schedule returns deadline as an ISO string (JSON-safe
    # for the tool-calling layer) — find_deprioritizable_orders needs real
    # date objects to do date + timedelta arithmetic. Parse here rather than
    # relaxing the service's type contract.
    for c in competing:
        if isinstance(c["deadline"], str):
            c["deadline"] = date.fromisoformat(c["deadline"])

    candidates = find_deprioritizable_orders(competing, protected_priority="high")
    if not candidates:
        state["reasoning_trace"].append(
            "check_reprioritization: no lower-priority competing order found to delay"
        )
        return state

    best = candidates[0]
    state["reprioritization_suggestion"] = {
        "production_order_id": best.production_order_id,
        "priority": best.priority,
        "units_planned": best.units_planned,
        "current_deadline": best.current_deadline.isoformat(),
        "suggested_new_deadline": best.suggested_new_deadline.isoformat(),
    }
    state["reasoning_trace"].append(
        f"check_reprioritization: {best.production_order_id} (priority={best.priority}) "
        f"could be delayed to {best.suggested_new_deadline.isoformat()} to reduce contention "
        f"for {state['affected_component_id']}"
    )
    return state


def node_verify_claim(state: AgentState, session: Session) -> AgentState:
    """Deterministic. TRD v2 §9 — the adversarial-supplier check. Skipped
    (not omitted) when there's no PO/claim to check against."""
    po_id = state.get("affected_po_id")
    if not po_id:
        state["reasoning_trace"].append("verify_claim: skipped, no PO associated with this disruption")
        state["supplier_trusted"] = None
        return state

    tracking = _check_tracking(session, po_id)
    result = verify_claim(
        supplier_claim=tracking.get("supplier_claim"),
        tracking_status=tracking.get("tracking_status", "no_data"),
    )
    state["original_supplier_claim"] = result.claim
    state["tracking_verification"] = {
        "claim": result.claim,
        "tracking_status": result.tracking_status,
        "contradicts": result.contradicts,
    }
    state["supplier_trusted"] = result.supplier_trusted

    if result.contradicts:
        state["reasoning_trace"].append(
            f"verify_claim: CONTRADICTION — supplier claimed '{result.claim}' but "
            f"tracking shows '{result.tracking_status}'. Supplier trust downgraded for this decision."
        )
        _record_trust_event(session, po_id, result.claim, result.tracking_status)
    else:
        state["reasoning_trace"].append("verify_claim: no contradiction found")
    return state


def node_score_candidates(
    state: AgentState,
    raw_candidates: list[dict],
    baseline_price: Decimal,
    max_lead_time_days: int,
) -> AgentState:
    """Deterministic. TRD v2 §6 — fixed-weight scorer. `raw_candidates` comes
    from the negotiate node's RFQ tool calls (list of dicts matching
    request_rfq's return shape plus min_order_quantity from the catalog)."""
    trust_penalized = state.get("supplier_trusted") is False

    scored_dicts = []
    for rc in raw_candidates:
        candidate = SupplierCandidate(
            supplier_id=rc["supplier_id"],
            quantity_offered=rc["quantity_available"],
            min_order_quantity=rc.get("min_order_quantity", 0),
            unit_price=Decimal(str(rc["unit_price"])),
            lead_time_days=rc["delivery_days"],
            quality_score=rc["quality_score"],
            reliability_score=rc["reliability_score"],
        )
        # A candidate's own trust penalty only applies if IT is the supplier that lied
        is_the_flagged_supplier = trust_penalized and rc["supplier_id"] == rc.get("original_supplier_id")
        scored = score_candidate(
            candidate,
            baseline_price=baseline_price,
            max_lead_time_days=max_lead_time_days,
            trust_penalized=is_the_flagged_supplier,
        )
        scored_dicts.append(
            {
                "supplier_id": candidate.supplier_id,
                "quantity_offered": candidate.quantity_offered,
                "unit_price": str(candidate.unit_price),
                "lead_time_days": candidate.lead_time_days,
                "quality_score": candidate.quality_score,
                "reliability_score": candidate.reliability_score,
                "score": scored.score,
                "trust_penalized": scored.trust_penalized,
                "constraint_violations": [],  # filled by node_constraint_validation next
            }
        )

    state["candidates"] = scored_dicts
    state["reasoning_trace"].append(f"score_candidates: scored {len(scored_dicts)} candidates")
    return state


def node_constraint_validation(
    state: AgentState,
    quality_threshold: float,
    deadline: date,
    today: date,
) -> AgentState:
    """Deterministic. TRD v2 §7. Fills constraint_violations on each candidate
    already in state['candidates'] — never removes candidates, so rejected
    ones stay visible for the UI comparison view (UI/UX v2 §5.3)."""
    candidates = [
        SupplierCandidate(
            supplier_id=c["supplier_id"],
            quantity_offered=c["quantity_offered"],
            min_order_quantity=0,  # already filtered upstream; re-check deadline/quality here
            unit_price=Decimal(c["unit_price"]),
            lead_time_days=c["lead_time_days"],
            quality_score=c["quality_score"],
            reliability_score=c["reliability_score"],
        )
        for c in state["candidates"]
    ]
    violations_map = validate_all_candidates(candidates, quality_threshold, deadline, today)

    for c in state["candidates"]:
        c["constraint_violations"] = violations_map.get(c["supplier_id"], [])

    passing = [c for c in state["candidates"] if not c["constraint_violations"]]
    state["reasoning_trace"].append(
        f"constraint_validation: {len(passing)}/{len(state['candidates'])} candidates pass"
    )
    return state


def node_plan_recovery(state: AgentState) -> AgentState:
    """Deterministic allocation (build_recovery_plan); the LLM step that
    explains the choice is a separate call made by the orchestrator using
    PLAN_RECOVERY_SYSTEM_PROMPT — kept out of this function so the allocation
    math itself stays pure and unit-testable without any LLM involved."""
    from app.services.supplier_scoring import Allocation, RecoveryPlan
    from app.services.supplier_scoring import ScoredCandidate
    from app.services.constraints import SupplierCandidate as SC

    passing = [c for c in state["candidates"] if not c["constraint_violations"]]
    scored = [
        ScoredCandidate(
            candidate=SC(
                supplier_id=c["supplier_id"],
                quantity_offered=c["quantity_offered"],
                min_order_quantity=0,
                unit_price=Decimal(c["unit_price"]),
                lead_time_days=c["lead_time_days"],
                quality_score=c["quality_score"],
                reliability_score=c["reliability_score"],
            ),
            score=c["score"],
            trust_penalized=c["trust_penalized"],
        )
        for c in passing
    ]
    ranked = rank_candidates(scored)
    plan = build_recovery_plan(ranked, shortfall_units=state["shortfall_units"] or 0)

    state["chosen_plan"] = {
        "allocations": [
            {
                "supplier_id": a.supplier_id,
                "quantity": a.quantity,
                "unit_price": str(a.unit_price),
                "lead_time_days": a.lead_time_days,
            }
            for a in plan.allocations
        ],
        "total_cost": str(plan.total_cost),
        "covers_shortfall": plan.covers_shortfall,
        "max_lead_time_days": plan.max_lead_time_days,
    }
    state["reasoning_trace"].append(
        f"plan_recovery: {'split' if len(plan.allocations) > 1 else 'single-supplier'} plan, "
        f"total_cost={plan.total_cost}, covers_shortfall={plan.covers_shortfall}"
    )
    return state


def node_decision_gate(
    state: AgentState,
    approval_required_above: Decimal,
) -> AgentState:
    """Deterministic. TRD v2 §4 decision_gate — checks cost against threshold,
    forces escalation if no plan covers the shortfall."""
    plan = state.get("chosen_plan")

    if plan is None or not plan["covers_shortfall"]:
        state["requires_approval"] = True
        state["approval_reason"] = "No compliant supplier combination covers the full shortfall"
        state["reasoning_trace"].append("decision_gate: no complete recovery plan — escalating")
        return state

    requires, reason = validate_plan_cost(Decimal(plan["total_cost"]), approval_required_above)
    state["requires_approval"] = requires
    state["approval_reason"] = reason
    state["reasoning_trace"].append(
        f"decision_gate: requires_approval={requires}" + (f" ({reason})" if reason else "")
    )
    return state


def node_route_after_tool_result(state: AgentState) -> str:
    """Conditional edge per TRD v2 §4. If a tool result contradicted an
    assumption already in state, replan — but only up to MAX_REPLANS times."""
    if state.get("contradiction_detected") and state["replan_count"] < MAX_REPLANS:
        state["replan_count"] += 1
        state["contradiction_detected"] = False
        state["reasoning_trace"].append(
            f"replan_check: contradiction detected, re-entering impact_analysis "
            f"(replan #{state['replan_count']})"
        )
        return "replan"
    return "continue"


def node_route_after_decision_gate(state: AgentState) -> str:
    return "human_queue" if state["requires_approval"] else "execute"


def node_execute(state: AgentState, session: Session) -> AgentState:
    """Simulated ERP write (PS §18 — never a real integration)."""
    if state.get("affected_production_order_id"):
        _update_erp(
            session,
            "update_production_status",
            {"production_order_id": state["affected_production_order_id"], "status": "on_track"},
        )
    state["execution_status"] = "auto_executed"
    state["reasoning_trace"].append("execute: ERP updated, production order marked on_track")
    return state


def node_audit_write(
    state: AgentState,
    session: Session,
    secret_key: bytes,
    status: str,
    reasoning_text: str,
    replan_of: str | None = None,
) -> AgentState:
    """Writes the decisions row + a hash-chained audit_log row. Reuses the
    Phase 2 hashing module directly — same append_entry function tested
    against the tamper-check scenario.

    When replan_of is provided (a prior decision for the same production
    order that this run supersedes — see graph.py's lookup before this node
    runs), the PRIOR decision's status is updated to 'replanned' and a
    separate audit_log entry records that supersession explicitly, so
    replanning is visible in the audit trail as its own logged event, not
    just implied by a foreign key (App Flow v2 Flow D)."""
    from app.db.models import AuditLog

    last_entry = session.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    prev_hash = last_entry.hash if last_entry else None

    if replan_of:
        prior_decision = session.query(Decision).filter_by(id=replan_of).first()
        if prior_decision:
            prior_decision.status = "replanned"
            session.flush()
            supersede_entry = append_entry(
                decision_id=prior_decision.id,
                actor="agent",
                action="superseded_by_replan",
                prev_hash=prev_hash,
                secret_key=secret_key,
            )
            session.add(
                AuditLog(
                    decision_id=prior_decision.id,
                    actor=supersede_entry.actor,
                    action=supersede_entry.action,
                    hash=supersede_entry.hash,
                    prev_hash=supersede_entry.prev_hash,
                )
            )
            session.flush()
            prev_hash = supersede_entry.hash
            state["reasoning_trace"].append(
                f"audit_write: replanning — decision {prior_decision.id} marked superseded"
            )

    decision = Decision(
        disruption_id=state["disruption_id"],
        production_order_id=state.get("affected_production_order_id"),
        candidates_json=state["candidates"],
        constraint_results_json={c["supplier_id"]: c["constraint_violations"] for c in state["candidates"]},
        chosen_plan_json=state.get("chosen_plan"),
        reasoning_text=reasoning_text,
        decision_brief_json=state.get("decision_brief"),
        status=status,
        replan_of=replan_of,
        tool_call_count=state.get("tool_call_count", 0),
    )
    session.add(decision)
    session.flush()  # get decision.id without a full commit yet

    entry = append_entry(
        decision_id=decision.id,
        actor="agent",
        action=status,
        prev_hash=prev_hash,
        secret_key=secret_key,
    )
    audit_row = AuditLog(
        decision_id=decision.id,
        actor=entry.actor,
        action=entry.action,
        hash=entry.hash,
        prev_hash=entry.prev_hash,
    )
    session.add(audit_row)
    session.commit()

    state["decision_id"] = decision.id
    state["reasoning_trace"].append(f"audit_write: decision {decision.id} logged, status={status}")
    return state

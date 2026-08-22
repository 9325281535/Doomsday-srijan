"""
Integration proof — not a unit test. Seeds a real (SQLite, for this sandbox;
Postgres in production) database, queries rows back out, and feeds them through
the Phase 2 services to prove the whole pipeline is wired correctly end to end,
not just correct in isolation.
"""
import os

os.environ["DATABASE_URL"] = "sqlite:///./trace_scda_proof.db"

from decimal import Decimal

from app.db.models import Component as ComponentRow
from app.db.models import ProductionOrderModel, PurchaseOrder, Supplier, TrackingEvent
from app.db.session import get_session
from app.services import seed_data
from app.services.claim_verification import verify_claim
from app.services.constraints import SupplierCandidate, validate_all_candidates
from app.services.coverage import Component, ProductionOrder, compute_coverage
from app.services.supplier_scoring import build_recovery_plan, rank_candidates, score_candidate

TODAY = seed_data.TODAY


def main():
    print("Seeding database...")
    seed_data.seed_all()

    session = get_session()
    try:
        print("\n--- Scenario 1: Baseline Delay ---")
        comp_row = session.query(ComponentRow).filter_by(component_id="COMP-104").first()
        prod_row = session.query(ProductionOrderModel).filter_by(
            production_order_id="PROD-882"
        ).first()
        supplier_rows = session.query(Supplier).filter(
            Supplier.component_id == "COMP-104", Supplier.supplier_id != "SUP-99"
        ).all()

        component = Component(
            component_id=comp_row.component_id,
            usable_stock=comp_row.usable_stock,
            daily_usage=comp_row.daily_usage,
            safety_stock=comp_row.safety_stock,
            quality_threshold=float(comp_row.quality_threshold),
        )
        production_order = ProductionOrder(
            production_order_id=prod_row.production_order_id,
            required_component=prod_row.required_component,
            units_planned=prod_row.units_planned,
            component_required_per_unit=prod_row.component_required_per_unit,
            deadline=prod_row.deadline,
            priority=prod_row.priority,
        )

        coverage = compute_coverage(component, production_order, TODAY)
        print(
            f"  Coverage: {coverage.coverage_days:.1f} days on hand, "
            f"shortfall {coverage.shortfall_units} units, risk={coverage.computed_risk}"
        )
        assert coverage.shortfall_units == 700 - 390
        assert coverage.computed_risk in ("High", "Critical")

        candidates = [
            SupplierCandidate(
                supplier_id=s.supplier_id,
                quantity_offered=s.available_quantity,
                min_order_quantity=s.min_order_quantity,
                unit_price=Decimal(str(s.unit_price)),
                lead_time_days=s.lead_time_days,
                quality_score=float(s.quality_score),
                reliability_score=float(s.reliability_score),
                certifications=s.certifications,
            )
            for s in supplier_rows
            if s.supplier_id != "SUP-21"  # exclude the delayed original supplier from recovery
        ]
        violations = validate_all_candidates(
            candidates,
            quality_threshold=float(comp_row.quality_threshold),
            deadline=prod_row.deadline,
            today=TODAY,
        )
        for sid, v in violations.items():
            print(f"  {sid} violations: {v or 'none'}")

        valid_candidates = [c for c in candidates if not violations[c.supplier_id]]
        scored = rank_candidates(
            [
                score_candidate(c, baseline_price=Decimal("118"), max_lead_time_days=6)
                for c in valid_candidates
            ]
        )
        for s in scored:
            print(f"  {s.candidate.supplier_id} score={s.score}")

        plan = build_recovery_plan(scored, shortfall_units=coverage.shortfall_units)
        print(
            f"  Recovery plan: covers_shortfall={plan.covers_shortfall}, "
            f"total_cost={plan.total_cost}, allocations={[(a.supplier_id, a.quantity) for a in plan.allocations]}"
        )
        assert plan.covers_shortfall is True
        assert plan.total_cost <= Decimal("150000")  # PO-7712's approval threshold

        print("\n--- Scenario 3: Adversarial Claim ---")
        tracking_row = session.query(TrackingEvent).filter_by(po_id="PO-7712").first()
        result = verify_claim(
            supplier_claim=tracking_row.supplier_claim,
            tracking_status=tracking_row.tracking_status,
        )
        print(
            f"  Claim '{result.claim}' vs tracking '{result.tracking_status}' -> "
            f"contradicts={result.contradicts}, trusted={result.supplier_trusted}"
        )
        assert result.contradicts is True

        print("\n--- Scenario 5: Budget Escalation ---")
        po_row = session.query(PurchaseOrder).filter_by(po_id="PO-9021").first()
        sup99_row = session.query(Supplier).filter_by(supplier_id="SUP-99").first()
        prod901 = session.query(ProductionOrderModel).filter_by(
            production_order_id="PROD-901"
        ).first()
        comp901 = session.query(ComponentRow).filter_by(
            component_id=prod901.required_component
        ).first()

        # Use the REAL coverage calculation, not units_planned directly — an earlier
        # version of this check hardcoded shortfall=units_planned (700), which produced
        # a misleadingly large "expected" cost ($161,000) that never matched what the
        # actual agent computes. The real shortfall is only the gap beyond existing
        # usable_stock, same formula the live graph run uses.
        component_for_coverage = Component(
            component_id=comp901.component_id,
            usable_stock=comp901.usable_stock,
            daily_usage=comp901.daily_usage,
            safety_stock=comp901.safety_stock,
            quality_threshold=float(comp901.quality_threshold),
        )
        production_order_for_coverage = ProductionOrder(
            production_order_id=prod901.production_order_id,
            required_component=prod901.required_component,
            units_planned=prod901.units_planned,
            component_required_per_unit=prod901.component_required_per_unit,
            deadline=prod901.deadline,
            priority=prod901.priority,
        )
        coverage901 = compute_coverage(component_for_coverage, production_order_for_coverage, TODAY)
        print(f"  Real shortfall for PROD-901: {coverage901.shortfall_units} units (not units_planned={prod901.units_planned})")

        candidate_99 = SupplierCandidate(
            supplier_id=sup99_row.supplier_id,
            quantity_offered=sup99_row.available_quantity,
            min_order_quantity=sup99_row.min_order_quantity,
            unit_price=Decimal(str(sup99_row.unit_price)),
            lead_time_days=sup99_row.lead_time_days,
            quality_score=float(sup99_row.quality_score),
            reliability_score=float(sup99_row.reliability_score),
        )
        scored99 = [score_candidate(candidate_99, Decimal("118"), max_lead_time_days=2)]
        plan99 = build_recovery_plan(scored99, shortfall_units=coverage901.shortfall_units)
        print(f"  Total cost for PROD-901 recovery: {plan99.total_cost}")
        print(f"  PO-9021 approval_required_above: {po_row.approval_required_above}")
        assert plan99.total_cost > Decimal(str(po_row.approval_required_above))
        print("  -> Correctly exceeds threshold, would escalate to human_queue")

        print("\n--- Scenario 2: Replanning (Phase 1 state) ---")
        # Fixed: this used to reuse comp_row (COMP-104) from the Scenario 1 block
        # above — leftover from before Scenario 2 got its own component. COMP-104
        # always has current_stock == usable_stock (390 == 390), so that assertion
        # could never pass; it was checking the wrong component entirely. The real
        # stale/ground-truth pair now lives on COMP-205, seeded deliberately with
        # current_stock == usable_stock == 800 (the WRONG figure, not yet corrected —
        # see seed_scenario_2_stale_inventory()'s docstring). There's no mismatch to
        # assert here anymore; Phase 1's whole point is that the figures agree (both
        # wrong) until POST /components/COMP-205/correct changes usable_stock — that
        # full two-phase flow is what run_replan_scenario.py actually exercises live.
        comp205 = session.query(ComponentRow).filter_by(component_id="COMP-205").first()
        print(f"  COMP-205 current_stock: {comp205.current_stock}")
        print(f"  COMP-205 usable_stock: {comp205.usable_stock} (deliberately == current_stock — not yet corrected)")
        assert comp205.current_stock == comp205.usable_stock == 800
        print("  -> Phase 1 state confirmed. Run `python run_replan_scenario.py` for the full")
        print("     two-phase replan (correction -> Phase 2 -> replan_of linkage) through the live agent.")

        print("\n=== ALL INTEGRATION CHECKS PASSED ===")
    finally:
        session.close()


if __name__ == "__main__":
    main()

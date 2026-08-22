"""
The LangGraph state machine itself. See TRD_Supply_Chain_Disruption_Agent_v2.md §4.

Requires: langgraph, langchain-groq, groq (see requirements.txt) and a
GROQ_API_KEY environment variable (set in .env — see app/config.py).
"""
import app.config  # noqa: F401 — loads .env before anything below reads os.environ
import json
import os
from datetime import date
from decimal import Decimal

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from app.agent import nodes, prompts
from app.agent.state import AgentState, new_state
from app.agent.tools import _get_purchase_order, _get_supplier_catalog, build_tools
from app.db.models import Decision, DisruptionEvent

MODEL_NAME = "openai/gpt-oss-120b"  # llama-3.3-70b-versatile was deprecated June 2026;
# this is Groq's recommended replacement and supports tool-calling, which we need
# for the negotiate/investigate nodes. If you hit another 404, run:
#   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
# to see your account's currently active model list.
MAX_TOOL_LOOP_ITERATIONS = 4  # hard cap — PS §6's "limited tool-call budget" constraint


def _feasible_by_deadline(supplier: dict, deadline_str: str | None, today: date) -> bool:
    """
    Deterministic feasibility pre-filter: can this supplier's catalog lead
    time possibly meet the deadline at all? Applied BEFORE the negotiate
    LLM call, not left to the model to notice on its own.

    This exists because relying on the model to pick the right supplier out
    of a table of options proved unreliable in testing — across three
    separate attempts (bare ID list, then a full data table with explicit
    "prioritize by lead time" instructions), the model still sometimes
    ignored the one supplier whose lead time actually fit the deadline and
    queried slower ones instead. That's a fine failure mode for something
    low-stakes, but here it means the agent would silently never even
    consider the correct recovery option. Filtering deterministically removes
    the possibility entirely rather than hoping better prompt wording fixes
    it a fourth time. The real constraint_validation check (TRD v2 §7) still
    runs afterward as the authoritative pass/fail — this is only a pre-filter
    to keep the LLM from wasting calls on, or missing, obviously (in)feasible
    options.
    """
    if deadline_str is None:
        return True  # no deadline known yet — don't filter blind
    days_until_deadline = (date.fromisoformat(deadline_str) - today).days
    return supplier["lead_time_days"] <= days_until_deadline


def _invoke_tool_with_retry(tool_fn, args: dict, retries: int = 1) -> dict:
    """One retry on failure, then a structured error result the model can
    reason about (e.g. "skip this supplier, try another") instead of an
    unhandled exception killing the whole disruption run."""
    last_error = None
    for attempt in range(retries + 1):
        try:
            return tool_fn.invoke(args)
        except Exception as e:
            last_error = e
    return {"error": f"Tool call failed after {retries + 1} attempt(s): {last_error}"}


def _get_model(tools: list | None = None) -> ChatGroq:
    model = ChatGroq(model=MODEL_NAME, api_key=os.environ["GROQ_API_KEY"], temperature=0)
    return model.bind_tools(tools) if tools else model


def _should_negotiate_with(supplier_id: str, state: AgentState, original_po: dict) -> bool:
    """
    Whether a catalog supplier should be included as a negotiation candidate.

    The ORIGINAL PO's supplier is excluded only when verify_claim (a
    deterministic check, not an LLM guess) actually caught them contradicting
    tracking data — supplier_trusted is False. A plain unconfirmed delay with
    no caught lie does NOT exclude them; the PS's own Scenario 1 describes
    asking the original supplier for a revised delivery date as a valid first
    move, not a ban.

    Earlier version of this function used the triage node's event_type
    classification instead ("delay" -> exclude). That's unreliable: triage
    only sees the disruption's free-text raw_payload and can misclassify —
    caught live when Scenario 5's raw_payload (about a tight deadline, not an
    actual delay) got triaged as "delay" anyway, which would have re-excluded
    SUP-99 even after the first fix. supplier_trusted is deterministic and
    doesn't have this failure mode.
    """
    if supplier_id != original_po.get("supplier_id"):
        return True  # not the original supplier at all — always a fair candidate
    return state.get("supplier_trusted") is not False  # exclude only on a PROVEN contradiction


def _structured_json_call(system_prompt: str, model: ChatGroq | None = None) -> dict:
    """For triage-style calls: no tools, expects strict JSON back."""
    m = model or _get_model()
    response = m.invoke([SystemMessage(content=system_prompt)])
    text = response.content.strip()
    # Groq sometimes wraps JSON in ```json fences despite instructions — strip defensively
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    return json.loads(text)


def _tool_calling_loop(
    system_prompt: str,
    tools: list,
    max_iterations: int = MAX_TOOL_LOOP_ITERATIONS,
) -> list[dict]:
    """
    Minimal ReAct-style loop: give the model tools, let it call them, feed
    results back, repeat until it stops calling tools or we hit the cap.
    Returns the list of tool RESULTS gathered (not the model's final text),
    since the calling node cares about the data collected, not commentary.

    Tool-call failures retry once, then degrade to an error result fed back
    to the model rather than crashing the whole run — per TRD v2 §13's NFR
    ("if a tool call fails, retry once then fall back... rather than
    proceeding silently") and PS §6's "incomplete information" / "limited
    tool-call budget" system constraints. A DB hiccup on one RFQ call
    shouldn't take down the entire disruption run.
    """
    model = _get_model(tools)
    tool_map = {t.name: t for t in tools}
    messages = [SystemMessage(content=system_prompt)]
    collected_results = []

    for _ in range(max_iterations):
        response = model.invoke(messages)
        messages.append(response)

        if not getattr(response, "tool_calls", None):
            break

        for call in response.tool_calls:
            tool_fn = tool_map.get(call["name"])
            if tool_fn is None:
                continue

            result = _invoke_tool_with_retry(tool_fn, call["args"])
            collected_results.append({"tool": call["name"], "args": call["args"], "result": result})
            messages.append(
                ToolMessage(content=json.dumps(result, default=str), tool_call_id=call["id"])
            )

    return collected_results


def run_disruption(
    disruption_id: str,
    session: Session,
    secret_key: bytes,
    today: date | None = None,
    on_step=None,
) -> AgentState:
    """
    Orchestrates one full disruption run. This is a straightforward sequential
    orchestration (not a formal langgraph.StateGraph compile+invoke) so it's
    easy to read/debug/smoke-test line by line during the hackathon — swap to
    a compiled StateGraph (build_graph() below) once the sequence is stable
    and you want the built-in conditional-edge/replan machinery.

    `today` defaults to seed_data.TODAY (2026-09-01), NOT the real wall-clock
    date. All four seeded scenarios' deadlines are anchored to that fixed
    epoch specifically so the demo behaves identically no matter what day you
    actually run it — passing the real date.today() here breaks every
    deadline-relative constraint check against seeded data (caught live:
    Scenario 5's 2-day deadline silently became a ~12-day runway when the
    real wall-clock date was used instead). Pass an explicit `today` only if
    you're testing against your own non-seeded data with real dates.

    `on_step`, if provided, is called synchronously as `on_step(status: str,
    payload: dict)` at each major transition — this is what lets the API
    layer (app/api/events.py) push LIVE WS updates mid-run instead of only
    a single broadcast at the very end. Most importantly, it fires a distinct
    "claim_contradicted" status the instant verify_claim catches a supplier
    lying, so the frontend's trust-alert visual can flash in real time rather
    than only being visible after the fact in the finished decision.
    """
    from app.services.seed_data import TODAY as SEED_EPOCH

    def _step(status: str, payload: dict | None = None):
        if on_step:
            on_step(status, {"disruption_id": disruption_id, **(payload or {})})

    today = today or SEED_EPOCH
    event = session.query(DisruptionEvent).filter_by(id=disruption_id).first()
    if event is None:
        raise ValueError(f"No disruption event found with id {disruption_id}")

    state = new_state(disruption_id)
    state["affected_po_id"] = event.po_id
    state["affected_production_order_id"] = event.production_order_id
    state["affected_component_id"] = event.raw_payload.get("component_id")

    # 1. triage — LLM, structured JSON
    _step("triaging")
    triage_prompt = prompts.TRIAGE_SYSTEM_PROMPT.format(raw_payload=json.dumps(event.raw_payload))
    triage_result = _structured_json_call(triage_prompt)
    state["event_type"] = triage_result.get("event_type")
    state["affected_po_id"] = state["affected_po_id"] or triage_result.get("affected_po_id")
    state["affected_production_order_id"] = (
        state["affected_production_order_id"] or triage_result.get("affected_production_order_id")
    )
    state["reasoning_trace"].append(f"triage: classified as {state['event_type']}")

    # 2. impact_analysis — deterministic
    _step("assessing_coverage")
    state = nodes.node_impact_analysis(state, session, today)

    # 2b. check_reprioritization — deterministic. PS §8 Scenario 6: is there a
    # lower-priority order competing for the same component that could be
    # delayed to help this one? Only produces a proposal, never auto-acts.
    state = nodes.node_check_reprioritization(state, session)

    # 3. verify_claim — deterministic
    _step("verifying_claim")
    state = nodes.node_verify_claim(state, session)
    if state.get("tracking_verification") and state["tracking_verification"].get("contradicts"):
        # Distinct status, not folded into "verifying_claim" — this is the
        # specific moment the trust-alert visual (UI/UX v2 §3, §5.1) should fire.
        _step(
            "claim_contradicted",
            {
                "claim": state["tracking_verification"]["claim"],
                "tracking_status": state["tracking_verification"]["tracking_status"],
            },
        )

    # 4. investigate + negotiate — LLM tool-calling loop
    _step("negotiating")
    tools = build_tools(session, disruption_id)
    catalog = _get_supplier_catalog(session, state["affected_component_id"])
    original_po = _get_purchase_order(session, state["affected_po_id"]) if state["affected_po_id"] else {}

    # 4a. Contact the ORIGINAL supplier for a revised delivery date — PS §10's
    # own Minimum Demo Flow explicitly includes this step ("Ask SUP-21 for
    # revised delivery confirmation") alongside sourcing alternates, and it's
    # missing from every prior version of this pipeline. Done deterministically
    # (not left to the LLM to remember) for the same reliability reason the
    # supplier-selection logic was made deterministic earlier: this needs to
    # happen every time for a genuine delay, not "usually."
    #
    # Scoped to actual delay-type events with a known original supplier —
    # skipped for Scenario 5-style quantity_shortfall (the "original" supplier
    # there is the expedite option itself, not someone who's late) and for
    # replan-correction events with no PO at all.
    if state.get("event_type") in ("delay", "supplier_claim_mismatch") and original_po.get("supplier_id"):
        from app.agent.tools import _send_supplier_message

        checkin_result = _send_supplier_message(
            session,
            supplier_id=original_po["supplier_id"],
            subject=f"Status check — {state.get('affected_po_id', 'your shipment')}",
            body=(
                f"We've flagged a possible delay on this order. Can you confirm a revised "
                f"delivery date? We're evaluating alternate sourcing in parallel to protect "
                f"our production schedule, but would prefer to proceed with your original "
                f"commitment if you can confirm a firm date."
            ),
            po_id=state.get("affected_po_id"),
        )
        state["reasoning_trace"].append(
            f"negotiate: contacted original supplier {original_po['supplier_id']} "
            f"for a revised delivery date (PS §10 demo flow step) — {checkin_result.get('status', 'sent')}"
        )

    deadline_str = None
    if state.get("affected_production_order_id"):
        from app.agent.tools import _get_production_schedule

        prod_rows = _get_production_schedule(session, state["affected_component_id"])
        match = next(
            (p for p in prod_rows if p["production_order_id"] == state["affected_production_order_id"]),
            None,
        )
        deadline_str = match["deadline"] if match else None

    negotiate_candidates = [
        c
        for c in catalog
        if _should_negotiate_with(c["supplier_id"], state, original_po)
        and _feasible_by_deadline(c, deadline_str, today)
    ]
    candidates_table = "\n".join(
        f"- {c['supplier_id']}: price=${c['unit_price']}/unit, lead_time={c['lead_time_days']} days, "
        f"quality_score={c['quality_score']}, reliability_score={c['reliability_score']}, "
        f"available={c['available_quantity']}, MOQ={c['min_order_quantity']}"
        for c in negotiate_candidates
    ) or "(no supplier in the catalog has a lead time that fits the deadline — do not call request_rfq for anyone)"

    negotiate_prompt = prompts.NEGOTIATE_SYSTEM_PROMPT.format(
        shortfall_units=state["shortfall_units"],
        component_id=state["affected_component_id"],
        deadline=deadline_str,
        candidates_table=candidates_table,
    )
    tool_results = _tool_calling_loop(negotiate_prompt, tools)
    state["tool_call_count"] = len(tool_results)
    state["reasoning_trace"].append(f"negotiate: {len(tool_results)} tool calls made")

    rfq_results = [
        {**r["result"], "min_order_quantity": next(
            (c["min_order_quantity"] for c in catalog if c["supplier_id"] == r["result"].get("supplier_id")), 0
        ), "quality_score": next(
            (c["quality_score"] for c in catalog if c["supplier_id"] == r["result"].get("supplier_id")), 0
        ), "reliability_score": next(
            (c["reliability_score"] for c in catalog if c["supplier_id"] == r["result"].get("supplier_id")), 0
        ), "original_supplier_id": original_po.get("supplier_id")}
        for r in tool_results
        if r["tool"] == "request_rfq" and "error" not in r["result"]
    ]

    # 5. score_candidates — deterministic
    _step("validating")
    baseline_price = Decimal(str(original_po.get("unit_price", 100)))
    max_lead = max([c["delivery_days"] for c in rfq_results], default=1)
    state = nodes.node_score_candidates(state, rfq_results, baseline_price, max_lead)

    # 6. constraint_validation — deterministic
    component_info = catalog[0] if catalog else {}
    quality_threshold = 0.80  # falls back if not resolvable; real value comes from Component row
    from app.agent.tools import _get_inventory_status

    inv = _get_inventory_status(session, state["affected_component_id"])
    if "quality_threshold" in inv:
        quality_threshold = inv["quality_threshold"]
    deadline_date = date.fromisoformat(deadline_str) if deadline_str else today
    state = nodes.node_constraint_validation(state, quality_threshold, deadline_date, today)

    # 7. plan_recovery — deterministic allocation, then LLM explains it
    state = nodes.node_plan_recovery(state)
    plan_prompt = prompts.PLAN_RECOVERY_SYSTEM_PROMPT.format(
        production_order_id=state["affected_production_order_id"],
        shortfall_units=state["shortfall_units"],
        component_id=state["affected_component_id"],
        deadline=deadline_str,
        candidates_json=json.dumps(state["candidates"]),
        supplier_trusted=state["supplier_trusted"],
    )
    reasoning_response = _get_model().invoke([SystemMessage(content=plan_prompt)])
    reasoning_text = reasoning_response.content.strip()
    state["reasoning_trace"].append(f"plan_recovery reasoning: {reasoning_text}")

    # 8. decision_gate — deterministic
    approval_threshold = Decimal(str(original_po.get("approval_required_above", 150000)))
    state = nodes.node_decision_gate(state, approval_threshold)

    # 9. route: execute or human_queue
    if state["requires_approval"]:
        brief_prompt = prompts.DECISION_BRIEF_SYSTEM_PROMPT.format(
            disruption_context=json.dumps(
                {
                    "production_order_id": state["affected_production_order_id"],
                    "shortfall_units": state["shortfall_units"],
                    "chosen_plan": state.get("chosen_plan"),
                    "approval_reason": state["approval_reason"],
                    "supplier_trusted": state["supplier_trusted"],
                    "reprioritization_option": state.get("reprioritization_suggestion"),
                },
                default=str,
            )
        )
        brief_response = _get_model().invoke([SystemMessage(content=brief_prompt)])
        state["decision_brief"] = {"text": brief_response.content.strip()}
        status = "pending_approval"
    else:
        state = nodes.node_execute(state, session)
        status = "auto_executed"

    # 10. audit_write — deterministic. Look up any PRIOR decision for the same
    # production order — if one exists, this run supersedes it (a real replan,
    # not the first pass) and audit_write will mark that prior decision as
    # 'replanned' and link this new one to it via replan_of (App Flow v2 Flow D).
    replan_of = None
    if state.get("affected_production_order_id"):
        prior = (
            session.query(Decision)
            .filter(
                Decision.production_order_id == state["affected_production_order_id"],
                Decision.status != "replanned",  # don't chain onto an already-superseded decision
            )
            .order_by(Decision.created_at.desc())
            .first()
        )
        if prior:
            replan_of = prior.id
            state["reasoning_trace"].append(
                f"replan detected: production order {state['affected_production_order_id']} "
                f"already has decision {prior.id} — this run will supersede it"
            )
            _step("replanning", {"supersedes_decision_id": prior.id})

    secret = secret_key
    state = nodes.node_audit_write(state, session, secret, status, reasoning_text, replan_of=replan_of)

    return state


def build_graph():
    """
    Compiled langgraph.StateGraph version — use this once you want the
    built-in conditional-edge/replan machinery instead of the linear
    run_disruption() orchestration above. Wire nodes.node_* functions in with
    functools.partial to bind session/today/etc, since StateGraph nodes take
    only (state) -> state.
    """
    graph = StateGraph(AgentState)
    # Example wiring (bind extra args via functools.partial before adding):
    # graph.add_node("impact_analysis", partial(nodes.node_impact_analysis, session=session, today=today))
    # graph.add_node("verify_claim", partial(nodes.node_verify_claim, session=session))
    # ... etc, then:
    # graph.add_edge(START, "impact_analysis")
    # graph.add_conditional_edges("decision_gate", nodes.node_route_after_decision_gate, {...})
    # graph.add_edge("execute", END)
    # return graph.compile()
    raise NotImplementedError(
        "Skeleton only — run_disruption() above is the working orchestration for "
        "the hackathon timeline. Compile this once you have time to wire the "
        "conditional replan edges properly (TRD v2 §4)."
    )


if __name__ == "__main__":
    import sys

    from app.db.session import get_session

    if "GROQ_API_KEY" not in os.environ:
        print("Set GROQ_API_KEY before running this.")
        sys.exit(1)

    session = get_session()
    disruption = session.query(DisruptionEvent).first()
    if not disruption:
        print("No disruption_events found — seed the DB first: python -m app.services.seed_data")
        sys.exit(1)

    result_state = run_disruption(disruption.id, session, secret_key=b"dev-secret-change-me")
    print(json.dumps(result_state, indent=2, default=str))

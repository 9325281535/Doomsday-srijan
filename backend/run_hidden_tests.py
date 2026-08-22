"""
Live tests for the two hidden-event categories flagged in
HIDDEN_TEST_COVERAGE.md as "logic verified, no live run yet":

  - Demand spike (PS §7 hidden test #6)
  - Expedite unavailable (PS §7 hidden test #7)

Builds fresh, self-contained fixtures (not touching seed_data.py's 4 core
scenarios) directly via SQLAlchemy, runs each through the real agent, and
asserts the expected behavior. Purpose: prove generalization beyond the
rehearsed demo scenarios, not just claim it.

Usage: python run_hidden_tests.py
"""
from datetime import timedelta

import app.config  # noqa: F401 — loads .env

from app.agent.graph import run_disruption
from app.db.models import Component, DisruptionEvent, ProductionOrderModel, Supplier
from app.db.session import get_session, init_db
from app.services.seed_data import TODAY


def seed_demand_spike_fixture(session):
    """A production order whose consumption rate is unusually high relative
    to normal stock — models PS's 'sudden demand spike increases component
    usage' hidden test. daily_usage=180 (double a typical rate) against a
    modest usable_stock forces a real, non-trivial shortfall."""
    component = Component(
        component_id="COMP-310",
        name="High-Draw Capacitor Bank",
        current_stock=300,
        usable_stock=300,
        daily_usage=180,  # spiked — double the normal ~90/day seen in Scenario 1
        safety_stock=100,
        warehouse="Pune-Plant-1",
        quality_threshold=0.80,
    )
    session.add(component)

    supplier = Supplier(
        supplier_id="SUP-64",
        supplier_name="Konkan Capacitor Works",
        component_id="COMP-310",
        unit_price=210,
        lead_time_days=4,
        available_quantity=800,
        quality_score=0.91,
        reliability_score=0.88,
        min_order_quantity=100,
        certifications=["ISO-9001"],
    )
    session.add(supplier)

    prod = ProductionOrderModel(
        production_order_id="PROD-777",
        product="High-Draw Power Unit",
        required_component="COMP-310",
        units_planned=900,
        component_required_per_unit=1,
        deadline=TODAY + timedelta(days=6),
        priority="high",
        status="at_risk",
    )
    session.add(prod)
    session.commit()

    disruption = DisruptionEvent(
        event_type="demand_spike",
        po_id=None,
        production_order_id="PROD-777",
        raw_payload={
            "component_id": "COMP-310",
            "notes": "Daily consumption of COMP-310 has doubled following a design change.",
        },
    )
    session.add(disruption)
    session.commit()
    return disruption.id


def seed_expedite_unavailable_fixture(session):
    """A deadline so tight that NO supplier's lead time can meet it — models
    PS's 'expedited delivery becomes unavailable' hidden test. Confirms the
    system escalates gracefully (decision_gate's no-compliant-candidate path)
    rather than crashing or silently picking an infeasible supplier."""
    component = Component(
        component_id="COMP-311",
        name="Micro Relay Switch",
        current_stock=50,
        usable_stock=50,
        daily_usage=40,
        safety_stock=20,
        warehouse="Pune-Plant-1",
        quality_threshold=0.80,
    )
    session.add(component)

    # Fastest available supplier still can't hit a 1-day deadline.
    supplier = Supplier(
        supplier_id="SUP-65",
        supplier_name="Sahyadri Switchgear",
        component_id="COMP-311",
        unit_price=40,
        lead_time_days=3,  # deliberately slower than the 1-day deadline below
        available_quantity=500,
        quality_score=0.85,
        reliability_score=0.80,
        min_order_quantity=50,
        certifications=["ISO-9001"],
        expedite_available=False,  # explicitly no rush option, per PS's hidden test framing
    )
    session.add(supplier)

    prod = ProductionOrderModel(
        production_order_id="PROD-778",
        product="Micro Relay Assembly",
        required_component="COMP-311",
        units_planned=200,
        component_required_per_unit=1,
        deadline=TODAY + timedelta(days=1),  # nobody can hit this
        priority="high",
        status="at_risk",
    )
    session.add(prod)
    session.commit()

    disruption = DisruptionEvent(
        event_type="quantity_shortfall",
        po_id=None,
        production_order_id="PROD-778",
        raw_payload={
            "component_id": "COMP-311",
            "notes": "Urgent shortfall with a 1-day window; no expedited option exists.",
        },
    )
    session.add(disruption)
    session.commit()
    return disruption.id


def main():
    init_db()
    session = get_session()
    try:
        print("=== HIDDEN TEST 1: Demand Spike ===")
        disruption_id = seed_demand_spike_fixture(session)
        state = run_disruption(disruption_id, session, secret_key=b"dev-secret-change-me")
        print(f"  shortfall_units: {state['shortfall_units']} (expect 600 = 900 - 300)")
        print(f"  computed_risk: {state['computed_risk']}")
        print(f"  status: {state.get('execution_status') or 'pending_approval'}")
        assert state["shortfall_units"] == 600
        assert state["computed_risk"] in ("High", "Critical")
        print("  PASS — demand spike correctly recalculated, no stale-assumption failure")

        print("\n=== HIDDEN TEST 2: Expedite Unavailable ===")
        disruption_id2 = seed_expedite_unavailable_fixture(session)
        state2 = run_disruption(disruption_id2, session, secret_key=b"dev-secret-change-me")
        print(f"  candidates: {[c['supplier_id'] for c in state2['candidates']]} (expect empty — pre-filtered)")
        print(f"  requires_approval: {state2['requires_approval']}")
        print(f"  approval_reason: {state2['approval_reason']}")
        assert state2["requires_approval"] is True
        assert state2["chosen_plan"] is None or state2["chosen_plan"]["covers_shortfall"] is False
        print("  PASS — no feasible supplier, system escalated cleanly instead of crashing or forcing a bad pick")

        print("\n=== BOTH HIDDEN TESTS PASSED — upgrade HIDDEN_TEST_COVERAGE.md rows 6 and 7 to ✅ ===")
    finally:
        session.close()


if __name__ == "__main__":
    main()

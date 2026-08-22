"""
Live test of node_check_reprioritization firing through the real agent —
the unit tests in test_prioritization.py prove the pure logic is correct in
isolation; this proves it's actually wired into run_disruption() correctly.

Usage: python run_reprioritization_test.py
"""
from datetime import timedelta

import app.config  # noqa: F401 — loads .env

from app.agent.graph import run_disruption
from app.db.models import Component, DisruptionEvent, ProductionOrderModel, Supplier
from app.db.session import get_session, init_db
from app.services.seed_data import TODAY


def cleanup_prior_run(session):
    """
    Makes this script safely re-runnable. Without this, a crash partway
    through a previous run (as actually happened here — the date-parsing bug
    committed the seed rows before run_disruption crashed later) leaves
    stale rows that collide on the next attempt. seed_data.py's seed_all()
    has this same discipline via clear_all(); this script never had it
    because it seeds fresh, unrelated rows rather than reusing seed_data's
    shared clear-everything approach — but "fresh rows" still needs cleanup
    if a prior attempt partially succeeded.
    """
    from app.db.models import Component, Decision, DisruptionEvent, ProductionOrderModel, Supplier

    # Children before parents, same FK-safe order as seed_data.py's clear_all().
    session.query(Decision).filter(
        Decision.production_order_id.in_(["PROD-880", "PROD-881"])
    ).delete(synchronize_session=False)
    session.query(DisruptionEvent).filter(
        DisruptionEvent.production_order_id.in_(["PROD-880", "PROD-881"])
    ).delete(synchronize_session=False)
    session.query(ProductionOrderModel).filter(
        ProductionOrderModel.production_order_id.in_(["PROD-880", "PROD-881"])
    ).delete(synchronize_session=False)
    session.query(Supplier).filter_by(supplier_id="SUP-88").delete(synchronize_session=False)
    session.query(Component).filter_by(component_id="COMP-410").delete(synchronize_session=False)
    session.commit()


def seed_fixture(session):
    """Two production orders sharing COMP-410: PROD-880 (high priority,
    will be short) and PROD-881 (low priority, on_track — should be flagged
    as the deprioritization candidate)."""
    component = Component(
        component_id="COMP-410",
        name="Regulator IC",
        current_stock=200,
        usable_stock=200,
        daily_usage=50,
        safety_stock=80,
        warehouse="Pune-Plant-1",
        quality_threshold=0.80,
    )
    session.add(component)

    supplier = Supplier(
        supplier_id="SUP-88",
        supplier_name="Ratnagiri Semiconductors",
        component_id="COMP-410",
        unit_price=60,
        lead_time_days=4,
        available_quantity=500,
        quality_score=0.89,
        reliability_score=0.86,
        min_order_quantity=100,
        certifications=["ISO-9001"],
    )
    session.add(supplier)

    high_priority = ProductionOrderModel(
        production_order_id="PROD-880",
        product="Regulated Power Supply",
        required_component="COMP-410",
        units_planned=500,  # 500 needed, only 200 on hand -> 300 shortfall
        component_required_per_unit=1,
        deadline=TODAY + timedelta(days=8),
        priority="high",
        status="at_risk",
    )
    session.add(high_priority)

    low_priority = ProductionOrderModel(
        production_order_id="PROD-881",
        product="Non-Urgent Accessory Kit",
        required_component="COMP-410",
        units_planned=150,
        component_required_per_unit=1,
        deadline=TODAY + timedelta(days=25),  # plenty of slack, safe to delay
        priority="low",
        status="on_track",  # not already struggling — a fair candidate to deprioritize
    )
    session.add(low_priority)
    session.commit()

    disruption = DisruptionEvent(
        event_type="quantity_shortfall",
        po_id=None,
        production_order_id="PROD-880",
        raw_payload={
            "component_id": "COMP-410",
            "notes": "PROD-880 is short on COMP-410; a competing low-priority order also draws on it.",
        },
    )
    session.add(disruption)
    session.commit()
    return disruption.id


def main():
    init_db()
    session = get_session()
    try:
        cleanup_prior_run(session)  # safe even on a first run — deletes nothing if nothing's there
        print("Seeding reprioritization fixture (fresh rows, doesn't touch the 4 core scenarios)...")
        disruption_id = seed_fixture(session)

        state = run_disruption(disruption_id, session, secret_key=b"dev-secret-change-me")

        print(f"\nshortfall_units: {state['shortfall_units']} (expect 300)")
        print(f"computed_risk: {state['computed_risk']}")
        print(f"reprioritization_suggestion: {state.get('reprioritization_suggestion')}")

        assert state["shortfall_units"] == 300
        suggestion = state.get("reprioritization_suggestion")
        assert suggestion is not None, "Expected a reprioritization suggestion, got None"
        assert suggestion["production_order_id"] == "PROD-881"
        assert suggestion["priority"] == "low"

        print("\nPASS — correctly identified PROD-881 (low priority) as a deprioritization")
        print("candidate to protect PROD-880 (high priority), matching PS §8 Scenario 6.")

        if state.get("decision_brief"):
            print("\nDecision brief (should mention the reprioritization option):")
            print(state["decision_brief"]["text"])
    finally:
        session.close()


if __name__ == "__main__":
    main()

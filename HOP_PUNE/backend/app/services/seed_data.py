"""
Idempotent seed script implementing the four PS scenarios exactly per
Backend_Schema_Supply_Chain_Disruption_Agent_v2.md §4:

  1. Baseline delay          -> PO-7712 / COMP-104 / PROD-882, split-order recovery
  2. Adversarial claim       -> SUP-21 claims dispatch, tracking shows no pickup
  3. Budget escalation       -> PROD-901, only expensive expedite option available
  4. Stale inventory replan  -> COMP-104's current_stock vs usable_stock mismatch

Run: python -m app.services.seed_data
Safe to re-run: truncates and reseeds every time, so every rehearsal starts
from identical state (Implementation Plan v2 Phase 1 definition of done).
"""
import app.config  # noqa: F401 — loads .env before anything below reads os.environ
from datetime import date, timedelta

from app.db.models import (
    AuditLog,
    Component,
    Decision,
    DisruptionEvent,
    ProductionOrderModel,
    PurchaseOrder,
    RfqQuote,
    Supplier,
    SupplierMessage,
    TrackingEvent,
)
from app.db.session import get_session, init_db

TODAY = date(2026, 9, 1)

# Populated by seed_all() so tests/tools can reference each scenario's
# disruption_events.id without re-querying by a magic string.
DISRUPTION_IDS: dict[str, str] = {}


def clear_all(session):
    # Order matters: children before parents, to respect FK constraints.
    for model in [
        AuditLog,
        Decision,
        RfqQuote,
        DisruptionEvent,
        TrackingEvent,
        SupplierMessage,
        ProductionOrderModel,
        PurchaseOrder,
        Supplier,
        Component,
    ]:
        session.query(model).delete()
    session.commit()


def seed_scenario_1_baseline(session):
    """Standard delay. Coverage shortfall on a high-priority order, resolved via
    a split order across SUP-42 and SUP-37, within the PO's approval threshold."""
    component = Component(
        component_id="COMP-104",
        name="Motor Driver IC",
        current_stock=390,
        usable_stock=390,
        daily_usage=90,
        safety_stock=150,
        warehouse="Pune-Plant-1",
        quality_threshold=0.80,
    )
    session.add(component)

    sup21 = Supplier(
        supplier_id="SUP-21",
        supplier_name="Original Components Co",
        component_id="COMP-104",
        unit_price=118,
        lead_time_days=3,
        available_quantity=1000,
        quality_score=0.90,
        reliability_score=0.85,
        min_order_quantity=100,
        certifications=["ISO-9001"],
    )
    sup42 = Supplier(
        supplier_id="SUP-42",
        supplier_name="Western Components Ltd",
        component_id="COMP-104",
        unit_price=136,
        lead_time_days=4,
        available_quantity=700,
        quality_score=0.94,
        reliability_score=0.81,
        min_order_quantity=300,
        certifications=["ISO-9001", "Automotive-Grade"],
    )
    sup37 = Supplier(
        supplier_id="SUP-37",
        supplier_name="Northline Parts",
        component_id="COMP-104",
        unit_price=129,
        lead_time_days=6,
        available_quantity=400,
        quality_score=0.88,
        reliability_score=0.90,
        min_order_quantity=100,
        certifications=["ISO-9001"],
    )
    session.add_all([sup21, sup42, sup37])

    po = PurchaseOrder(
        po_id="PO-7712",
        component_id="COMP-104",
        supplier_id="SUP-21",
        quantity=1000,
        expected_delivery=TODAY + timedelta(days=3),
        status="delayed",
        unit_price=118,
        total_value=118000,
        approval_required_above=150000,
    )
    session.add(po)

    prod = ProductionOrderModel(
        production_order_id="PROD-882",
        product="Smart Controller Unit",
        required_component="COMP-104",
        units_planned=700,
        component_required_per_unit=1,
        deadline=TODAY + timedelta(days=7),
        priority="high",
        status="at_risk",
    )
    session.add(prod)
    session.commit()

    disruption = DisruptionEvent(
        event_type="delay",
        po_id="PO-7712",
        production_order_id="PROD-882",
        raw_payload={
            "component_id": "COMP-104",
            "notes": "Supplier reports 5-7 day delay due to transport issues.",
        },
    )
    session.add(disruption)
    session.commit()
    DISRUPTION_IDS["scenario_1_baseline"] = disruption.id


def seed_scenario_3_adversarial_claim(session):
    """SUP-21 claims dispatch on PO-7712; tracking shows only a label was
    created, no pickup occurred. Reuses PO-7712 from Scenario 1."""
    msg = SupplierMessage(
        direction="inbound",
        supplier_id="SUP-21",
        po_id="PO-7712",
        subject="Re: PO-7712 status",
        body="Good news — your shipment has been dispatched and is on its way.",
    )
    session.add(msg)

    tracking = TrackingEvent(
        po_id="PO-7712",
        supplier_claim="dispatched",
        tracking_status="label_created_no_pickup",
        last_movement=None,
    )
    session.add(tracking)
    session.commit()

    disruption = DisruptionEvent(
        event_type="supplier_claim_mismatch",
        po_id="PO-7712",
        production_order_id="PROD-882",
        raw_payload={
            "component_id": "COMP-104",
            "notes": "Supplier SUP-21 claims dispatch; tracking shows no pickup.",
        },
    )
    session.add(disruption)
    session.commit()
    DISRUPTION_IDS["scenario_3_adversarial_claim"] = disruption.id


def seed_scenario_5_budget_escalation(session):
    """A second, tighter-deadline production order where only an expensive
    expedited supplier can meet the timeline, pushing cost past the PO's
    approval threshold."""
    sup99 = Supplier(
        supplier_id="SUP-99",
        supplier_name="RapidSource Express",
        component_id="COMP-104",
        unit_price=230,
        lead_time_days=2,
        available_quantity=700,
        quality_score=0.90,
        reliability_score=0.75,
        min_order_quantity=100,
        certifications=["ISO-9001"],
        expedite_available=True,
        expedite_fee=8000,
    )
    session.add(sup99)

    prod = ProductionOrderModel(
        production_order_id="PROD-901",
        product="Rapid-Deploy Sensor Array",
        required_component="COMP-104",
        units_planned=700,
        component_required_per_unit=1,
        deadline=TODAY + timedelta(days=2),  # only SUP-99's 2-day lead time can meet this
        priority="high",
        status="at_risk",
    )
    session.add(prod)

    po = PurchaseOrder(
        po_id="PO-9021",
        component_id="COMP-104",
        supplier_id="SUP-99",
        quantity=700,
        expected_delivery=TODAY + timedelta(days=2),
        status="at_risk",
        unit_price=230,
        total_value=161000,
        approval_required_above=50000,  # Originally set to 150000 assuming the recovery
        # cost would be based on the full 700-unit order (700*230=161000). That was wrong:
        # shortfall_units is correctly computed as only the GAP beyond existing usable_stock
        # (310 units, not 700), so the real recovery cost is 310*230=71300 — which never
        # exceeded the old threshold, so this scenario never actually escalated. Caught live
        # by running it and getting auto_executed instead of pending_approval. Lowered so a
        # correctly-computed $71,300 recovery genuinely trips this PO's approval threshold —
        # narratively justified as a tighter autonomous limit on an already-expedited/premium
        # rush order.
    )
    session.add(po)
    session.commit()

    disruption = DisruptionEvent(
        event_type="quantity_shortfall",
        po_id="PO-9021",
        production_order_id="PROD-901",
        raw_payload={
            "component_id": "COMP-104",
            "notes": "PROD-901 has a 2-day deadline; only expedited sourcing can meet it.",
        },
    )
    session.add(disruption)
    session.commit()
    DISRUPTION_IDS["scenario_5_budget_escalation"] = disruption.id


def seed_scenario_2_stale_inventory(session):
    """
    The replanning scenario. Uses its OWN component/production order/supplier
    (COMP-205 / PROD-950 / SUP-77) — NOT a reuse of COMP-104 — because the
    original version of this seed mutated COMP-104's usable_stock directly,
    which would have corrupted the shortfall math for Scenarios 1/3/5 if this
    were ever exercised through a live agent run instead of just hand-checked.

    This models a genuine two-phase replan, not a within-function loop:
      Phase 1: seed usable_stock=800 (matches current_stock — ERP not yet
               corrected). A "routine check" disruption on PROD-950 runs
               through the live agent, finds no shortfall (800 >= 700 needed),
               concludes Low risk, auto-executes a no-op plan. This is
               Decision A.
      Phase 2: POST /components/COMP-205/correct (new endpoint) updates
               usable_stock to the true 390, automatically creates a
               "data_correction" disruption for the same production order,
               and triggers a second live agent run. This run correctly finds
               a 310-unit shortfall, High risk, and produces a real recovery
               plan — Decision B, with replan_of pointing back to Decision A.

    Only Phase 1's disruption is seeded here; Phase 2 happens live via the
    new /components/{id}/correct endpoint (see app/api/inventory.py) — either
    triggered from the dashboard or by run_replan_scenario.py for scripted
    testing.
    """
    component = Component(
        component_id="COMP-205",
        name="Pressure Sensor Module",
        current_stock=800,
        usable_stock=800,  # WRONG on purpose — matches current_stock, i.e. not yet corrected
        daily_usage=70,
        safety_stock=100,
        warehouse="Pune-Plant-2",
        quality_threshold=0.80,
    )
    session.add(component)

    sup77 = Supplier(
        supplier_id="SUP-77",
        supplier_name="Deccan Sensor Systems",
        component_id="COMP-205",
        unit_price=95,
        lead_time_days=5,
        available_quantity=600,
        quality_score=0.88,
        reliability_score=0.87,
        min_order_quantity=100,
        certifications=["ISO-9001"],
    )
    session.add(sup77)

    prod = ProductionOrderModel(
        production_order_id="PROD-950",
        product="Pressure Monitoring Unit",
        required_component="COMP-205",
        units_planned=700,
        component_required_per_unit=1,
        deadline=TODAY + timedelta(days=10),
        priority="high",
        status="on_track",  # looks fine on the (wrong) 800-unit figure
    )
    session.add(prod)
    session.commit()

    disruption = DisruptionEvent(
        event_type="delay",  # routine trigger — a minor upstream delay prompts a coverage check
        po_id=None,
        production_order_id="PROD-950",
        raw_payload={
            "component_id": "COMP-205",
            "notes": "Routine coverage check triggered by a minor upstream schedule shift.",
        },
    )
    session.add(disruption)
    session.commit()
    DISRUPTION_IDS["scenario_2_stale_inventory"] = disruption.id


def seed_all():
    init_db()
    session = get_session()
    try:
        clear_all(session)
        seed_scenario_1_baseline(session)
        seed_scenario_3_adversarial_claim(session)
        seed_scenario_5_budget_escalation(session)
        seed_scenario_2_stale_inventory(session)
        print("Seeded all 4 PS scenarios successfully.")
        print("Disruption IDs:", DISRUPTION_IDS)
    finally:
        session.close()


if __name__ == "__main__":
    seed_all()

"""
Scripted test of the full replanning flow, without needing the frontend.
Runs Phase 1 (stale data, Low risk, no-op decision), applies the correction
directly against the DB (same effect as POST /components/COMP-205/correct),
then runs Phase 2 and confirms the replan linkage is correct.

Usage: python run_replan_scenario.py
"""
import json

import app.config  # noqa: F401 — loads .env

from app.agent.graph import run_disruption
from app.db.models import Component, Decision, DisruptionEvent
from app.db.session import get_session
from app.services import seed_data


def main():
    print("Seeding fresh...")
    seed_data.seed_all()
    phase1_disruption_id = seed_data.DISRUPTION_IDS["scenario_2_stale_inventory"]

    session = get_session()
    try:
        print(f"\n=== PHASE 1: routine check on stale data (disruption {phase1_disruption_id}) ===")
        state1 = run_disruption(phase1_disruption_id, session, secret_key=b"dev-secret-change-me")
        print(f"  computed_risk: {state1['computed_risk']}")
        print(f"  shortfall_units: {state1['shortfall_units']}")
        print(f"  status: {state1.get('execution_status') or ('pending_approval' if state1['requires_approval'] else '?')}")
        print(f"  decision_id: {state1['decision_id']}")

        assert state1["shortfall_units"] == 0, "Phase 1 should show NO shortfall on the stale 800-unit figure"
        assert state1["computed_risk"] == "Low", f"Expected Low risk on stale data, got {state1['computed_risk']}"
        decision1_id = state1["decision_id"]

        print("\n=== Applying correction: usable_stock 800 -> 390 ===")
        component = session.query(Component).filter_by(component_id="COMP-205").first()
        component.usable_stock = 390
        session.commit()

        correction_disruption = DisruptionEvent(
            event_type="data_correction",
            po_id=None,
            production_order_id="PROD-950",
            raw_payload={
                "component_id": "COMP-205",
                "notes": "Warehouse recount corrected usable stock from 800 to 390.",
            },
        )
        session.add(correction_disruption)
        session.commit()
        session.refresh(correction_disruption)

        print(f"\n=== PHASE 2: replan on corrected data (disruption {correction_disruption.id}) ===")
        state2 = run_disruption(correction_disruption.id, session, secret_key=b"dev-secret-change-me")
        print(f"  computed_risk: {state2['computed_risk']}")
        print(f"  shortfall_units: {state2['shortfall_units']}")
        print(f"  status: {state2.get('execution_status') or ('pending_approval' if state2['requires_approval'] else '?')}")
        print(f"  decision_id: {state2['decision_id']}")
        print("\n  reasoning_trace:")
        for line in state2["reasoning_trace"]:
            print(f"    - {line}")

        assert state2["shortfall_units"] == 310, f"Expected 310-unit shortfall, got {state2['shortfall_units']}"
        assert state2["computed_risk"] in ("High", "Critical")

        print("\n=== Verifying replan linkage in the database ===")
        session.expire_all()
        decision1 = session.query(Decision).filter_by(id=decision1_id).first()
        decision2 = session.query(Decision).filter_by(id=state2["decision_id"]).first()

        print(f"  Decision 1 status: {decision1.status} (expect 'replanned')")
        print(f"  Decision 2 replan_of: {decision2.replan_of} (expect '{decision1_id}')")

        assert decision1.status == "replanned", f"Decision 1 should be marked replanned, got {decision1.status}"
        assert decision2.replan_of == decision1_id, "Decision 2 should link back to Decision 1"

        print("\n=== ALL REPLAN CHECKS PASSED ===")
    finally:
        session.close()


if __name__ == "__main__":
    main()

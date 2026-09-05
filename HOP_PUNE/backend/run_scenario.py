"""
Seeds fresh, then runs one specific named scenario through the real agent
graph, so you can test the escalation/adversarial paths individually instead
of always getting whichever disruption happens to be first in the table.

Usage:
    python run_scenario.py scenario_1_baseline
    python run_scenario.py scenario_3_adversarial_claim
    python run_scenario.py scenario_5_budget_escalation
    python run_scenario.py scenario_2_stale_inventory

NOTE on scenario_2_stale_inventory: this now only runs PHASE 1 of the
replanning flow (the routine check on stale data — correctly shows
shortfall_units=0 and computed_risk=Low, since 800 >= 700 needed). That's the
CORRECT result for this scenario alone, not a bug — Phase 1 is deliberately
supposed to look fine on the wrong data. For the FULL two-phase replan
(including the correction and the resulting supersession), use
run_replan_scenario.py instead, which runs both phases and asserts the
replan_of linkage.
"""
import json
import sys

import app.config  # noqa: F401 — loads .env

from app.agent.graph import run_disruption
from app.db.session import get_session
from app.services import seed_data


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {
        "scenario_1_baseline",
        "scenario_3_adversarial_claim",
        "scenario_5_budget_escalation",
        "scenario_2_stale_inventory",
    }:
        print(__doc__)
        sys.exit(1)

    scenario_key = sys.argv[1]

    print(f"Seeding fresh, then running: {scenario_key}\n")
    seed_data.seed_all()
    disruption_id = seed_data.DISRUPTION_IDS[scenario_key]

    session = get_session()
    try:
        # NOTE: today is intentionally omitted here so run_disruption() uses its
        # own default (seed_data.TODAY, the fixed seed epoch) — NOT date.today().
        # An earlier version of this script explicitly passed today=date.today(),
        # which silently overrode that default and reintroduced the exact
        # wall-clock/seed-epoch mismatch bug that was already fixed once in
        # graph.py. Caught live: Scenario 5's deadline check passed a candidate
        # that should have failed, because ETA was computed against the real
        # current date instead of the date the seeded deadlines are anchored to.
        result_state = run_disruption(
            disruption_id, session, secret_key=b"dev-secret-change-me"
        )
        print(json.dumps(result_state, indent=2, default=str))

        print("\n--- Quick summary ---")
        print(f"computed_risk: {result_state['computed_risk']}")
        print(f"requires_approval: {result_state['requires_approval']}")
        print(f"execution_status: {result_state.get('execution_status')}")
        if result_state.get("decision_brief"):
            print(f"decision_brief: {result_state['decision_brief']['text']}")
    finally:
        session.close()


if __name__ == "__main__":
    main()

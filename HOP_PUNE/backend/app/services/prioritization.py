"""
Cross-production-order prioritization. PS §8 Scenario 6: "Prioritize
critical production orders... delay lower-priority production if necessary."

Scope, stated honestly: this does NOT model true shared-inventory reservation
across orders (that would require tracking which order has a "claim" on
which units of a shared component pool — a deeper schema change than time
allowed). What it DOES do: when a high-priority order is short, deterministically
find lower-priority orders competing for the SAME component, and propose
delaying the least-critical one — surfaced as a real option in the decision
brief, actionable via POST /production-orders/{id}/reschedule, not just
mentioned and forgotten.
"""
from dataclasses import dataclass
from datetime import date

PRIORITY_RANK = {"low": 0, "medium": 1, "high": 2}


@dataclass
class ReprioritizationCandidate:
    production_order_id: str
    priority: str
    units_planned: int
    current_deadline: date
    suggested_new_deadline: date


def find_deprioritizable_orders(
    competing_orders: list[dict],
    protected_priority: str,
    delay_days: int = 5,
) -> list[ReprioritizationCandidate]:
    """
    competing_orders: dicts with production_order_id, priority, units_planned,
    deadline, status — already filtered to the same component_id and
    excluding the protected order itself (caller's responsibility, since this
    function is pure and doesn't touch the DB).

    Returns candidates ranked lowest-priority-first — the best candidate to
    delay is the one whose own priority is furthest below the protected
    order's, and which isn't already at risk itself.
    """
    protected_rank = PRIORITY_RANK.get(protected_priority, 2)

    candidates = [
        c
        for c in competing_orders
        if PRIORITY_RANK.get(c["priority"], 2) < protected_rank
        and c.get("status") == "on_track"  # don't deprioritize an order that's already struggling
    ]
    candidates.sort(key=lambda c: PRIORITY_RANK.get(c["priority"], 2))

    return [
        ReprioritizationCandidate(
            production_order_id=c["production_order_id"],
            priority=c["priority"],
            units_planned=c["units_planned"],
            current_deadline=c["deadline"],
            suggested_new_deadline=_push_deadline(c["deadline"], delay_days),
        )
        for c in candidates
    ]


def _push_deadline(current: date, delay_days: int) -> date:
    from datetime import timedelta

    return current + timedelta(days=delay_days)

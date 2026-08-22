"""
Deterministic constraint validation. Pure Python, never an LLM call.

Principle carried over from prior projects: the LLM chooses among ALREADY-VALIDATED
candidates and explains the choice — it never decides pass/fail on budget, quality,
MOQ, safety stock, or deadline itself. This is what makes "how did the agent decide
X was acceptable" a defensible, demoable answer under judge questioning.

See: Backend_Schema_Supply_Chain_Disruption_Agent_v2.md §2.2-2.4
     TRD_Supply_Chain_Disruption_Agent_v2.md §7
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional


@dataclass
class SupplierCandidate:
    supplier_id: str
    quantity_offered: int
    min_order_quantity: int
    unit_price: Decimal
    lead_time_days: int
    quality_score: float
    reliability_score: float
    certifications: list[str] = field(default_factory=list)


def validate_candidate(
    candidate: SupplierCandidate,
    quality_threshold: float,
    deadline: date,
    today: date,
) -> list[str]:
    """Returns a list of violation strings. Empty list = candidate passes all checks."""
    violations: list[str] = []

    if candidate.quantity_offered < candidate.min_order_quantity:
        violations.append(
            f"Below MOQ: supplier requires {candidate.min_order_quantity}, "
            f"offer covers {candidate.quantity_offered}"
        )

    if candidate.quality_score < quality_threshold:
        violations.append(
            f"Quality score {candidate.quality_score:.2f} below required "
            f"threshold {quality_threshold:.2f}"
        )

    eta = today + timedelta(days=candidate.lead_time_days)
    if eta > deadline:
        violations.append(
            f"ETA {eta.isoformat()} misses production deadline {deadline.isoformat()}"
        )

    return violations


def validate_plan_cost(
    total_cost: Decimal,
    approval_required_above: Decimal,
) -> tuple[bool, Optional[str]]:
    """Returns (requires_approval, reason)."""
    if total_cost > approval_required_above:
        return True, (
            f"Total recovery cost {total_cost} exceeds this PO's approval "
            f"threshold of {approval_required_above}"
        )
    return False, None


def validate_safety_stock(
    usable_stock: int,
    safety_stock: int,
    units_consumed_by_plan: int,
) -> tuple[bool, Optional[str]]:
    """
    Returns (requires_approval, reason). A plan that would draw inventory below
    safety stock needs an explicit human justification, not a silent auto-execute.
    """
    remaining_after_plan = usable_stock - units_consumed_by_plan
    if remaining_after_plan < safety_stock:
        return True, (
            f"Plan would leave {remaining_after_plan} units, below safety stock "
            f"floor of {safety_stock} — requires justification/approval"
        )
    return False, None


def validate_all_candidates(
    candidates: list[SupplierCandidate],
    quality_threshold: float,
    deadline: date,
    today: date,
) -> dict[str, list[str]]:
    """Convenience wrapper: supplier_id -> violations list, for a batch of candidates."""
    return {
        c.supplier_id: validate_candidate(c, quality_threshold, deadline, today)
        for c in candidates
    }

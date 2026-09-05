"""
Weighted multi-criteria supplier scoring, plus split-order allocation.

Fixed, published weights — not an LLM "vibe rank". Directly defensible under
"Tool Efficiency" / "Cost Control" judging: "why SUP-42 over SUP-37" always has
a numeric answer.

See: TRD_Supply_Chain_Disruption_Agent_v2.md §6
     PRD_Supply_Chain_Disruption_Agent_v2.md §8 (split orders)
"""
from dataclasses import dataclass
from decimal import Decimal

from app.services.constraints import SupplierCandidate

WEIGHTS = {
    "price": Decimal("0.30"),        # lower price = better
    "lead_time": Decimal("0.25"),    # shorter lead time = better
    "reliability": Decimal("0.25"),  # higher = better
    "quality": Decimal("0.20"),      # higher = better
}

TRUST_PENALTY = Decimal("0.15")  # applied to reliability component if claim was contradicted


@dataclass
class ScoredCandidate:
    candidate: SupplierCandidate
    score: float
    trust_penalized: bool


def score_candidate(
    candidate: SupplierCandidate,
    baseline_price: Decimal,
    max_lead_time_days: int,
    trust_penalized: bool = False,
) -> ScoredCandidate:
    """
    trust_penalized=True means verify_claim caught this supplier contradicting
    tracking data on THIS transaction — reliability is discounted for this
    decision only, never mutated on the supplier's master record (Backend
    Schema v2 §2.2's note on why the penalty lives at scoring time).
    """
    price_score = max(Decimal("0"), 1 - (candidate.unit_price / baseline_price))
    lead_score = max(
        Decimal("0"),
        1 - (Decimal(candidate.lead_time_days) / Decimal(max(max_lead_time_days, 1))),
    )
    reliability = Decimal(str(candidate.reliability_score))
    if trust_penalized:
        reliability = max(Decimal("0"), reliability - TRUST_PENALTY)
    quality = Decimal(str(candidate.quality_score))

    composite = (
        WEIGHTS["price"] * price_score
        + WEIGHTS["lead_time"] * lead_score
        + WEIGHTS["reliability"] * reliability
        + WEIGHTS["quality"] * quality
    )
    return ScoredCandidate(
        candidate=candidate,
        score=float(round(composite, 4)),
        trust_penalized=trust_penalized,
    )


def rank_candidates(scored: list[ScoredCandidate]) -> list[ScoredCandidate]:
    return sorted(scored, key=lambda s: s.score, reverse=True)


@dataclass
class Allocation:
    supplier_id: str
    quantity: int
    unit_price: Decimal
    lead_time_days: int


@dataclass
class RecoveryPlan:
    allocations: list[Allocation]
    total_cost: Decimal
    covers_shortfall: bool
    max_lead_time_days: int


def build_recovery_plan(
    ranked_valid_candidates: list[ScoredCandidate],
    shortfall_units: int,
) -> RecoveryPlan:
    """
    Greedy allocation by descending score: take as much as possible from the
    best candidate, then the next, until the shortfall is covered or candidates
    run out. Produces a single-supplier plan when one candidate alone suffices —
    a split only happens when it's actually needed, matching PS §4.6's framing
    ("may involve splitting... instead of choosing a single vendor", not "always").
    """
    allocations: list[Allocation] = []
    remaining = shortfall_units
    total_cost = Decimal("0")
    max_lead = 0

    for scored in ranked_valid_candidates:
        if remaining <= 0:
            break
        c = scored.candidate
        take = min(remaining, c.quantity_offered)
        if take <= 0:
            continue
        allocations.append(
            Allocation(
                supplier_id=c.supplier_id,
                quantity=take,
                unit_price=c.unit_price,
                lead_time_days=c.lead_time_days,
            )
        )
        total_cost += Decimal(take) * c.unit_price
        max_lead = max(max_lead, c.lead_time_days)
        remaining -= take

    return RecoveryPlan(
        allocations=allocations,
        total_cost=total_cost,
        covers_shortfall=(remaining <= 0),
        max_lead_time_days=max_lead,
    )

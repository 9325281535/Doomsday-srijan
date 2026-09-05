"""
Verify a supplier's status claim against ground-truth tracking data.

This is the PS's signature "genuinely agentic, not gullible" behavior (PS §4.4, §8
Scenario 3, §14). Deliberately a narrow, explicit rule — not an LLM "does this sound
suspicious" judgment — so it never false-positives on an ordinary status update.

See: TRD_Supply_Chain_Disruption_Agent_v2.md §9
"""
from dataclasses import dataclass

# Claims that assert forward movement has happened
POSITIVE_MOVEMENT_CLAIMS = {"dispatched", "shipped", "in_transit", "out_for_delivery"}

# Ground-truth statuses that contradict a positive movement claim
NO_MOVEMENT_STATUSES = {"label_created_no_pickup", "no_movement", "pending_pickup"}


@dataclass
class ClaimVerificationResult:
    claim: str | None
    tracking_status: str
    contradicts: bool
    supplier_trusted: bool


def verify_claim(supplier_claim: str | None, tracking_status: str) -> ClaimVerificationResult:
    """
    Narrow, explicit contradiction rule: a claim of forward movement paired with a
    tracking status showing no movement is a contradiction. Anything else (no claim
    made, claim matches tracking, ambiguous claim) is NOT flagged — false positives
    here would undermine the product's core trust claim as much as false negatives.
    """
    if supplier_claim is None:
        return ClaimVerificationResult(
            claim=None, tracking_status=tracking_status, contradicts=False, supplier_trusted=True
        )

    claim_normalized = supplier_claim.strip().lower()
    contradicts = (
        claim_normalized in POSITIVE_MOVEMENT_CLAIMS
        and tracking_status in NO_MOVEMENT_STATUSES
    )

    return ClaimVerificationResult(
        claim=supplier_claim,
        tracking_status=tracking_status,
        contradicts=contradicts,
        supplier_trusted=not contradicts,
    )

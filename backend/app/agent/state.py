"""
LangGraph agent state. See TRD_Supply_Chain_Disruption_Agent_v2.md §3.

Every node reads/writes this dict. `reasoning_trace` is appended to by every
node with a plain-English line — concatenated at the end, this becomes the
audit narrative without a second "explain what happened" LLM pass.
"""
from decimal import Decimal
from typing import Literal, Optional, TypedDict


class CandidateDict(TypedDict):
    supplier_id: str
    quantity_offered: int
    unit_price: str  # Decimal serialized as str for JSON-safety in state
    lead_time_days: int
    quality_score: float
    reliability_score: float
    score: Optional[float]
    trust_penalized: bool
    constraint_violations: list[str]


class AllocationDict(TypedDict):
    supplier_id: str
    quantity: int
    unit_price: str
    lead_time_days: int


class RecoveryPlanDict(TypedDict):
    allocations: list[AllocationDict]
    total_cost: str
    covers_shortfall: bool
    max_lead_time_days: int


class AgentState(TypedDict):
    disruption_id: str
    event_type: Optional[str]
    computed_risk: Optional[Literal["Low", "Medium", "High", "Critical"]]

    affected_po_id: Optional[str]
    affected_production_order_id: Optional[str]
    affected_component_id: Optional[str]

    coverage_days: Optional[float]
    shortfall_units: Optional[int]

    original_supplier_claim: Optional[str]
    tracking_verification: Optional[dict]  # ClaimVerificationResult as dict, or None if skipped
    supplier_trusted: Optional[bool]

    candidates: list[CandidateDict]
    chosen_plan: Optional[RecoveryPlanDict]

    reasoning_trace: list[str]

    requires_approval: bool
    approval_reason: Optional[str]
    decision_brief: Optional[dict]

    contradiction_detected: bool
    replan_count: int

    execution_status: Optional[str]
    decision_id: Optional[str]
    tool_call_count: int
    reprioritization_suggestion: Optional[dict]


def new_state(disruption_id: str) -> AgentState:
    """Fresh state for a new disruption run."""
    return AgentState(
        disruption_id=disruption_id,
        event_type=None,
        computed_risk=None,
        affected_po_id=None,
        affected_production_order_id=None,
        affected_component_id=None,
        coverage_days=None,
        shortfall_units=None,
        original_supplier_claim=None,
        tracking_verification=None,
        supplier_trusted=None,
        candidates=[],
        chosen_plan=None,
        reasoning_trace=[],
        requires_approval=False,
        approval_reason=None,
        decision_brief=None,
        contradiction_detected=False,
        replan_count=0,
        execution_status=None,
        decision_id=None,
        tool_call_count=0,
        reprioritization_suggestion=None,
    )


MAX_REPLANS = 3  # TRD v2 §13 — hard cap so an adversarial hidden test can't loop the graph forever

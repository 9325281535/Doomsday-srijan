"""
Pydantic schemas for API request/response bodies. Kept separate from the
SQLAlchemy models (app/db/models.py) on purpose — DB models describe storage,
these describe the wire format, and the two shapes drift over time even when
they start out identical.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class DisruptionCreateRequest(BaseModel):
    event_type: str
    po_id: Optional[str] = None
    production_order_id: Optional[str] = None
    raw_payload: dict[str, Any]


class DisruptionResponse(BaseModel):
    id: str
    event_type: str
    po_id: Optional[str]
    production_order_id: Optional[str]
    computed_risk: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DecisionResponse(BaseModel):
    id: str
    disruption_id: str
    production_order_id: Optional[str]
    candidates_json: Any
    constraint_results_json: Any
    chosen_plan_json: Optional[Any]
    reasoning_text: str
    decision_brief_json: Optional[Any]
    status: str
    approver_id: Optional[str]
    replan_of: Optional[str]
    tool_call_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalActionRequest(BaseModel):
    approver_id: str


class SupplierMessageResponse(BaseModel):
    id: str
    direction: str
    supplier_id: str
    po_id: Optional[str]
    subject: Optional[str]
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: str
    decision_id: str
    actor: str
    action: str
    hash: str
    prev_hash: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChainVerificationResponse(BaseModel):
    valid: bool
    broken_at_index: Optional[int]
    total_entries: int

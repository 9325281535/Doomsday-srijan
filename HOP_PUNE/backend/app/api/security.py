from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services import security

router = APIRouter(prefix="/security", tags=["security"])

class LockRequest(BaseModel):
    actor: Optional[str] = "procurement_admin"

class BreakGlassRequest(BaseModel):
    actor: str
    reason: str
    duration_minutes: Optional[int] = 15

class IntentCheckRequest(BaseModel):
    query: str

@router.get("/status")
def get_status():
    return security.get_key_status()

@router.post("/lock")
def lock_data(body: LockRequest):
    return security.lock_enterprise_data(body.actor)

@router.post("/unlock")
def unlock_data(body: LockRequest):
    return security.unlock_enterprise_data(body.actor)

@router.post("/break-glass")
def break_glass(body: BreakGlassRequest):
    return security.request_break_glass(body.actor, body.reason, body.duration_minutes)

@router.get("/audit")
def get_audit():
    return security.get_security_audit_logs()

@router.post("/firewall/check")
def check_firewall(body: IntentCheckRequest):
    return security.check_intent_firewall(body.query)

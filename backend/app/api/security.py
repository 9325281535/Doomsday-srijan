"""
Security, KMS Key Control & Trust Fabric API Router.
Provides endpoints for Enterprise Lock/Unlock, Break-Glass Emergency access,
Intent Firewall prompt inspection, and Trust & Compliance control mappings.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.kms_vault import kms_vault
from app.services.intent_firewall import intent_firewall
from app.services.compliance_registry import get_compliance_controls

router = APIRouter(prefix="/security", tags=["Security & Trust Fabric"])


class LockRequest(BaseModel):
    actor: str = "Enterprise Security Admin"
    reason: str = "Manual Enterprise Kill-Switch Activated"


class UnlockRequest(BaseModel):
    actor: str = "Enterprise Security Admin"
    auth_token: str = "KMS-AUTH-CONFIRMED"


class BreakGlassRequest(BaseModel):
    approver1: str
    approver2: str
    reason: str
    duration_minutes: int = 15


class PromptInspectionRequest(BaseModel):
    prompt: str
    user_role: str = "Procurement Manager"
    purpose: Optional[str] = None


@router.get("/kms/status")
def get_kms_status():
    """Retrieve the current state of the customer-controlled encryption key."""
    return kms_vault.get_status()


@router.post("/kms/lock")
def lock_enterprise_kms(req: LockRequest):
    """
    Lock customer data access.
    Instantly revokes KMS key decryption, invalidates active sessions,
    flushes decryption caches, and blocks agent tools.
    """
    return kms_vault.lock_enterprise_data(actor=req.actor, reason=req.reason)


@router.post("/kms/unlock")
def unlock_enterprise_kms(req: UnlockRequest):
    """
    Re-authorize customer encryption key access.
    Restores agent data decryption and normal autonomous operations.
    """
    return kms_vault.unlock_enterprise_data(actor=req.actor, auth_token=req.auth_token)


@router.post("/kms/break-glass")
def break_glass_access(req: BreakGlassRequest):
    """
    Trigger emergency break-glass dual authorization protocol.
    Requires two distinct authorized approvers with strict scope and time-limit.
    """
    res = kms_vault.request_break_glass(
        approver1=req.approver1,
        approver2=req.approver2,
        reason=req.reason,
        duration_minutes=req.duration_minutes
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res["message"])
    return res


@router.post("/firewall/inspect")
def inspect_user_prompt(req: PromptInspectionRequest):
    """
    Live evaluation of user/agent prompts through the Intent Firewall.
    Blocks over-broad extraction requests and generates purpose-bound access tickets.
    """
    return intent_firewall.inspect_prompt(
        prompt=req.prompt,
        user_role=req.user_role,
        purpose=req.purpose
    )


@router.get("/compliance/controls")
def get_compliance_mappings():
    """
    Returns live control mappings and cryptographic evidence for
    ISO/IEC 27001, GDPR Article 32, and India DPDP framework.
    """
    return get_compliance_controls()


class EncryptTestRequest(BaseModel):
    plaintext: str


class DecryptTestRequest(BaseModel):
    iv: str
    ciphertext: str


@router.post("/crypto/encrypt")
def encrypt_data_endpoint(req: EncryptTestRequest):
    """Real AES-256-GCM encryption with wrapped DEK."""
    try:
        return kms_vault.encrypt_data(req.plaintext)
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))


@router.post("/crypto/decrypt")
def decrypt_data_endpoint(req: DecryptTestRequest):
    """Real AES-256-GCM decryption. Fails if enterprise KMS key is locked."""
    try:
        decrypted_text = kms_vault.decrypt_data(req.iv, req.ciphertext)
        return {"success": True, "plaintext": decrypted_text}
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decryption failed: {e}")


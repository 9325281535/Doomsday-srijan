"""
Audit endpoints. TRD v2 §10. /verify walks the hash chain and recomputes each
hash — this is the endpoint behind the "snap the chain" demo moment (UI/UX v2
§4, Implementation Plan v2 Phase 8).
"""
import os

from fastapi import APIRouter

from app.api.schemas import AuditLogResponse, ChainVerificationResponse
from app.db.models import AuditLog
from app.db.session import get_session
from app.services.hashing import AuditEntry, verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_log():
    session = get_session()
    try:
        return session.query(AuditLog).order_by(AuditLog.created_at.asc()).all()
    finally:
        session.close()


@router.get("/verify", response_model=ChainVerificationResponse)
def verify_audit_chain():
    session = get_session()
    try:
        rows = session.query(AuditLog).order_by(AuditLog.created_at.asc()).all()
        entries = [
            AuditEntry(
                decision_id=r.decision_id,
                actor=r.actor,
                action=r.action,
                hash=r.hash,
                prev_hash=r.prev_hash,
            )
            for r in rows
        ]
        secret_key = os.environ.get("AUDIT_HMAC_KEY", "dev-secret-change-me").encode()
        result = verify_chain(entries, secret_key)
        return ChainVerificationResponse(
            valid=result.valid,
            broken_at_index=result.broken_at_index,
            total_entries=len(entries),
        )
    finally:
        session.close()

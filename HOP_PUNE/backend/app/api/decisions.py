"""
Decision endpoints. TRD v2 §10. Approve/reject are the two actions a
coordinator takes from the Approval Queue screen (App Flow v2 §4).
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import ApprovalActionRequest, DecisionResponse
from app.api.ws import manager
from app.db.models import AuditLog, Decision, ProductionOrderModel
from app.db.session import get_session
from app.services.hashing import append_entry
import asyncio
import os

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.get("", response_model=list[DecisionResponse])
def list_decisions(status: str | None = None):
    session = get_session()
    try:
        q = session.query(Decision).order_by(Decision.created_at.desc())
        if status:
            q = q.filter(Decision.status == status)
        return q.all()
    finally:
        session.close()


@router.get("/{decision_id}", response_model=DecisionResponse)
def get_decision(decision_id: str):
    session = get_session()
    try:
        row = session.query(Decision).filter_by(id=decision_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Decision not found")
        return row
    finally:
        session.close()


def _write_audit_entry(session: Session, decision_id: str, actor: str, action: str) -> None:
    secret_key = os.environ.get("AUDIT_HMAC_KEY", "dev-secret-change-me").encode()
    last_entry = session.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    prev_hash = last_entry.hash if last_entry else None
    entry = append_entry(decision_id, actor, action, prev_hash, secret_key)
    session.add(
        AuditLog(
            decision_id=decision_id,
            actor=entry.actor,
            action=entry.action,
            hash=entry.hash,
            prev_hash=entry.prev_hash,
        )
    )


@router.post("/{decision_id}/approve", response_model=DecisionResponse)
async def approve_decision(decision_id: str, body: ApprovalActionRequest):
    session = get_session()
    try:
        decision = session.query(Decision).filter_by(id=decision_id).first()
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")
        if decision.status != "pending_approval":
            raise HTTPException(
                status_code=409,
                detail=f"Decision is '{decision.status}', not pending approval",
            )

        decision.status = "approved"
        decision.approver_id = body.approver_id

        if decision.production_order_id:
            prod = (
                session.query(ProductionOrderModel)
                .filter_by(production_order_id=decision.production_order_id)
                .first()
            )
            if prod:
                prod.status = "on_track"

        _write_audit_entry(session, decision_id, actor=body.approver_id, action="approved")
        session.commit()
        session.refresh(decision)

        await manager.broadcast(
            "status", {"decision_id": decision_id, "status": "approved", "approver_id": body.approver_id}
        )
        return decision
    finally:
        session.close()


@router.post("/{decision_id}/reject", response_model=DecisionResponse)
async def reject_decision(decision_id: str, body: ApprovalActionRequest):
    session = get_session()
    try:
        decision = session.query(Decision).filter_by(id=decision_id).first()
        if not decision:
            raise HTTPException(status_code=404, detail="Decision not found")
        if decision.status != "pending_approval":
            raise HTTPException(
                status_code=409,
                detail=f"Decision is '{decision.status}', not pending approval",
            )

        decision.status = "rejected"
        decision.approver_id = body.approver_id

        if decision.production_order_id:
            prod = (
                session.query(ProductionOrderModel)
                .filter_by(production_order_id=decision.production_order_id)
                .first()
            )
            if prod:
                prod.status = "at_risk"

        _write_audit_entry(session, decision_id, actor=body.approver_id, action="rejected")
        session.commit()
        session.refresh(decision)

        await manager.broadcast(
            "status", {"decision_id": decision_id, "status": "rejected", "approver_id": body.approver_id}
        )
        return decision
    finally:
        session.close()

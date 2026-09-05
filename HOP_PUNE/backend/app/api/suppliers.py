"""
Supplier trust memory endpoint. New in this session — see
db/models.py's SupplierTrustEvent docstring for why this exists as its own
table rather than relying on the per-decision trust_penalized flag.
"""
from fastapi import APIRouter
from sqlalchemy import func

from app.db.models import Supplier, SupplierTrustEvent
from app.db.session import get_session

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("/trust")
def trust_summary():
    """
    All suppliers with at least one contradiction on record, most-flagged
    first. Powers a "SUP-21: 2 claims contradicted — trust: LOW" style
    display — the persistent-memory demo beat that a per-decision-only
    trust flag can't show, since it doesn't survive across runs.
    """
    session = get_session()
    try:
        rows = (
            session.query(
                SupplierTrustEvent.supplier_id,
                func.count(SupplierTrustEvent.id).label("contradiction_count"),
            )
            .group_by(SupplierTrustEvent.supplier_id)
            .order_by(func.count(SupplierTrustEvent.id).desc())
            .all()
        )
        result = []
        for supplier_id, count in rows:
            supplier = session.query(Supplier).filter_by(supplier_id=supplier_id).first()
            result.append(
                {
                    "supplier_id": supplier_id,
                    "supplier_name": supplier.supplier_name if supplier else None,
                    "contradiction_count": count,
                    "trust_level": "LOW" if count >= 2 else "MODERATE" if count == 1 else "OK",
                }
            )
        return result
    finally:
        session.close()


@router.get("/{supplier_id}/trust")
def supplier_trust_detail(supplier_id: str):
    """Full contradiction history for one supplier — the underlying events
    behind the summary count above."""
    session = get_session()
    try:
        events = (
            session.query(SupplierTrustEvent)
            .filter_by(supplier_id=supplier_id)
            .order_by(SupplierTrustEvent.created_at.desc())
            .all()
        )
        return {
            "supplier_id": supplier_id,
            "contradiction_count": len(events),
            "events": [
                {
                    "po_id": e.po_id,
                    "event_type": e.event_type,
                    "details": e.details,
                    "created_at": e.created_at.isoformat(),
                }
                for e in events
            ],
        }
    finally:
        session.close()

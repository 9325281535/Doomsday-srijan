"""
Supplier communication log endpoint. Backs the /suppliers Comms Log screen
(App Flow v2 §6, UI/UX v2 §5.5). Also cross-references tracking_events so the
frontend can render the "✓ Verified" / "✗ Contradicted" inline badge without
a second round-trip.
"""
from fastapi import APIRouter

from app.api.schemas import SupplierMessageResponse
from app.db.models import SupplierMessage, TrackingEvent
from app.db.session import get_session

router = APIRouter(prefix="/supplier-messages", tags=["supplier-messages"])


@router.get("", response_model=list[SupplierMessageResponse])
def list_supplier_messages(po_id: str | None = None, supplier_id: str | None = None):
    session = get_session()
    try:
        q = session.query(SupplierMessage).order_by(SupplierMessage.created_at.asc())
        if po_id:
            q = q.filter(SupplierMessage.po_id == po_id)
        if supplier_id:
            q = q.filter(SupplierMessage.supplier_id == supplier_id)
        return q.all()
    finally:
        session.close()


@router.get("/verification/{po_id}")
def get_claim_verification(po_id: str):
    """Returns the tracking-vs-claim comparison for a PO, if any exists —
    what UI/UX v2 §5.5's inline message badge reads from."""
    session = get_session()
    try:
        tracking = (
            session.query(TrackingEvent)
            .filter_by(po_id=po_id)
            .order_by(TrackingEvent.created_at.desc())
            .first()
        )
        if not tracking:
            return {"po_id": po_id, "verified": None}

        from app.services.claim_verification import verify_claim

        result = verify_claim(tracking.supplier_claim, tracking.tracking_status)
        return {
            "po_id": po_id,
            "claim": result.claim,
            "tracking_status": result.tracking_status,
            "contradicts": result.contradicts,
            "verified": not result.contradicts,
        }
    finally:
        session.close()

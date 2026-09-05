"""
Production order rescheduling — the actionable counterpart to the
reprioritization_suggestion the agent proposes (nodes.py's
node_check_reprioritization). PS §8 Scenario 6: "delay low-priority
PROD-914 to preserve safety stock." This is what a coordinator actually
calls to accept that proposal.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.models import ProductionOrderModel
from app.db.session import get_session

router = APIRouter(prefix="/production-orders", tags=["production-orders"])


class RescheduleRequest(BaseModel):
    new_deadline: str  # ISO date string
    reason: str = "Deprioritized to free component contention for a higher-priority order."


@router.post("/{production_order_id}/reschedule")
def reschedule_production_order(production_order_id: str, body: RescheduleRequest):
    from datetime import date

    session = get_session()
    try:
        order = (
            session.query(ProductionOrderModel)
            .filter_by(production_order_id=production_order_id)
            .first()
        )
        if not order:
            raise HTTPException(status_code=404, detail=f"No production order {production_order_id}")

        old_deadline = order.deadline.isoformat()
        order.deadline = date.fromisoformat(body.new_deadline)
        order.status = "rescheduled"
        session.commit()

        return {
            "production_order_id": production_order_id,
            "old_deadline": old_deadline,
            "new_deadline": body.new_deadline,
            "status": "rescheduled",
            "reason": body.reason,
        }
    finally:
        session.close()

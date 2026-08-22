"""
Inventory correction endpoint — Phase 2 of the replanning scenario
(Backend_Schema_Supply_Chain_Disruption_Agent_v2.md §4 Scenario 2).

Not in the original TRD v2 §10 endpoint table — added because implementing
real replanning required a genuine second event to react to, not just a
within-function loop. See seed_data.py's seed_scenario_2_stale_inventory()
docstring for the full two-phase design rationale.
"""
import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.api.events import _run_and_broadcast
from app.api.ws import manager
from app.db.models import Component, DisruptionEvent, ProductionOrderModel
from app.db.session import get_session

router = APIRouter(prefix="/components", tags=["inventory"])


class InventoryCorrectionRequest(BaseModel):
    usable_stock: int
    production_order_id: str
    notes: str = "Warehouse recount corrected the usable stock figure."


@router.post("/{component_id}/correct")
async def correct_inventory(
    component_id: str, body: InventoryCorrectionRequest, background_tasks: BackgroundTasks
):
    session = get_session()
    try:
        component = session.query(Component).filter_by(component_id=component_id).first()
        if not component:
            raise HTTPException(status_code=404, detail=f"No component {component_id}")

        prod = (
            session.query(ProductionOrderModel)
            .filter_by(production_order_id=body.production_order_id)
            .first()
        )
        if not prod:
            raise HTTPException(
                status_code=404, detail=f"No production order {body.production_order_id}"
            )

        old_value = component.usable_stock
        component.usable_stock = body.usable_stock
        session.commit()

        # Automatically create and trigger the corrective disruption — mirrors
        # a real ERP correction prompting an immediate reassessment, rather
        # than requiring a second manual "inject disruption" click.
        disruption = DisruptionEvent(
            event_type="data_correction",
            po_id=None,
            production_order_id=body.production_order_id,
            raw_payload={
                "component_id": component_id,
                "notes": f"{body.notes} (was {old_value}, now {body.usable_stock}.)",
            },
        )
        session.add(disruption)
        session.commit()
        session.refresh(disruption)

        await manager.broadcast(
            "disruption_ingested",
            {"disruption_id": disruption.id, "event_type": disruption.event_type},
        )

        background_tasks.add_task(_run_and_broadcast, disruption.id)

        return {
            "component_id": component_id,
            "old_usable_stock": old_value,
            "new_usable_stock": body.usable_stock,
            "triggered_disruption_id": disruption.id,
        }
    finally:
        session.close()

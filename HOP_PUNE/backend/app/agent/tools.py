"""
The 9 agent tools per TRD_Supply_Chain_Disruption_Agent_v2.md §5, wired to
real DB queries against the models in app/db/models.py.

Each tool is a plain Python function (independently testable, no LLM needed)
AND wrapped with @tool so it can be bound to the Groq model for LLM-driven
tool selection in the `investigate`/`negotiate` nodes (PS §4.3 — the agent
chooses which tool to call, not a fixed script).
"""
from datetime import date, datetime, timezone
from typing import Optional

from langchain_core.tools import tool
from sqlalchemy.orm import Session

from app.db.models import (
    Component,
    ProductionOrderModel,
    PurchaseOrder,
    RfqQuote,
    Supplier,
    SupplierMessage,
    TrackingEvent,
)


# ---------------------------------------------------------------------------
# Plain functions — take an explicit `session`, called directly by nodes.py
# and wrapped below for LLM binding. Keeping the plain version separate means
# these are testable without any LangChain/LLM machinery at all.
# ---------------------------------------------------------------------------

def _get_inventory_status(session: Session, component_id: str) -> dict:
    c = session.query(Component).filter_by(component_id=component_id).first()
    if not c:
        return {"error": f"No component found with id {component_id}"}
    return {
        "component_id": c.component_id,
        "name": c.name,
        "current_stock": c.current_stock,
        "usable_stock": c.usable_stock,
        "daily_usage": c.daily_usage,
        "safety_stock": c.safety_stock,
        "quality_threshold": float(c.quality_threshold),
    }


def _get_purchase_order(session: Session, po_id: str) -> dict:
    po = session.query(PurchaseOrder).filter_by(po_id=po_id).first()
    if not po:
        return {"error": f"No purchase order found with id {po_id}"}
    return {
        "po_id": po.po_id,
        "component_id": po.component_id,
        "supplier_id": po.supplier_id,
        "quantity": po.quantity,
        "expected_delivery": po.expected_delivery.isoformat(),
        "status": po.status,
        "unit_price": float(po.unit_price),
        "total_value": float(po.total_value),
        "approval_required_above": float(po.approval_required_above),
    }


def _get_supplier_catalog(session: Session, component_id: str) -> list[dict]:
    suppliers = session.query(Supplier).filter_by(component_id=component_id).all()
    return [
        {
            "supplier_id": s.supplier_id,
            "supplier_name": s.supplier_name,
            "unit_price": float(s.unit_price),
            "lead_time_days": s.lead_time_days,
            "available_quantity": s.available_quantity,
            "quality_score": float(s.quality_score),
            "reliability_score": float(s.reliability_score),
            "min_order_quantity": s.min_order_quantity,
            "certifications": s.certifications,
            "expedite_available": s.expedite_available,
            "expedite_fee": float(s.expedite_fee) if s.expedite_fee is not None else None,
        }
        for s in suppliers
    ]


def _get_production_schedule(session: Session, component_id: str) -> list[dict]:
    orders = session.query(ProductionOrderModel).filter_by(required_component=component_id).all()
    return [
        {
            "production_order_id": p.production_order_id,
            "product": p.product,
            "units_planned": p.units_planned,
            "component_required_per_unit": p.component_required_per_unit,
            "deadline": p.deadline.isoformat(),
            "priority": p.priority,
            "status": p.status,
        }
        for p in orders
    ]


def _send_supplier_message(
    session: Session,
    supplier_id: str,
    subject: str,
    body: str,
    po_id: Optional[str] = None,
) -> dict:
    msg = SupplierMessage(
        direction="outbound",
        supplier_id=supplier_id,
        po_id=po_id,
        subject=subject,
        body=body,
    )
    session.add(msg)
    session.commit()
    return {"status": "sent", "supplier_id": supplier_id, "subject": subject}


def _request_rfq(
    session: Session,
    disruption_id: str,
    supplier_id: str,
    component_id: str,
    quantity: int,
    needed_by: Optional[str] = None,
) -> dict:
    """
    Simulated RFQ response. In this MVP, the 'quote' comes directly from the
    supplier's catalog row (available_quantity/unit_price/lead_time already
    seeded) rather than a live external call — matches Implementation Plan v2
    Phase 4's guidance to prefer scripted responses for reliability over an
    LLM-simulated supplier for the rehearsed scenarios.
    """
    supplier = session.query(Supplier).filter_by(supplier_id=supplier_id).first()
    if not supplier:
        return {"error": f"No supplier found with id {supplier_id}"}

    quote = RfqQuote(
        disruption_id=disruption_id,
        supplier_id=supplier_id,
        component_id=component_id,
        quantity_available=min(quantity, supplier.available_quantity),
        unit_price=supplier.unit_price,
        delivery_days=supplier.lead_time_days,
        expedite_available=supplier.expedite_available,
        expedite_fee=supplier.expedite_fee,
        quote_valid_hours=6,
    )
    session.add(quote)

    # Also log the inbound "reply" so it shows up in the comms log (App Flow v2 §6)
    reply = SupplierMessage(
        direction="inbound",
        supplier_id=supplier_id,
        po_id=None,
        subject=f"RFQ response — {component_id}",
        body=(
            f"We can supply {quote.quantity_available} units at "
            f"${quote.unit_price}/unit, {quote.delivery_days}-day lead time."
        ),
    )
    session.add(reply)
    session.commit()

    return {
        "supplier_id": supplier_id,
        "component_id": component_id,
        "quantity_available": quote.quantity_available,
        "unit_price": float(quote.unit_price),
        "delivery_days": quote.delivery_days,
        "expedite_available": quote.expedite_available,
        "expedite_fee": float(quote.expedite_fee) if quote.expedite_fee is not None else None,
    }


def _check_approval(session: Session, po_id: str, estimated_cost: float) -> dict:
    po = session.query(PurchaseOrder).filter_by(po_id=po_id).first()
    threshold = float(po.approval_required_above) if po else 150000.0
    requires = estimated_cost > threshold
    return {
        "action": "recovery_plan_execution",
        "estimated_cost": estimated_cost,
        "approval_required": requires,
        "approval_reason": (
            f"Cost {estimated_cost} exceeds autonomous threshold of {threshold}"
            if requires
            else None
        ),
    }


def _check_tracking(session: Session, po_id: str) -> dict:
    t = session.query(TrackingEvent).filter_by(po_id=po_id).order_by(
        TrackingEvent.created_at.desc()
    ).first()
    if not t:
        return {"po_id": po_id, "supplier_claim": None, "tracking_status": "no_data"}
    return {
        "po_id": t.po_id,
        "supplier_claim": t.supplier_claim,
        "tracking_status": t.tracking_status,
        "last_movement": t.last_movement.isoformat() if t.last_movement else None,
    }


def _update_erp(session: Session, action: str, payload: dict) -> dict:
    """
    Simulated ERP write. Per PS §18, this must stay simulated — never a real
    ERP integration. Actions: mark_delayed, create_recovery_po,
    update_production_status, record_escalation.
    """
    if action == "mark_delayed":
        po = session.query(PurchaseOrder).filter_by(po_id=payload["po_id"]).first()
        if po:
            po.status = "delayed"
    elif action == "update_production_status":
        prod = session.query(ProductionOrderModel).filter_by(
            production_order_id=payload["production_order_id"]
        ).first()
        if prod:
            prod.status = payload["status"]
    elif action == "create_recovery_po":
        # Simulated — in a fuller build this would insert a new PurchaseOrder row
        # per allocation in the chosen plan. Left as a log-only action for the MVP.
        pass
    elif action == "record_escalation":
        pass
    else:
        return {"error": f"Unknown ERP action: {action}"}

    session.commit()
    return {"status": "updated", "action": action, "payload": payload}


# ---------------------------------------------------------------------------
# LLM-bindable tool wrappers. A session is bound via closure at graph-build
# time (see graph.py's `build_tools(session)`), since LangChain tool schemas
# can't carry a raw SQLAlchemy Session as an LLM-visible argument.
# ---------------------------------------------------------------------------

def build_tools(session: Session, disruption_id: str) -> list:
    """Returns the list of @tool-wrapped callables bound to this session/run,
    ready to pass to `model.bind_tools(...)`."""
    from app.services.security import get_key_status

    def _guard_kms():
        status = get_key_status()
        if status.get("status") == "LOCKED":
            return {"error": "SECURITY_EXCEPTION: Enterprise Customer Key is LOCKED. Agent data access blocked by policy."}
        return None

    @tool
    def get_inventory_status(component_id: str) -> dict:
        """Get current/usable stock, daily usage, and safety stock for a component."""
        blocked = _guard_kms()
        if blocked:
            return blocked
        return _get_inventory_status(session, component_id)

    @tool
    def get_purchase_order(po_id: str) -> dict:
        """Get status, delivery date, and value of a purchase order."""
        return _get_purchase_order(session, po_id)

    @tool
    def get_supplier_catalog(component_id: str) -> list[dict]:
        """List suppliers who can provide a component, with price/lead-time/quality/reliability."""
        return _get_supplier_catalog(session, component_id)

    @tool
    def get_production_schedule(component_id: str) -> list[dict]:
        """Get production orders that depend on a component, with deadline and priority."""
        return _get_production_schedule(session, component_id)

    @tool
    def send_supplier_message(supplier_id: str, subject: str, body: str, po_id: str = "") -> dict:
        """Send a message to a supplier (e.g. request revised delivery date, challenge a claim)."""
        return _send_supplier_message(session, supplier_id, subject, body, po_id or None)

    @tool
    def request_rfq(supplier_id: str, component_id: str, quantity: int, needed_by: str = "") -> dict:
        """Request a quote from a supplier for a component, quantity, and needed delivery date."""
        return _request_rfq(session, disruption_id, supplier_id, component_id, quantity, needed_by or None)

    @tool
    def check_approval(po_id: str, estimated_cost: float) -> dict:
        """Check whether a proposed action requires human approval given its cost."""
        return _check_approval(session, po_id, estimated_cost)

    @tool
    def check_tracking(po_id: str) -> dict:
        """Verify a supplier's status claim against ground-truth tracking data."""
        return _check_tracking(session, po_id)

    @tool
    def update_erp(action: str, payload: dict) -> dict:
        """Write a simulated ERP update — mark PO delayed, create recovery PO,
        update production risk status, or record an escalation."""
        return _update_erp(session, action, payload)

    return [
        get_inventory_status,
        get_purchase_order,
        get_supplier_catalog,
        get_production_schedule,
        send_supplier_message,
        request_rfq,
        check_approval,
        check_tracking,
        update_erp,
    ]

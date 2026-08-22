"""
SQLAlchemy models matching Backend_Schema_Supply_Chain_Disruption_Agent_v2.md §2.

Uses generic JSON (not JSONB) and JSON-encoded lists (not native ARRAY) so this
same file works against SQLite for local dev/testing AND Postgres/Neon in
production without dialect-specific branching. On Postgres this creates plain
`json` columns rather than `jsonb` — fine for hackathon scope; swap to
`sqlalchemy.dialects.postgresql.JSONB` later if you need indexed JSON queries.
"""
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Component(Base):
    __tablename__ = "components"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    component_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    current_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    usable_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    daily_usage: Mapped[int] = mapped_column(Integer, nullable=False)
    safety_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    warehouse: Mapped[str] = mapped_column(String, nullable=False)
    quality_threshold: Mapped[float] = mapped_column(Numeric(3, 2), default=0.80, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    supplier_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(String, nullable=False)
    component_id: Mapped[str] = mapped_column(
        String, ForeignKey("components.component_id"), nullable=False
    )
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    available_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_score: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False)
    reliability_score: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False)
    min_order_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    certifications: Mapped[list] = mapped_column(JSON, default=list)
    expedite_available: Mapped[bool] = mapped_column(default=False)
    expedite_fee: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    po_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    component_id: Mapped[str] = mapped_column(
        String, ForeignKey("components.component_id"), nullable=False
    )
    supplier_id: Mapped[str] = mapped_column(
        String, ForeignKey("suppliers.supplier_id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_delivery: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total_value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    approval_required_above: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_transit','delayed','delivered','at_risk','cancelled')",
            name="ck_po_status",
        ),
    )


class ProductionOrderModel(Base):
    __tablename__ = "production_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    production_order_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    product: Mapped[str] = mapped_column(String, nullable=False)
    required_component: Mapped[str] = mapped_column(
        String, ForeignKey("components.component_id"), nullable=False
    )
    units_planned: Mapped[int] = mapped_column(Integer, nullable=False)
    component_required_per_unit: Mapped[int] = mapped_column(Integer, default=1)
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    priority: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="on_track")

    __table_args__ = (
        CheckConstraint("priority IN ('low','medium','high')", name="ck_prod_priority"),
        CheckConstraint(
            "status IN ('on_track','at_risk','stopped','rescheduled')", name="ck_prod_status"
        ),
    )


class SupplierMessage(Base):
    __tablename__ = "supplier_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    direction: Mapped[str] = mapped_column(String, nullable=False)
    supplier_id: Mapped[str] = mapped_column(
        String, ForeignKey("suppliers.supplier_id"), nullable=False
    )
    po_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("purchase_orders.po_id"), nullable=True
    )
    subject: Mapped[str | None] = mapped_column(String, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    __table_args__ = (
        CheckConstraint("direction IN ('inbound','outbound')", name="ck_msg_direction"),
    )


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    po_id: Mapped[str] = mapped_column(String, ForeignKey("purchase_orders.po_id"), nullable=False)
    supplier_claim: Mapped[str | None] = mapped_column(String, nullable=True)
    tracking_status: Mapped[str] = mapped_column(String, nullable=False)
    last_movement: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class DisruptionEvent(Base):
    __tablename__ = "disruption_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    po_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("purchase_orders.po_id"), nullable=True
    )
    production_order_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("production_orders.production_order_id"), nullable=True
    )
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    computed_risk: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('delay','quantity_shortfall','quality_failure',"
            "'demand_spike','data_correction','supplier_claim_mismatch')",
            name="ck_event_type",
        ),
    )


class RfqQuote(Base):
    __tablename__ = "rfq_quotes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    disruption_id: Mapped[str] = mapped_column(
        String, ForeignKey("disruption_events.id"), nullable=False
    )
    supplier_id: Mapped[str] = mapped_column(
        String, ForeignKey("suppliers.supplier_id"), nullable=False
    )
    component_id: Mapped[str] = mapped_column(String, nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    delivery_days: Mapped[int] = mapped_column(Integer, nullable=False)
    expedite_available: Mapped[bool] = mapped_column(default=False)
    expedite_fee: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    quote_valid_hours: Mapped[int] = mapped_column(Integer, default=6)
    score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    disruption_id: Mapped[str] = mapped_column(
        String, ForeignKey("disruption_events.id"), nullable=False
    )
    production_order_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("production_orders.production_order_id"), nullable=True
    )
    candidates_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    constraint_results_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    chosen_plan_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reasoning_text: Mapped[str] = mapped_column(Text, nullable=False)
    decision_brief_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    approver_id: Mapped[str | None] = mapped_column(String, nullable=True)
    replan_of: Mapped[str | None] = mapped_column(
        String, ForeignKey("decisions.id"), nullable=True
    )
    tool_call_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    __table_args__ = (
        CheckConstraint(
            "status IN ('auto_executed','pending_approval','approved','rejected','replanned')",
            name="ck_decision_status",
        ),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    decision_id: Mapped[str] = mapped_column(String, ForeignKey("decisions.id"), nullable=False)
    actor: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    hash: Mapped[str] = mapped_column(String, nullable=False)
    prev_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SupplierTrustEvent(Base):
    """
    Persistent, cross-run supplier trust history — independent of whether
    that supplier ends up as a scored negotiation candidate in any given run.

    Added because the original design only ever penalized trust WITHIN a
    single decision's candidate scoring (supplier_scoring.py's
    trust_penalized flag), and that flag turned out to be dead code in
    practice: a supplier caught lying gets EXCLUDED from negotiation
    entirely (graph.py's _should_negotiate_with), so it never actually shows
    up as a candidate to penalize. This table tracks the underlying event
    itself, so "SUP-21 has been caught lying N times" is answerable across
    the supplier's whole history, not just within one run's candidate list.
    """
    __tablename__ = "supplier_trust_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    supplier_id: Mapped[str] = mapped_column(String, ForeignKey("suppliers.supplier_id"), nullable=False)
    po_id: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_id: Mapped[str | None] = mapped_column(String, ForeignKey("decisions.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)  # 'claim_contradicted' for now
    details: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

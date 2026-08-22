"""
Deterministic production-coverage and risk calculator.

Never an LLM call. This is the piece that answers "will production stop, and how soon" —
directly maps to the 35%-weighted Production Continuity judging category (PS §7).

See: Backend_Schema_Supply_Chain_Disruption_Agent_v2.md §2.1, §2.4
     TRD_Supply_Chain_Disruption_Agent_v2.md §8
"""
from dataclasses import dataclass
from datetime import date
from typing import Literal

RiskLevel = Literal["Low", "Medium", "High", "Critical"]


@dataclass
class Component:
    component_id: str
    usable_stock: int
    daily_usage: int
    safety_stock: int
    quality_threshold: float = 0.80


@dataclass
class ProductionOrder:
    production_order_id: str
    required_component: str
    units_planned: int
    component_required_per_unit: int
    deadline: date
    priority: Literal["low", "medium", "high"]


@dataclass
class CoverageResult:
    coverage_days: float
    days_until_deadline: int
    shortfall_units: int
    computed_risk: RiskLevel


def compute_coverage(
    component: Component,
    production_order: ProductionOrder,
    today: date,
) -> CoverageResult:
    """
    Core formula:
        coverage_days = usable_stock / daily_usage
        shortfall_units = max(0, units_needed - usable_stock)

    Risk is a function of (coverage vs. deadline) AND production priority — a five-day
    delay is fine for a low-priority order and dangerous for a high-priority one (PS §4.1).
    """
    if component.daily_usage <= 0:
        raise ValueError("daily_usage must be positive — cannot compute coverage")

    coverage_days = component.usable_stock / component.daily_usage
    days_until_deadline = (production_order.deadline - today).days

    units_needed = production_order.units_planned * production_order.component_required_per_unit
    shortfall_units = max(0, units_needed - component.usable_stock)

    computed_risk = _classify_risk(
        shortfall_units=shortfall_units,
        days_until_deadline=days_until_deadline,
        priority=production_order.priority,
    )

    return CoverageResult(
        coverage_days=coverage_days,
        days_until_deadline=days_until_deadline,
        shortfall_units=shortfall_units,
        computed_risk=computed_risk,
    )


def _classify_risk(
    shortfall_units: int,
    days_until_deadline: int,
    priority: Literal["low", "medium", "high"],
) -> RiskLevel:
    if shortfall_units <= 0:
        return "Low"

    if priority == "high":
        return "Critical" if days_until_deadline <= 1 else "High"

    if priority == "medium":
        return "High" if days_until_deadline <= 1 else "Medium"

    # low priority
    return "Medium" if days_until_deadline <= 1 else "Low"

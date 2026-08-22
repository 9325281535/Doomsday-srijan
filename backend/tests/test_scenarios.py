"""
Unit tests against the four seeded PS scenarios (Backend_Schema_Supply_Chain_
Disruption_Agent_v2.md §4). No DB, no Groq — pure functions only. Per the
Implementation Plan Phase 2, this is the ~70%-of-score piece and gets tested
before any LangGraph wiring exists.
"""
from datetime import date, timedelta
from decimal import Decimal

from app.services.claim_verification import verify_claim
from app.services.constraints import (
    SupplierCandidate,
    validate_all_candidates,
    validate_plan_cost,
    validate_safety_stock,
)
from app.services.coverage import Component, ProductionOrder, compute_coverage
from app.services.supplier_scoring import build_recovery_plan, rank_candidates, score_candidate

TODAY = date(2026, 9, 1)


# ---------------------------------------------------------------------------
# Scenario 1 — Baseline delay: coverage shortfall, split recovery, auto-executes
# ---------------------------------------------------------------------------

class TestScenario1Baseline:
    def setup_method(self):
        self.component = Component(
            component_id="COMP-104",
            usable_stock=390,
            daily_usage=90,
            safety_stock=150,
            quality_threshold=0.80,
        )
        self.production_order = ProductionOrder(
            production_order_id="PROD-882",
            required_component="COMP-104",
            units_planned=700,
            component_required_per_unit=1,
            deadline=TODAY + timedelta(days=7),
            priority="high",
        )
        self.sup42 = SupplierCandidate(
            supplier_id="SUP-42",
            quantity_offered=600,
            min_order_quantity=300,
            unit_price=Decimal("136"),
            lead_time_days=4,
            quality_score=0.94,
            reliability_score=0.81,
        )
        self.sup37 = SupplierCandidate(
            supplier_id="SUP-37",
            quantity_offered=400,
            min_order_quantity=100,
            unit_price=Decimal("129"),
            lead_time_days=6,
            quality_score=0.88,
            reliability_score=0.90,
        )

    def test_coverage_shows_shortfall_and_high_risk(self):
        result = compute_coverage(self.component, self.production_order, TODAY)
        assert result.shortfall_units == 700 - 390  # 310
        assert result.computed_risk in ("High", "Critical")

    def test_both_candidates_pass_constraints(self):
        violations = validate_all_candidates(
            [self.sup42, self.sup37],
            quality_threshold=self.component.quality_threshold,
            deadline=self.production_order.deadline,
            today=TODAY,
        )
        assert violations["SUP-42"] == []
        assert violations["SUP-37"] == []

    def test_split_plan_covers_exact_shortfall(self):
        coverage = compute_coverage(self.component, self.production_order, TODAY)
        scored = rank_candidates(
            [
                score_candidate(self.sup42, baseline_price=Decimal("118"), max_lead_time_days=6),
                score_candidate(self.sup37, baseline_price=Decimal("118"), max_lead_time_days=6),
            ]
        )
        plan = build_recovery_plan(scored, shortfall_units=coverage.shortfall_units)

        assert plan.covers_shortfall is True
        total_allocated = sum(a.quantity for a in plan.allocations)
        assert total_allocated == coverage.shortfall_units
        # SUP-42 scores higher (cheaper isn't everything — check it's actually used first)
        assert plan.allocations[0].supplier_id == scored[0].candidate.supplier_id

    def test_plan_within_approval_threshold_auto_executes(self):
        coverage = compute_coverage(self.component, self.production_order, TODAY)
        scored = rank_candidates(
            [
                score_candidate(self.sup42, baseline_price=Decimal("118"), max_lead_time_days=6),
                score_candidate(self.sup37, baseline_price=Decimal("118"), max_lead_time_days=6),
            ]
        )
        plan = build_recovery_plan(scored, shortfall_units=coverage.shortfall_units)
        requires_approval, reason = validate_plan_cost(
            plan.total_cost, approval_required_above=Decimal("150000")
        )
        assert requires_approval is False
        assert reason is None


# ---------------------------------------------------------------------------
# Scenario 3 — Adversarial claim: supplier lies about dispatch, agent catches it
# ---------------------------------------------------------------------------

class TestScenario3AdversarialClaim:
    def test_dispatch_claim_with_no_pickup_is_contradicted(self):
        result = verify_claim(
            supplier_claim="dispatched", tracking_status="label_created_no_pickup"
        )
        assert result.contradicts is True
        assert result.supplier_trusted is False

    def test_dispatch_claim_matching_tracking_is_trusted(self):
        result = verify_claim(supplier_claim="dispatched", tracking_status="in_transit")
        assert result.contradicts is False
        assert result.supplier_trusted is True

    def test_no_claim_made_is_not_flagged(self):
        result = verify_claim(supplier_claim=None, tracking_status="in_transit")
        assert result.contradicts is False
        assert result.supplier_trusted is True

    def test_trust_penalty_lowers_score_but_does_not_zero_it(self):
        candidate = SupplierCandidate(
            supplier_id="SUP-21",
            quantity_offered=500,
            min_order_quantity=200,
            unit_price=Decimal("120"),
            lead_time_days=5,
            quality_score=0.85,
            reliability_score=0.80,
        )
        clean = score_candidate(candidate, baseline_price=Decimal("120"), max_lead_time_days=6)
        penalized = score_candidate(
            candidate, baseline_price=Decimal("120"), max_lead_time_days=6, trust_penalized=True
        )
        assert penalized.score < clean.score
        assert penalized.trust_penalized is True


# ---------------------------------------------------------------------------
# Scenario 5 — Budget escalation: only feasible plan exceeds threshold
# ---------------------------------------------------------------------------

class TestScenario5BudgetEscalation:
    def test_expensive_expedite_only_plan_exceeds_threshold(self):
        expensive_candidate = SupplierCandidate(
            supplier_id="SUP-99",
            quantity_offered=700,
            min_order_quantity=100,
            unit_price=Decimal("230"),  # expedited premium
            lead_time_days=2,
            quality_score=0.90,
            reliability_score=0.75,
        )
        scored = [score_candidate(expensive_candidate, Decimal("118"), max_lead_time_days=2)]
        plan = build_recovery_plan(scored, shortfall_units=700)

        requires_approval, reason = validate_plan_cost(
            plan.total_cost, approval_required_above=Decimal("150000")
        )
        assert requires_approval is True
        assert "exceeds this PO's approval threshold" in reason

    def test_decision_brief_worthy_reason_is_specific_not_vague(self):
        """PS §4.9: escalation must be a decision brief, not a vague alert."""
        requires_approval, reason = validate_plan_cost(
            Decimal("168000"), approval_required_above=Decimal("150000")
        )
        assert requires_approval is True
        assert "168000" in reason
        assert "150000" in reason


# ---------------------------------------------------------------------------
# Scenario 2 — Stale inventory / replanning: corrected data changes the risk
# ---------------------------------------------------------------------------

class TestScenario2ReplanningOnCorrectedInventory:
    def test_stale_vs_corrected_inventory_yields_different_risk(self):
        production_order = ProductionOrder(
            production_order_id="PROD-882",
            required_component="COMP-104",
            units_planned=700,
            component_required_per_unit=1,
            deadline=TODAY + timedelta(days=4),
            priority="high",
        )
        stale = Component("COMP-104", usable_stock=800, daily_usage=90, safety_stock=150)
        corrected = Component("COMP-104", usable_stock=390, daily_usage=90, safety_stock=150)

        stale_result = compute_coverage(stale, production_order, TODAY)
        corrected_result = compute_coverage(corrected, production_order, TODAY)

        assert stale_result.shortfall_units == 0        # looked fine on stale data
        assert corrected_result.shortfall_units > 0      # actually short — replan needed
        assert stale_result.computed_risk == "Low"
        assert corrected_result.computed_risk in ("High", "Critical")


# ---------------------------------------------------------------------------
# Safety stock rule — plan shouldn't silently eat the safety margin
# ---------------------------------------------------------------------------

class TestSafetyStockRule:
    def test_plan_dipping_below_safety_stock_requires_approval(self):
        requires_approval, reason = validate_safety_stock(
            usable_stock=390, safety_stock=150, units_consumed_by_plan=300
        )
        assert requires_approval is True
        assert "safety stock" in reason

    def test_plan_respecting_safety_stock_does_not_require_approval(self):
        requires_approval, reason = validate_safety_stock(
            usable_stock=390, safety_stock=150, units_consumed_by_plan=100
        )
        assert requires_approval is False
        assert reason is None


# ---------------------------------------------------------------------------
# Quality / MOQ / deadline rules — never traded away for speed or cost
# ---------------------------------------------------------------------------

class TestConstraintRulesNeverBypassed:
    def test_low_quality_supplier_is_rejected_even_if_cheap_and_fast(self):
        cheap_but_low_quality = SupplierCandidate(
            supplier_id="SUP-18",
            quantity_offered=900,
            min_order_quantity=100,
            unit_price=Decimal("95"),
            lead_time_days=3,
            quality_score=0.71,
            reliability_score=0.60,
        )
        violations = validate_all_candidates(
            [cheap_but_low_quality],
            quality_threshold=0.80,
            deadline=TODAY + timedelta(days=10),
            today=TODAY,
        )
        assert len(violations["SUP-18"]) == 1
        assert "Quality score" in violations["SUP-18"][0]

    def test_candidate_missing_deadline_is_rejected(self):
        too_slow = SupplierCandidate(
            supplier_id="SUP-55",
            quantity_offered=500,
            min_order_quantity=100,
            unit_price=Decimal("110"),
            lead_time_days=10,
            quality_score=0.90,
            reliability_score=0.85,
        )
        violations = validate_all_candidates(
            [too_slow],
            quality_threshold=0.80,
            deadline=TODAY + timedelta(days=4),
            today=TODAY,
        )
        assert any("misses production deadline" in v for v in violations["SUP-55"])

    def test_below_moq_candidate_is_rejected(self):
        below_moq = SupplierCandidate(
            supplier_id="SUP-33",
            quantity_offered=50,
            min_order_quantity=300,
            unit_price=Decimal("100"),
            lead_time_days=2,
            quality_score=0.95,
            reliability_score=0.95,
        )
        violations = validate_all_candidates(
            [below_moq],
            quality_threshold=0.80,
            deadline=TODAY + timedelta(days=10),
            today=TODAY,
        )
        assert any("Below MOQ" in v for v in violations["SUP-33"])


if __name__ == "__main__":
    import pytest  # local import: keeps this module importable in envs without pytest

    pytest.main([__file__, "-v"])

from datetime import date

from app.services.prioritization import find_deprioritizable_orders

TODAY = date(2026, 9, 1)


def test_finds_lower_priority_competitor():
    competing = [
        {
            "production_order_id": "PROD-LOW",
            "priority": "low",
            "units_planned": 300,
            "deadline": date(2026, 9, 20),
            "status": "on_track",
        }
    ]
    candidates = find_deprioritizable_orders(competing, protected_priority="high")
    assert len(candidates) == 1
    assert candidates[0].production_order_id == "PROD-LOW"
    assert candidates[0].suggested_new_deadline > candidates[0].current_deadline


def test_excludes_equal_or_higher_priority():
    competing = [
        {
            "production_order_id": "PROD-SAME",
            "priority": "high",
            "units_planned": 300,
            "deadline": date(2026, 9, 20),
            "status": "on_track",
        }
    ]
    candidates = find_deprioritizable_orders(competing, protected_priority="high")
    assert candidates == []


def test_excludes_already_at_risk_orders():
    """Don't pile onto an order that's already struggling."""
    competing = [
        {
            "production_order_id": "PROD-STRUGGLING",
            "priority": "low",
            "units_planned": 300,
            "deadline": date(2026, 9, 20),
            "status": "at_risk",
        }
    ]
    candidates = find_deprioritizable_orders(competing, protected_priority="high")
    assert candidates == []


def test_ranks_lowest_priority_first():
    competing = [
        {
            "production_order_id": "PROD-MEDIUM",
            "priority": "medium",
            "units_planned": 100,
            "deadline": date(2026, 9, 20),
            "status": "on_track",
        },
        {
            "production_order_id": "PROD-LOW",
            "priority": "low",
            "units_planned": 100,
            "deadline": date(2026, 9, 20),
            "status": "on_track",
        },
    ]
    candidates = find_deprioritizable_orders(competing, protected_priority="high")
    assert candidates[0].production_order_id == "PROD-LOW"
    assert candidates[1].production_order_id == "PROD-MEDIUM"


if __name__ == "__main__":
    import pytest

    pytest.main([__file__, "-v"])

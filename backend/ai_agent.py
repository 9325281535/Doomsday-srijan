"""
ai_agent.py - AI Weight Optimizer for NexScheduler AI
Uses gradient-descent simulation to dynamically tune scheduling weights.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple


class AIAgent:
    """
    Adaptive AI agent that monitors scheduling metrics and auto-tunes
    the scoring weights used by the NexScheduler engine.

    Weights:
        w1 - urgency weight      (deadline proximity)
        w2 - aging weight        (starvation prevention)
        w3 - efficiency weight   (resource efficiency)
        w4 - base priority weight
    """

    RETRAIN_INTERVAL_TICKS = 30
    LEARNING_RATE = 0.05
    MAX_HISTORY = 200

    def __init__(self, initial_weights: Optional[Dict[str, float]] = None) -> None:
        self.weights: Dict[str, float] = initial_weights or {
            "w1": 0.35,
            "w2": 0.25,
            "w3": 0.20,
            "w4": 0.20,
        }

        # Metrics history: list of (deadline_miss_rate, avg_wait, utilization)
        self.metrics_history: List[Tuple[float, float, float]] = []
        self.performance_history: List[Dict[str, float]] = []

        self.retrain_count: int = 0
        self.tick_count: int = 0
        self.last_retrain_time: float = time.time()
        self.last_retrain_tick: int = 0
        self.is_retraining: bool = False
        self.last_retrain_reason: str = ""

        self._recent_miss_rates: List[float] = []
        self._recent_waits: List[float] = []
        self._recent_utils: List[float] = []

    # ------------------------------------------------------------------
    # Observation
    # ------------------------------------------------------------------

    def observe_metrics(
        self,
        deadline_miss_rate: float,
        avg_wait: float,
        utilization: float,
    ) -> None:
        """Record one observation of system metrics."""
        self.tick_count += 1
        self.metrics_history.append((deadline_miss_rate, avg_wait, utilization))
        self.performance_history.append(
            {
                "tick": float(self.tick_count),
                "deadline_miss_rate": round(deadline_miss_rate, 4),
                "avg_wait": round(avg_wait, 2),
                "utilization": round(utilization, 4),
                "timestamp": round(time.time(), 2),
            }
        )

        self._recent_miss_rates.append(deadline_miss_rate)
        self._recent_waits.append(avg_wait)
        self._recent_utils.append(utilization)
        if len(self._recent_miss_rates) > 30:
            self._recent_miss_rates.pop(0)
            self._recent_waits.pop(0)
            self._recent_utils.pop(0)

        if len(self.metrics_history) > self.MAX_HISTORY:
            self.metrics_history = self.metrics_history[-self.MAX_HISTORY:]
        if len(self.performance_history) > self.MAX_HISTORY:
            self.performance_history = self.performance_history[-self.MAX_HISTORY:]

    # ------------------------------------------------------------------
    # Retraining trigger
    # ------------------------------------------------------------------

    def should_retrain(self) -> Tuple[bool, str]:
        """
        Returns (True, reason) if retraining is needed.
        Triggers:
          - deadline_miss_rate > 10%
          - utilization < 70%
          - avg_wait > 20s
          - every RETRAIN_INTERVAL_TICKS ticks
        """
        if not self.metrics_history:
            return False, ""

        miss_rate = self._recent_miss_rates[-1] if self._recent_miss_rates else 0.0
        utilization = self._recent_utils[-1] if self._recent_utils else 1.0
        avg_wait = self._recent_waits[-1] if self._recent_waits else 0.0
        ticks_since = self.tick_count - self.last_retrain_tick

        if miss_rate > 0.10:
            return True, f"High deadline miss rate ({miss_rate * 100:.1f}%)"
        if utilization < 0.70:
            return True, f"Low utilization ({utilization * 100:.1f}%)"
        if avg_wait > 20.0:
            return True, f"High avg wait ({avg_wait:.1f}s)"
        if ticks_since >= self.RETRAIN_INTERVAL_TICKS:
            return True, f"Scheduled retrain (every {self.RETRAIN_INTERVAL_TICKS} ticks)"
        return False, ""

    # ------------------------------------------------------------------
    # Retraining / gradient descent simulation
    # ------------------------------------------------------------------

    def retrain(
        self, metrics_history: Optional[List[Tuple[float, float, float]]] = None
    ) -> Dict[str, float]:
        """
        Adjust weights using gradient-descent simulation:
        - Increase w1 if deadline_miss_rate is high  (more urgency sensitivity)
        - Increase w2 if avg_wait is high             (more aging)
        - Increase w3 if utilization is low           (prefer efficient jobs)
        - Normalize weights to sum = 1.0
        """
        self.is_retraining = True
        history = metrics_history or self.metrics_history

        if not history:
            self.is_retraining = False
            return self.weights

        recent = history[-20:]
        avg_miss = sum(r[0] for r in recent) / len(recent)
        avg_wait = sum(r[1] for r in recent) / len(recent)
        avg_util = sum(r[2] for r in recent) / len(recent)

        lr = self.LEARNING_RATE

        if avg_miss > 0.10:
            self.weights["w1"] += lr * (avg_miss - 0.10) * 2
            self.weights["w4"] -= lr * 0.5
        if avg_wait > 15.0:
            self.weights["w2"] += lr * min(1.0, avg_wait / 30.0)
            self.weights["w1"] -= lr * 0.3
        if avg_util < 0.70:
            self.weights["w3"] += lr * (0.70 - avg_util)
            self.weights["w1"] -= lr * 0.2

        # Clamp all weights to [0.05, 0.80]
        for k in self.weights:
            self.weights[k] = max(0.05, min(0.80, self.weights[k]))

        # Normalize to sum = 1
        total = sum(self.weights.values())
        self.weights = {k: round(v / total, 4) for k, v in self.weights.items()}

        # Fix floating-point rounding so sum == exactly 1.0
        diff = round(1.0 - sum(self.weights.values()), 4)
        self.weights["w1"] = round(self.weights["w1"] + diff, 4)

        self.retrain_count += 1
        self.last_retrain_time = time.time()
        self.last_retrain_tick = self.tick_count
        self.is_retraining = False

        return self.weights

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_performance_trend(self) -> str:
        """Returns 'improving', 'stable', or 'degrading' based on recent history."""
        if len(self._recent_miss_rates) < 5:
            return "insufficient_data"

        half = len(self._recent_miss_rates) // 2
        first_half = self._recent_miss_rates[:half]
        second_half = self._recent_miss_rates[half:]
        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)

        if avg_second < avg_first - 0.02:
            return "improving"
        if avg_second > avg_first + 0.02:
            return "degrading"
        return "stable"

    def get_status(self) -> Dict[str, Any]:
        trend = self.get_performance_trend()
        latest_miss = self._recent_miss_rates[-1] if self._recent_miss_rates else 0.0
        latest_util = self._recent_utils[-1] if self._recent_utils else 0.0
        latest_wait = self._recent_waits[-1] if self._recent_waits else 0.0

        needs_retrain, retrain_reason = self.should_retrain()

        return {
            "weights": {k: round(v, 4) for k, v in self.weights.items()},
            "retrain_count": self.retrain_count,
            "tick_count": self.tick_count,
            "last_retrain_time": round(self.last_retrain_time, 2),
            "ticks_since_retrain": self.tick_count - self.last_retrain_tick,
            "is_retraining": self.is_retraining,
            "performance_trend": trend,
            "needs_retrain": needs_retrain,
            "retrain_reason": retrain_reason,
            "latest_metrics": {
                "deadline_miss_rate": round(latest_miss, 4),
                "utilization": round(latest_util, 4),
                "avg_wait": round(latest_wait, 2),
            },
            "performance_history": self.performance_history[-10:],
        }

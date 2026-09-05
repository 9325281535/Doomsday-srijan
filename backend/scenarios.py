"""
scenarios.py - Pre-loaded demo scenarios for NexScheduler AI
Each scenario returns a list of Job-compatible dicts.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List

from models import Job


def _make_job(
    name: str,
    priority: int,
    deadline_offset: float,
    burst_time: float,
    cpu_units: float = 1.0,
    gpu_units: float = 0.0,
    ram_units: float = 2.0,
    arrival_offset: float = 0.0,
) -> Dict[str, Any]:
    """Helper: returns a Job-compatible dict."""
    now = time.time()
    return {
        "name": name,
        "priority": priority,
        "deadline": now + deadline_offset,
        "burst_time": burst_time,
        "cpu_units": cpu_units,
        "gpu_units": gpu_units,
        "ram_units": ram_units,
        "arrival_time": now + arrival_offset,
        "remaining_time": burst_time,
        "wait_time": 0.0,
    }


# ---------------------------------------------------------------------------
# Scenario 1: Urgent Preemption
# ---------------------------------------------------------------------------

def get_scenario_1() -> List[Dict[str, Any]]:
    """
    Scenario 1: Urgent Preemption
    Normal jobs are running. Then a CRITICAL job with only 5s to deadline
    arrives and forces the scheduler to preempt lower-priority work.
    """
    return [
        _make_job("DataExport",        priority=4,  deadline_offset=60,  burst_time=10, cpu_units=2, ram_units=4),
        _make_job("ReportGen",         priority=3,  deadline_offset=90,  burst_time=8,  cpu_units=1, ram_units=2),
        _make_job("BackupTask",        priority=2,  deadline_offset=120, burst_time=15, cpu_units=1, ram_units=2),
        _make_job("EmailQueue",        priority=3,  deadline_offset=75,  burst_time=6,  cpu_units=1, ram_units=1),
        _make_job("CRITICAL-Payment",  priority=10, deadline_offset=5,   burst_time=3,  cpu_units=2, ram_units=4,  arrival_offset=1),
        _make_job("UserLogin",         priority=7,  deadline_offset=20,  burst_time=2,  cpu_units=1, ram_units=1,  arrival_offset=2),
        _make_job("Monitoring",        priority=5,  deadline_offset=50,  burst_time=5,  cpu_units=1, ram_units=2),
    ]


# ---------------------------------------------------------------------------
# Scenario 2: Starvation Prevention
# ---------------------------------------------------------------------------

def get_scenario_2() -> List[Dict[str, Any]]:
    """
    Scenario 2: Starvation Prevention
    A low-priority analytics job keeps getting bumped by waves of high-priority
    API tasks. The aging mechanism raises its score until it finally runs.
    """
    return [
        _make_job("LowPri-Analytics", priority=1, deadline_offset=300, burst_time=10, cpu_units=2, ram_units=4),
        _make_job("HighPri-API-1",    priority=9, deadline_offset=30,  burst_time=4,  cpu_units=2, ram_units=4,  arrival_offset=0.5),
        _make_job("HighPri-API-2",    priority=9, deadline_offset=35,  burst_time=4,  cpu_units=2, ram_units=4,  arrival_offset=3),
        _make_job("HighPri-API-3",    priority=8, deadline_offset=40,  burst_time=4,  cpu_units=2, ram_units=4,  arrival_offset=6),
        _make_job("HighPri-API-4",    priority=8, deadline_offset=45,  burst_time=4,  cpu_units=2, ram_units=4,  arrival_offset=9),
        _make_job("HighPri-API-5",    priority=9, deadline_offset=50,  burst_time=4,  cpu_units=2, ram_units=4,  arrival_offset=12),
        _make_job("MedPri-DB-Sync",   priority=5, deadline_offset=60,  burst_time=6,  cpu_units=1, ram_units=2,  arrival_offset=2),
        _make_job("MedPri-Cache",     priority=5, deadline_offset=65,  burst_time=5,  cpu_units=1, ram_units=2,  arrival_offset=4),
    ]


# ---------------------------------------------------------------------------
# Scenario 3: GPU Bottleneck
# ---------------------------------------------------------------------------

def get_scenario_3() -> List[Dict[str, Any]]:
    """
    Scenario 3: GPU Resource Bottleneck
    Multiple ML jobs compete for only 2 GPU units.
    The scheduler queues GPU jobs by urgency while CPU-only jobs run in parallel.
    """
    return [
        _make_job("ML-Train-ResNet",  priority=7, deadline_offset=60,  burst_time=12, cpu_units=2, gpu_units=1, ram_units=8),
        _make_job("ML-Train-BERT",    priority=8, deadline_offset=45,  burst_time=10, cpu_units=2, gpu_units=1, ram_units=8),
        _make_job("ML-Inference-A",   priority=9, deadline_offset=20,  burst_time=3,  cpu_units=1, gpu_units=1, ram_units=4),
        _make_job("ML-Inference-B",   priority=6, deadline_offset=30,  burst_time=3,  cpu_units=1, gpu_units=1, ram_units=4),
        _make_job("ML-Train-GPT",     priority=5, deadline_offset=90,  burst_time=20, cpu_units=4, gpu_units=2, ram_units=16),
        _make_job("DataPipeline",     priority=4, deadline_offset=120, burst_time=8,  cpu_units=2, gpu_units=0, ram_units=4),
        _make_job("LogAggregator",    priority=3, deadline_offset=100, burst_time=5,  cpu_units=1, gpu_units=0, ram_units=2),
        _make_job("APIGateway",       priority=7, deadline_offset=25,  burst_time=2,  cpu_units=1, gpu_units=0, ram_units=1),
    ]


# ---------------------------------------------------------------------------
# Scenario 4: Algorithm Battle (Mixed Workload)
# ---------------------------------------------------------------------------

def get_scenario_4() -> List[Dict[str, Any]]:
    """
    Scenario 4: Algorithm Battle
    A diverse mixed-workload scenario designed to reveal differences between
    NexScheduler AI, FCFS, Round Robin, and Static Priority.
    """
    return [
        _make_job("BatchETL-1",      priority=2,  deadline_offset=300, burst_time=30, cpu_units=4, ram_units=8),
        _make_job("BatchETL-2",      priority=2,  deadline_offset=300, burst_time=25, cpu_units=4, ram_units=8),
        _make_job("UserRequest-A",   priority=8,  deadline_offset=10,  burst_time=1,  cpu_units=1, ram_units=1),
        _make_job("UserRequest-B",   priority=8,  deadline_offset=12,  burst_time=1,  cpu_units=1, ram_units=1),
        _make_job("UserRequest-C",   priority=7,  deadline_offset=15,  burst_time=2,  cpu_units=1, ram_units=1),
        _make_job("SearchIndex",     priority=5,  deadline_offset=60,  burst_time=8,  cpu_units=2, ram_units=4),
        _make_job("NotifSender",     priority=6,  deadline_offset=40,  burst_time=4,  cpu_units=1, ram_units=2),
        _make_job("RecommEngine",    priority=4,  deadline_offset=80,  burst_time=12, cpu_units=3, gpu_units=1, ram_units=8),
        _make_job("ALERT-Processor", priority=10, deadline_offset=8,   burst_time=2,  cpu_units=1, ram_units=2),
        _make_job("HealthCheck",     priority=9,  deadline_offset=6,   burst_time=1,  cpu_units=1, ram_units=1),
        _make_job("AuditLog",        priority=1,  deadline_offset=600, burst_time=20, cpu_units=1, ram_units=2),
        _make_job("ArchiveJob",      priority=1,  deadline_offset=600, burst_time=20, cpu_units=1, ram_units=2),
    ]


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

SCENARIOS: Dict[int, Any] = {
    1: get_scenario_1,
    2: get_scenario_2,
    3: get_scenario_3,
    4: get_scenario_4,
}

SCENARIO_INFO: Dict[int, Dict[str, str]] = {
    1: {
        "name": "Urgent Preemption",
        "description": (
            "Normal jobs run until a CRITICAL payment job arrives with a 5-second deadline, "
            "forcing the AI to preempt existing work immediately."
        ),
        "focus": "Preemption, Urgency",
    },
    2: {
        "name": "Starvation Prevention",
        "description": (
            "A low-priority analytics job is repeatedly skipped by waves of high-priority API tasks. "
            "The aging mechanism gradually boosts its score until it finally executes."
        ),
        "focus": "Starvation, Aging",
    },
    3: {
        "name": "GPU Bottleneck",
        "description": (
            "Multiple ML training/inference jobs compete for only 2 GPU units. "
            "The scheduler queues GPU jobs by urgency while running CPU-only tasks in parallel."
        ),
        "focus": "Resource Contention, GPU",
    },
    4: {
        "name": "Algorithm Battle",
        "description": (
            "A diverse mixed workload designed to expose differences between all four scheduling "
            "algorithms: NexScheduler AI, FCFS, Round Robin, and Static Priority."
        ),
        "focus": "Comparison, Mixed Workload",
    },
}


def load_scenario(scenario_id: int) -> List[Job]:
    """Load a scenario and return a list of Job objects."""
    if scenario_id not in SCENARIOS:
        raise ValueError(
            f"Unknown scenario ID: {scenario_id}. Valid IDs: {list(SCENARIOS.keys())}"
        )
    job_dicts = SCENARIOS[scenario_id]()
    return [Job(**d) for d in job_dicts]

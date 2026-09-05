"""
scheduler.py - Full scheduling engine for NexScheduler AI
Implements: NexScheduler (AI-weighted), FCFS, Round Robin, Static Priority
"""
from __future__ import annotations

import time
import uuid
from collections import deque
from typing import Any, Dict, List, Optional

from models import Job, JobStatus, ResourceState


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

AGING_RATE = 0.05  # wait_time multiplier


def compute_score(
    job: Job,
    current_time: float,
    weights: Dict[str, float],
    aging_rate: float = AGING_RATE,
) -> float:
    """
    Score = W1*urgency + W2*aging + W3*resource_efficiency + W4*base_priority

    urgency             = 1 / max(1, deadline - current_time)
    aging               = wait_time * aging_rate
    resource_efficiency = 1 / max(1, cpu_units + gpu_units + ram_units)
    base_priority_norm  = (priority - 1) / 9  -> [0, 1]
    """
    w1 = weights.get("w1", 0.35)
    w2 = weights.get("w2", 0.25)
    w3 = weights.get("w3", 0.20)
    w4 = weights.get("w4", 0.20)

    time_to_deadline = max(1.0, job.deadline - current_time)
    urgency = 1.0 / time_to_deadline

    aging = job.wait_time * aging_rate

    total_resources = job.cpu_units + job.gpu_units + job.ram_units
    resource_efficiency = 1.0 / max(1.0, total_resources)

    base_priority_norm = (job.priority - 1) / 9.0

    score = (
        w1 * urgency
        + w2 * aging
        + w3 * resource_efficiency
        + w4 * base_priority_norm
    )
    return round(score, 6)


def get_score_breakdown(
    job: Job,
    current_time: float,
    weights: Dict[str, float],
    aging_rate: float = AGING_RATE,
) -> Dict[str, float]:
    """Returns detailed score component breakdown for explanation."""
    w1 = weights.get("w1", 0.35)
    w2 = weights.get("w2", 0.25)
    w3 = weights.get("w3", 0.20)
    w4 = weights.get("w4", 0.20)

    time_to_deadline = max(1.0, job.deadline - current_time)
    urgency = 1.0 / time_to_deadline
    aging = job.wait_time * aging_rate
    total_resources = job.cpu_units + job.gpu_units + job.ram_units
    resource_efficiency = 1.0 / max(1.0, total_resources)
    base_priority_norm = (job.priority - 1) / 9.0

    return {
        "total_score": round(
            w1 * urgency + w2 * aging + w3 * resource_efficiency + w4 * base_priority_norm,
            6,
        ),
        "urgency_component": round(w1 * urgency, 6),
        "urgency_raw": round(urgency, 6),
        "aging_component": round(w2 * aging, 6),
        "aging_raw": round(aging, 6),
        "efficiency_component": round(w3 * resource_efficiency, 6),
        "efficiency_raw": round(resource_efficiency, 6),
        "base_priority_component": round(w4 * base_priority_norm, 6),
        "base_priority_norm": round(base_priority_norm, 6),
        "time_to_deadline": round(time_to_deadline, 2),
        "weights": {k: round(v, 4) for k, v in weights.items()},
    }


def schedule_next_job(
    ready_queue: List[Job],
    current_time: float,
    weights: Dict[str, float],
    starvation_limit: float,
    resources: ResourceState,
) -> Optional[Job]:
    """
    Select the best eligible job from ready_queue.
    Starvation guard: jobs waiting longer than starvation_limit get score=999.
    Returns None if no job can be scheduled.
    """
    eligible = [
        j for j in ready_queue
        if j.status == JobStatus.WAITING and resources.can_run(j)
    ]
    if not eligible:
        return None

    def effective_score(j: Job) -> float:
        if j.wait_time >= starvation_limit:
            return 999.0
        return compute_score(j, current_time, weights)

    eligible.sort(key=effective_score, reverse=True)
    return eligible[0]


# ---------------------------------------------------------------------------
# Main NexScheduler Engine
# ---------------------------------------------------------------------------


class SchedulerEngine:
    """AI-weighted preemptive scheduler engine."""

    TOTAL_CPU = 8.0
    TOTAL_GPU = 2.0
    TOTAL_RAM = 32.0

    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        starvation_limit: float = 30.0,
        tick_interval: float = 0.5,
    ):
        self.weights: Dict[str, float] = weights or {
            "w1": 0.35,
            "w2": 0.25,
            "w3": 0.20,
            "w4": 0.20,
        }
        self.starvation_limit = starvation_limit
        self.tick_interval = tick_interval

        self.ready_queue: List[Job] = []
        self.running_jobs: List[Job] = []
        self.completed_jobs: List[Job] = []

        self.resources = ResourceState()
        self.current_time: float = time.time()

        self.event_log: List[Dict[str, Any]] = []
        self.tick_count: int = 0

        # Metrics tracking
        self._deadlines_missed: int = 0
        self._deadlines_total: int = 0
        self._total_wait_accumulated: float = 0.0
        self._jobs_completed: int = 0
        self._throughput_window: deque = deque(maxlen=60)

    # ------------------------------------------------------------------
    # Event logging
    # ------------------------------------------------------------------

    def _log(self, message: str, event_type: str, job_id: Optional[str] = None) -> None:
        entry: Dict[str, Any] = {
            "id": str(uuid.uuid4())[:8],
            "timestamp": round(self.current_time, 2),
            "tick": self.tick_count,
            "message": message,
            "type": event_type,
            "job_id": job_id,
        }
        self.event_log.append(entry)
        if len(self.event_log) > 200:
            self.event_log = self.event_log[-200:]

    # ------------------------------------------------------------------
    # Job management
    # ------------------------------------------------------------------

    def add_job(self, job: Job) -> None:
        job.arrival_time = self.current_time
        job.status = JobStatus.WAITING
        job.wait_time = 0.0
        if job.remaining_time == 0.0:
            job.remaining_time = job.burst_time
        self.ready_queue.append(job)
        self._deadlines_total += 1
        self._log(
            f"Job '{job.name}' arrived (priority={job.priority})",
            "job_arrived",
            job.id,
        )
        ttd = job.time_to_deadline(self.current_time)
        if ttd < 10:
            self._log(
                f"DEADLINE WARNING: '{job.name}' has only {ttd:.1f}s left!",
                "deadline_warning",
                job.id,
            )

    def remove_job(self, job_id: str) -> bool:
        for lst in [self.ready_queue, self.running_jobs]:
            for j in list(lst):
                if j.id == job_id:
                    if j.status == JobStatus.RUNNING:
                        self.resources.release(j)
                    lst.remove(j)
                    self._log(f"Job '{j.name}' removed by user", "job_removed", j.id)
                    return True
        return False

    def reset(self) -> None:
        self.ready_queue.clear()
        self.running_jobs.clear()
        self.completed_jobs.clear()
        self.event_log.clear()
        self.resources = ResourceState()
        self.current_time = time.time()
        self.tick_count = 0
        self._deadlines_missed = 0
        self._deadlines_total = 0
        self._total_wait_accumulated = 0.0
        self._jobs_completed = 0
        self._throughput_window.clear()

    # ------------------------------------------------------------------
    # Core tick
    # ------------------------------------------------------------------

    def tick(self) -> None:
        """Advance simulation by one tick_interval."""
        dt = self.tick_interval
        self.current_time = time.time()
        self.tick_count += 1

        # 1. Update wait times for queued jobs
        for job in list(self.ready_queue):
            if job.status == JobStatus.WAITING:
                job.wait_time += dt
                if job.wait_time >= self.starvation_limit and self.tick_count % 10 == 0:
                    self._log(
                        f"STARVATION PREVENTED: '{job.name}' waited {job.wait_time:.1f}s",
                        "starvation_prevented",
                        job.id,
                    )

        # 2. Advance running jobs and collect finished ones
        finished: List[Job] = []
        for job in list(self.running_jobs):
            job.remaining_time -= dt
            if job.remaining_time <= 0:
                job.remaining_time = 0.0
                finished.append(job)

        # 3. Complete finished jobs
        for job in finished:
            self.running_jobs.remove(job)
            self.resources.release(job)
            job.status = JobStatus.COMPLETED
            self.completed_jobs.append(job)
            self._jobs_completed += 1
            self._total_wait_accumulated += job.wait_time
            self._throughput_window.append(self.current_time)

            if job.is_deadline_missed(self.current_time):
                self._deadlines_missed += 1
                self._log(
                    f"MISSED DEADLINE: '{job.name}' completed late",
                    "job_completed_late",
                    job.id,
                )
            else:
                self._log(
                    f"COMPLETED: '{job.name}' finished on time",
                    "job_completed",
                    job.id,
                )

        # 4. Deadline warnings for active jobs
        for job in list(self.ready_queue) + list(self.running_jobs):
            ttd = job.time_to_deadline(self.current_time)
            if 0 < ttd < 5 and self.tick_count % 4 == 0:
                self._log(
                    f"DEADLINE WARNING: '{job.name}' expires in {ttd:.1f}s",
                    "deadline_warning",
                    job.id,
                )

        # 5. Preemption check: preempt lowest-score running job if a higher-score
        #    waiting job cannot fit in available resources
        for waiting_job in list(self.ready_queue):
            if waiting_job.status != JobStatus.WAITING:
                continue
            if self.resources.can_run(waiting_job):
                continue  # will be scheduled normally below
            if not self.running_jobs:
                continue

            # Determine effective score of waiting job
            ws = (
                999.0
                if waiting_job.wait_time >= self.starvation_limit
                else compute_score(waiting_job, self.current_time, self.weights)
            )

            lowest = min(
                self.running_jobs,
                key=lambda j: compute_score(j, self.current_time, self.weights),
            )
            rs = compute_score(lowest, self.current_time, self.weights)

            if ws > rs * 1.5:
                self.resources.release(lowest)
                lowest.status = JobStatus.WAITING
                self.running_jobs.remove(lowest)
                self.ready_queue.append(lowest)
                self._log(
                    f"PREEMPTED: '{lowest.name}' preempted by '{waiting_job.name}'",
                    "job_preempted",
                    lowest.id,
                )
                break

        # 6. Schedule eligible waiting jobs
        while True:
            next_job = schedule_next_job(
                self.ready_queue,
                self.current_time,
                self.weights,
                self.starvation_limit,
                self.resources,
            )
            if next_job is None:
                break
            next_job.status = JobStatus.RUNNING
            next_job.score = compute_score(next_job, self.current_time, self.weights)
            if next_job.wait_time >= self.starvation_limit:
                next_job.score = 999.0
            self.resources.allocate(next_job)
            self.ready_queue.remove(next_job)
            self.running_jobs.append(next_job)
            self._log(
                f"STARTED: '{next_job.name}' (score={next_job.score:.4f})",
                "job_started",
                next_job.id,
            )

        # 7. Refresh scores for all queued jobs
        for job in self.ready_queue:
            if job.wait_time >= self.starvation_limit:
                job.score = 999.0
            else:
                job.score = compute_score(job, self.current_time, self.weights)

    # ------------------------------------------------------------------
    # Metrics
    # ------------------------------------------------------------------

    def get_metrics(self) -> Dict[str, Any]:
        total = max(1, self._deadlines_total)
        completed = max(1, self._jobs_completed)
        missed = self._deadlines_missed

        now = self.current_time
        recent = [t for t in self._throughput_window if now - t <= 60]
        throughput = len(recent) / 60.0

        return {
            "total_jobs_submitted": self._deadlines_total,
            "jobs_completed": self._jobs_completed,
            "jobs_running": len(self.running_jobs),
            "jobs_waiting": len(self.ready_queue),
            "deadlines_missed": missed,
            "deadline_miss_rate": round(missed / total, 4),
            "avg_wait_time": round(self._total_wait_accumulated / completed, 2),
            "cpu_utilization": round(self.resources.utilization * 100, 1),
            "throughput_per_min": round(throughput * 60, 2),
            "tick_count": self.tick_count,
        }

    # ------------------------------------------------------------------
    # Decision explanation
    # ------------------------------------------------------------------

    def get_decision_explanation(self, job: Job) -> Dict[str, Any]:
        breakdown = get_score_breakdown(job, self.current_time, self.weights)
        starvation_active = job.wait_time >= self.starvation_limit
        reason: List[str] = []
        if starvation_active:
            reason.append("Starvation guard active - score boosted to 999")
        else:
            if breakdown["urgency_raw"] > 0.1:
                reason.append(
                    f"High urgency (deadline in {breakdown['time_to_deadline']:.1f}s)"
                )
            if breakdown["aging_raw"] > 0.5:
                reason.append(f"Significant aging (waited {job.wait_time:.1f}s)")
            if breakdown["efficiency_raw"] > 0.3:
                reason.append("Resource-efficient job")
            if breakdown["base_priority_norm"] > 0.7:
                reason.append(f"High base priority ({job.priority}/10)")
        return {
            "job_id": job.id,
            "job_name": job.name,
            "starvation_active": starvation_active,
            "effective_score": 999.0 if starvation_active else breakdown["total_score"],
            "breakdown": breakdown,
            "reasoning": reason,
        }

    # ------------------------------------------------------------------
    # Full state snapshot
    # ------------------------------------------------------------------

    def get_state(self) -> Dict[str, Any]:
        return {
            "current_time": round(self.current_time, 2),
            "tick_count": self.tick_count,
            "resources": self.resources.to_dict(),
            "running_jobs": [j.model_dump() for j in self.running_jobs],
            "ready_queue": sorted(
                [j.model_dump() for j in self.ready_queue],
                key=lambda x: x["score"],
                reverse=True,
            ),
            "completed_jobs": [j.model_dump() for j in self.completed_jobs[-20:]],
            "metrics": self.get_metrics(),
            "event_log": self.event_log[-30:],
            "weights": self.weights,
            "starvation_limit": self.starvation_limit,
        }


# ---------------------------------------------------------------------------
# FCFS Scheduler
# ---------------------------------------------------------------------------


class FCFSScheduler:
    """First-Come-First-Served (non-preemptive)."""

    def __init__(self) -> None:
        self.queue: List[Job] = []
        self.completed: List[Job] = []
        self._deadlines_missed = 0
        self._total_wait = 0.0

    def add_jobs(self, jobs: List[Job]) -> None:
        self.queue = sorted(jobs, key=lambda j: j.arrival_time)

    def run_simulation(self, total_time: float, dt: float = 0.5) -> Dict[str, Any]:
        current_time = min((j.arrival_time for j in self.queue), default=0.0)
        running: Optional[Job] = None
        elapsed = 0.0

        while elapsed < total_time and (self.queue or running):
            if running:
                running.remaining_time -= dt
                if running.remaining_time <= 0:
                    running.status = JobStatus.COMPLETED
                    if current_time > running.deadline:
                        self._deadlines_missed += 1
                    self._total_wait += running.wait_time
                    self.completed.append(running)
                    running = None
            if running is None and self.queue:
                job = self.queue.pop(0)
                job.wait_time = max(0.0, current_time - job.arrival_time)
                job.status = JobStatus.RUNNING
                running = job
            for j in self.queue:
                j.wait_time += dt
            current_time += dt
            elapsed += dt

        n = max(1, len(self.completed))
        total = max(1, len(self.completed) + len(self.queue))
        return {
            "algorithm": "FCFS",
            "jobs_completed": len(self.completed),
            "deadlines_missed": self._deadlines_missed,
            "deadline_miss_rate": round(self._deadlines_missed / total, 4),
            "avg_wait_time": round(self._total_wait / n, 2),
            "throughput": round(len(self.completed) / total_time * 60, 2),
        }


# ---------------------------------------------------------------------------
# Round Robin Scheduler
# ---------------------------------------------------------------------------


class RoundRobinScheduler:
    """Round Robin with configurable quantum."""

    def __init__(self, quantum: float = 3.0) -> None:
        self.quantum = quantum
        self.queue: deque = deque()
        self.completed: List[Job] = []
        self._deadlines_missed = 0
        self._total_wait = 0.0

    def add_jobs(self, jobs: List[Job]) -> None:
        for j in sorted(jobs, key=lambda x: x.arrival_time):
            self.queue.append(j)

    def run_simulation(self, total_time: float, dt: float = 0.5) -> Dict[str, Any]:
        current_time = min((j.arrival_time for j in self.queue), default=0.0)
        time_in_quantum = 0.0
        running: Optional[Job] = None
        elapsed = 0.0

        while elapsed < total_time and (self.queue or running):
            if running:
                running.remaining_time -= dt
                time_in_quantum += dt
                if running.remaining_time <= 0:
                    running.status = JobStatus.COMPLETED
                    if current_time > running.deadline:
                        self._deadlines_missed += 1
                    self._total_wait += running.wait_time
                    self.completed.append(running)
                    running = None
                    time_in_quantum = 0.0
                elif time_in_quantum >= self.quantum:
                    running.status = JobStatus.WAITING
                    self.queue.append(running)
                    running = None
                    time_in_quantum = 0.0
            if running is None and self.queue:
                running = self.queue.popleft()
                running.wait_time = max(0.0, current_time - running.arrival_time)
                running.status = JobStatus.RUNNING
            for j in self.queue:
                j.wait_time += dt
            current_time += dt
            elapsed += dt

        n = max(1, len(self.completed))
        total = max(1, len(self.completed) + len(self.queue))
        return {
            "algorithm": "RoundRobin",
            "quantum": self.quantum,
            "jobs_completed": len(self.completed),
            "deadlines_missed": self._deadlines_missed,
            "deadline_miss_rate": round(self._deadlines_missed / total, 4),
            "avg_wait_time": round(self._total_wait / n, 2),
            "throughput": round(len(self.completed) / total_time * 60, 2),
        }


# ---------------------------------------------------------------------------
# Static Priority Scheduler
# ---------------------------------------------------------------------------


class StaticPriorityScheduler:
    """Non-preemptive static priority scheduler."""

    def __init__(self) -> None:
        self.queue: List[Job] = []
        self.completed: List[Job] = []
        self._deadlines_missed = 0
        self._total_wait = 0.0

    def add_jobs(self, jobs: List[Job]) -> None:
        self.queue = list(jobs)

    def run_simulation(self, total_time: float, dt: float = 0.5) -> Dict[str, Any]:
        current_time = min((j.arrival_time for j in self.queue), default=0.0)
        running: Optional[Job] = None
        elapsed = 0.0

        while elapsed < total_time and (self.queue or running):
            if running:
                running.remaining_time -= dt
                if running.remaining_time <= 0:
                    running.status = JobStatus.COMPLETED
                    if current_time > running.deadline:
                        self._deadlines_missed += 1
                    self._total_wait += running.wait_time
                    self.completed.append(running)
                    running = None
            if running is None and self.queue:
                self.queue.sort(key=lambda j: j.priority, reverse=True)
                job = self.queue.pop(0)
                job.wait_time = max(0.0, current_time - job.arrival_time)
                job.status = JobStatus.RUNNING
                running = job
            for j in self.queue:
                j.wait_time += dt
            current_time += dt
            elapsed += dt

        n = max(1, len(self.completed))
        total = max(1, len(self.completed) + len(self.queue))
        return {
            "algorithm": "StaticPriority",
            "jobs_completed": len(self.completed),
            "deadlines_missed": self._deadlines_missed,
            "deadline_miss_rate": round(self._deadlines_missed / total, 4),
            "avg_wait_time": round(self._total_wait / n, 2),
            "throughput": round(len(self.completed) / total_time * 60, 2),
        }


# ---------------------------------------------------------------------------
# Comparison Engine
# ---------------------------------------------------------------------------


class ComparisonEngine:
    """Runs all 4 schedulers on the same job set and returns a comparison."""

    def __init__(self, weights: Optional[Dict[str, float]] = None) -> None:
        self.weights = weights or {"w1": 0.35, "w2": 0.25, "w3": 0.20, "w4": 0.20}

    def _copy_jobs(self, jobs: List[Job]) -> List[Job]:
        return [j.copy_for_simulation() for j in jobs]

    def _run_nexscheduler(self, jobs: List[Job], total_time: float) -> Dict[str, Any]:
        eng = SchedulerEngine(weights=self.weights, starvation_limit=30.0, tick_interval=0.5)
        for j in jobs:
            eng.add_job(j)
        steps = int(total_time / 0.5)
        for _ in range(steps):
            eng.tick()
        m = eng.get_metrics()
        return {
            "algorithm": "NexScheduler (AI)",
            "jobs_completed": m["jobs_completed"],
            "deadlines_missed": m["deadlines_missed"],
            "deadline_miss_rate": m["deadline_miss_rate"],
            "avg_wait_time": m["avg_wait_time"],
            "throughput": m["throughput_per_min"],
        }

    def run(self, jobs: List[Job], simulation_duration: float = 120.0) -> Dict[str, Any]:
        """Run all 4 algorithms and return comparison results."""
        nex = self._run_nexscheduler(self._copy_jobs(jobs), simulation_duration)

        fcfs = FCFSScheduler()
        fcfs.add_jobs(self._copy_jobs(jobs))
        fcfs_r = fcfs.run_simulation(simulation_duration)

        rr = RoundRobinScheduler(quantum=3.0)
        rr.add_jobs(self._copy_jobs(jobs))
        rr_r = rr.run_simulation(simulation_duration)

        sp = StaticPriorityScheduler()
        sp.add_jobs(self._copy_jobs(jobs))
        sp_r = sp.run_simulation(simulation_duration)

        results = [nex, fcfs_r, rr_r, sp_r]
        winner = min(results, key=lambda r: (r["deadline_miss_rate"], r["avg_wait_time"]))

        return {
            "simulation_duration": simulation_duration,
            "job_count": len(jobs),
            "results": results,
            "winner": winner["algorithm"],
            "summary": {
                r["algorithm"]: {
                    "deadline_miss_rate_pct": round(r["deadline_miss_rate"] * 100, 1),
                    "avg_wait_time": r["avg_wait_time"],
                    "throughput_per_min": r.get("throughput", 0),
                }
                for r in results
            },
        }

"""
models.py - Pydantic/dataclass models for NexScheduler AI
"""
from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class JobStatus(str, Enum):
    WAITING = "waiting"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BasePriorityLabel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


def _priority_to_label(priority: int) -> BasePriorityLabel:
    if priority <= 2:
        return BasePriorityLabel.LOW
    elif priority <= 5:
        return BasePriorityLabel.MEDIUM
    elif priority <= 8:
        return BasePriorityLabel.HIGH
    else:
        return BasePriorityLabel.CRITICAL


class Job(BaseModel):
    """Core job model for the scheduler."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    priority: int = Field(ge=1, le=10, description="Base priority 1-10")
    deadline: float = Field(description="Absolute deadline timestamp (epoch seconds)")
    burst_time: float = Field(gt=0, description="Total CPU time required (seconds)")
    cpu_units: float = Field(ge=0, le=8, description="CPU cores required")
    gpu_units: float = Field(ge=0, le=2, description="GPU units required")
    ram_units: float = Field(ge=0, le=32, description="RAM GB required")

    # Runtime fields
    arrival_time: float = Field(default_factory=time.time)
    wait_time: float = Field(default=0.0)
    status: JobStatus = Field(default=JobStatus.WAITING)
    score: float = Field(default=0.0)
    remaining_time: float = Field(default=0.0)
    base_priority_label: BasePriorityLabel = Field(default=BasePriorityLabel.MEDIUM)

    model_config = {"use_enum_values": True}

    @model_validator(mode="after")
    def set_derived_fields(self) -> "Job":
        if self.remaining_time == 0.0:
            self.remaining_time = self.burst_time
        self.base_priority_label = _priority_to_label(self.priority)
        return self

    def time_to_deadline(self, current_time: float) -> float:
        """Seconds remaining until deadline."""
        return max(0.0, self.deadline - current_time)

    def is_deadline_missed(self, current_time: float) -> bool:
        return current_time > self.deadline and self.status != JobStatus.COMPLETED

    def copy_for_simulation(self) -> "Job":
        """Deep-copy this job for use in comparison simulations."""
        return Job(
            id=self.id,
            name=self.name,
            priority=self.priority,
            deadline=self.deadline,
            burst_time=self.burst_time,
            cpu_units=self.cpu_units,
            gpu_units=self.gpu_units,
            ram_units=self.ram_units,
            arrival_time=self.arrival_time,
            wait_time=0.0,
            status=JobStatus.WAITING,
            score=0.0,
            remaining_time=self.burst_time,
        )


class JobCreateRequest(BaseModel):
    """Request body for creating a new job."""

    name: str
    priority: int = Field(default=5, ge=1, le=10)
    deadline_offset: float = Field(
        default=60.0, gt=0, description="Seconds from now until deadline"
    )
    burst_time: float = Field(default=5.0, gt=0)
    cpu_units: float = Field(default=1.0, ge=0, le=8)
    gpu_units: float = Field(default=0.0, ge=0, le=2)
    ram_units: float = Field(default=2.0, ge=0, le=32)

    def to_job(self) -> Job:
        now = time.time()
        return Job(
            name=self.name,
            priority=self.priority,
            deadline=now + self.deadline_offset,
            burst_time=self.burst_time,
            cpu_units=self.cpu_units,
            gpu_units=self.gpu_units,
            ram_units=self.ram_units,
            arrival_time=now,
            remaining_time=self.burst_time,
        )


class SchedulerSettings(BaseModel):
    tick_interval: float = Field(default=0.5, ge=0.1, le=5.0)
    starvation_limit: float = Field(default=30.0, gt=0)
    weights: dict = Field(
        default_factory=lambda: {
            "w1": 0.35,
            "w2": 0.25,
            "w3": 0.20,
            "w4": 0.20,
        }
    )


class ResourceState(BaseModel):
    total_cpu: float = 8.0
    total_gpu: float = 2.0
    total_ram: float = 32.0
    used_cpu: float = 0.0
    used_gpu: float = 0.0
    used_ram: float = 0.0

    @property
    def available_cpu(self) -> float:
        return self.total_cpu - self.used_cpu

    @property
    def available_gpu(self) -> float:
        return self.total_gpu - self.used_gpu

    @property
    def available_ram(self) -> float:
        return self.total_ram - self.used_ram

    @property
    def utilization(self) -> float:
        return self.used_cpu / self.total_cpu if self.total_cpu > 0 else 0.0

    def can_run(self, job: Job) -> bool:
        return (
            self.available_cpu >= job.cpu_units
            and self.available_gpu >= job.gpu_units
            and self.available_ram >= job.ram_units
        )

    def allocate(self, job: Job) -> None:
        self.used_cpu += job.cpu_units
        self.used_gpu += job.gpu_units
        self.used_ram += job.ram_units

    def release(self, job: Job) -> None:
        self.used_cpu = max(0.0, self.used_cpu - job.cpu_units)
        self.used_gpu = max(0.0, self.used_gpu - job.gpu_units)
        self.used_ram = max(0.0, self.used_ram - job.ram_units)

    def to_dict(self) -> dict:
        return {
            "total_cpu": self.total_cpu,
            "total_gpu": self.total_gpu,
            "total_ram": self.total_ram,
            "used_cpu": round(self.used_cpu, 2),
            "used_gpu": round(self.used_gpu, 2),
            "used_ram": round(self.used_ram, 2),
            "available_cpu": round(self.available_cpu, 2),
            "available_gpu": round(self.available_gpu, 2),
            "available_ram": round(self.available_ram, 2),
            "utilization_pct": round(self.utilization * 100, 1),
        }

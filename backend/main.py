"""
main.py - FastAPI application for NexScheduler AI
REST API + WebSocket for real-time scheduling simulation.
"""
from __future__ import annotations

import asyncio
import json
import random
import string
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Set

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_agent import AIAgent
from models import Job, JobCreateRequest, JobStatus, SchedulerSettings
from scenarios import SCENARIO_INFO, load_scenario
from scheduler import ComparisonEngine, SchedulerEngine


# ---------------------------------------------------------------------------
# Singleton state
# ---------------------------------------------------------------------------

engine: SchedulerEngine = SchedulerEngine()
ai_agent: AIAgent = AIAgent()
settings: SchedulerSettings = SchedulerSettings()

_paused: bool = False
_tick_task: Optional[asyncio.Task] = None
_ws_clients: Set[WebSocket] = set()


# ---------------------------------------------------------------------------
# Background tick loop
# ---------------------------------------------------------------------------

async def _tick_loop() -> None:
    """Runs scheduler.tick() every tick_interval seconds."""
    while True:
        await asyncio.sleep(settings.tick_interval)
        if not _paused:
            engine.tick()

            # Feed AI agent
            m = engine.get_metrics()
            ai_agent.observe_metrics(
                deadline_miss_rate=m["deadline_miss_rate"],
                avg_wait=m["avg_wait_time"],
                utilization=m["cpu_utilization"] / 100.0,
            )

            # Auto-retrain if needed
            needs_retrain, reason = ai_agent.should_retrain()
            if needs_retrain:
                new_weights = ai_agent.retrain()
                engine.weights = new_weights
                engine._log(
                    f"AI retrained weights ({reason}): {new_weights}",
                    "ai_retrain",
                )

            # Broadcast state to WebSocket clients
            await _broadcast_state()


async def _broadcast_state() -> None:
    """Push full state JSON to all connected WebSocket clients."""
    if not _ws_clients:
        return
    payload = json.dumps(_build_full_state(), default=str)
    dead: Set[WebSocket] = set()
    for ws in list(_ws_clients):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


def _build_full_state() -> Dict[str, Any]:
    """Assemble the complete system state snapshot."""
    state = engine.get_state()
    state["ai_status"] = ai_agent.get_status()
    state["paused"] = _paused
    state["settings"] = {
        "tick_interval": settings.tick_interval,
        "starvation_limit": settings.starvation_limit,
        "weights": settings.weights,
    }
    state["scenario_info"] = SCENARIO_INFO
    return state


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _tick_task
    # Load Scenario 1 on startup
    engine.reset()
    for j in load_scenario(1):
        engine.add_job(j)
    _tick_task = asyncio.create_task(_tick_loop())
    yield
    if _tick_task:
        _tick_task.cancel()
        try:
            await _tick_task
        except asyncio.CancelledError:
            pass


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NexScheduler AI",
    description="AI-powered process scheduling simulation backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class GenerateJobsRequest(BaseModel):
    count: int = Field(default=5, ge=1, le=50)


class UpdateSettingsRequest(BaseModel):
    tick_interval: Optional[float] = None
    starvation_limit: Optional[float] = None
    weights: Optional[Dict[str, float]] = None


# ---------------------------------------------------------------------------
# Random job generator
# ---------------------------------------------------------------------------

_JOB_TEMPLATES = [
    ("WebRequest",   1,  2,  0),
    ("BatchProcess", 4, 20,  0),
    ("MLTrain",      8, 30,  1),
    ("DBQuery",      2,  5,  0),
    ("VideoEncode",  6, 25,  1),
    ("ReportGen",    3, 15,  0),
    ("AlertHandler", 1,  3,  0),
    ("DataSync",     5, 12,  0),
    ("CacheWarm",    2,  8,  0),
    ("HealthCheck",  1,  2,  0),
]


def generate_random_jobs(count: int) -> List[Job]:
    """Generate `count` random jobs with varied characteristics."""
    jobs: List[Job] = []
    for _ in range(count):
        name_base, cpu_max, burst_max, gpu_max = random.choice(_JOB_TEMPLATES)
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        name = f"{name_base}-{suffix}"
        priority = random.randint(1, 10)
        deadline_offset = random.uniform(10.0, 180.0)
        burst_time = random.uniform(1.0, float(burst_max))
        cpu_units = float(random.randint(1, max(1, cpu_max)))
        gpu_units = float(random.choice([0, 0, 0, gpu_max]))
        ram_units = float(random.randint(1, 16))

        jobs.append(
            Job(
                name=name,
                priority=priority,
                deadline=time.time() + deadline_offset,
                burst_time=burst_time,
                cpu_units=min(cpu_units, 8.0),
                gpu_units=min(gpu_units, 2.0),
                ram_units=min(ram_units, 32.0),
                arrival_time=time.time(),
                remaining_time=burst_time,
            )
        )
    return jobs


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "message": "NexScheduler AI backend running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "paused": _paused,
        "tick_count": engine.tick_count,
        "ws_clients": len(_ws_clients),
    }


@app.get("/api/state")
async def get_state():
    """Return full system state."""
    return _build_full_state()


@app.post("/api/jobs", status_code=201)
async def add_job(request: JobCreateRequest):
    """Add a new job to the scheduler."""
    job = request.to_job()
    engine.add_job(job)
    return {"message": "Job added", "job": job.model_dump()}


@app.delete("/api/jobs/{job_id}")
async def remove_job(job_id: str):
    """Remove a job by ID."""
    removed = engine.remove_job(job_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return {"message": f"Job '{job_id}' removed"}


@app.post("/api/scenario/{scenario_id}")
async def load_scenario_endpoint(scenario_id: int):
    """Load a pre-defined scenario (1-4)."""
    if scenario_id not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Scenario ID must be 1-4")
    engine.reset()
    jobs = load_scenario(scenario_id)
    for j in jobs:
        engine.add_job(j)
    info = SCENARIO_INFO.get(scenario_id, {})
    return {
        "message": f"Scenario {scenario_id} loaded",
        "scenario": info,
        "job_count": len(jobs),
    }


@app.post("/api/reset")
async def reset_scheduler():
    """Reset the scheduler to empty state."""
    global ai_agent
    engine.reset()
    ai_agent = AIAgent()
    return {"message": "Scheduler reset"}


@app.post("/api/pause")
async def pause_simulation():
    """Pause the simulation."""
    global _paused
    _paused = True
    return {"message": "Simulation paused", "paused": True}


@app.post("/api/resume")
async def resume_simulation():
    """Resume the simulation."""
    global _paused
    _paused = False
    return {"message": "Simulation resumed", "paused": False}


@app.post("/api/generate")
async def generate_jobs(request: GenerateJobsRequest):
    """Generate N random jobs and add them to the scheduler."""
    jobs = generate_random_jobs(request.count)
    for j in jobs:
        engine.add_job(j)
    return {
        "message": f"Generated {request.count} random jobs",
        "jobs": [j.model_dump() for j in jobs],
    }


@app.post("/api/settings")
async def update_settings(request: UpdateSettingsRequest):
    """Update scheduler settings (tick_interval, starvation_limit, weights)."""
    if request.tick_interval is not None:
        if not (0.1 <= request.tick_interval <= 5.0):
            raise HTTPException(
                status_code=400, detail="tick_interval must be between 0.1 and 5.0"
            )
        settings.tick_interval = request.tick_interval

    if request.starvation_limit is not None:
        if request.starvation_limit <= 0:
            raise HTTPException(
                status_code=400, detail="starvation_limit must be > 0"
            )
        settings.starvation_limit = request.starvation_limit
        engine.starvation_limit = request.starvation_limit

    if request.weights is not None:
        required = {"w1", "w2", "w3", "w4"}
        if not required.issubset(set(request.weights.keys())):
            raise HTTPException(
                status_code=400, detail=f"weights must contain keys: {required}"
            )
        total = sum(request.weights.values())
        normalized = {k: round(v / total, 4) for k, v in request.weights.items()}
        settings.weights = normalized
        engine.weights = normalized
        ai_agent.weights = normalized

    return {
        "message": "Settings updated",
        "settings": {
            "tick_interval": settings.tick_interval,
            "starvation_limit": settings.starvation_limit,
            "weights": settings.weights,
        },
    }


@app.get("/api/comparison/{scenario_id}")
async def get_comparison(scenario_id: int):
    """Run all 4 algorithms on a scenario and return comparison metrics."""
    if scenario_id not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Scenario ID must be 1-4")
    jobs = load_scenario(scenario_id)
    comparison_engine = ComparisonEngine(weights=engine.weights)
    result = comparison_engine.run(jobs, simulation_duration=120.0)
    result["scenario_id"] = scenario_id
    result["scenario_info"] = SCENARIO_INFO.get(scenario_id, {})
    return result


@app.get("/api/jobs/{job_id}/explanation")
async def get_job_explanation(job_id: str):
    """Get AI score breakdown and decision explanation for a specific job."""
    all_jobs = engine.ready_queue + engine.running_jobs
    job = next((j for j in all_jobs if j.id == job_id), None)
    if not job:
        raise HTTPException(
            status_code=404, detail=f"Job '{job_id}' not found in active queue"
        )
    return engine.get_decision_explanation(job)


@app.get("/api/scenarios")
async def list_scenarios():
    """List all available scenarios with metadata."""
    return {"scenarios": SCENARIO_INFO}


@app.get("/api/metrics")
async def get_metrics():
    """Get current scheduler metrics and resource state."""
    return {
        "metrics": engine.get_metrics(),
        "resources": engine.resources.to_dict(),
        "ai_status": ai_agent.get_status(),
    }


@app.get("/api/events")
async def get_events(limit: int = 50):
    """Get recent event log entries."""
    return {"events": engine.event_log[-limit:]}


@app.get("/api/ai/status")
async def get_ai_status():
    """Get AI agent status and current weights."""
    return ai_agent.get_status()


@app.post("/api/ai/retrain")
async def trigger_retrain():
    """Manually trigger AI weight retraining."""
    new_weights = ai_agent.retrain()
    engine.weights = new_weights
    return {
        "message": "AI retrained",
        "new_weights": new_weights,
        "retrain_count": ai_agent.retrain_count,
    }


# ---------------------------------------------------------------------------
# WebSocket /ws/live
# ---------------------------------------------------------------------------

@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """
    WebSocket endpoint: streams full state every tick_interval.
    Client can send 'ping' to receive 'pong'.
    """
    await websocket.accept()
    _ws_clients.add(websocket)
    try:
        # Send initial state immediately
        await websocket.send_text(json.dumps(_build_full_state(), default=str))
        # Keep connection alive; broadcasts are done in the tick loop
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if msg == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Heartbeat to keep the connection alive
                await websocket.send_text(
                    json.dumps({"type": "heartbeat", "ts": time.time()})
                )
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _ws_clients.discard(websocket)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

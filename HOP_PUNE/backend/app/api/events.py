"""
Disruption endpoints. TRD v2 §10.

POST /disruptions triggers a graph run asynchronously and returns immediately
with the disruption's id; the WS channel carries live status as the agent
progresses. Idempotency (TRD v2 §13): re-firing against a disruption that
already has an open decision is rejected rather than double-negotiating.
"""
import asyncio
import os

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.agent.graph import run_disruption
from app.api.schemas import DisruptionCreateRequest, DisruptionResponse
from app.api.ws import manager
from app.db.models import Decision, DisruptionEvent
from app.db.session import get_session

router = APIRouter(prefix="/disruptions", tags=["disruptions"])

_OPEN_STATUSES = {"pending_approval"}  # ONLY a decision genuinely awaiting a human
# blocks a new injection on the same PO. auto_executed/approved/rejected are terminal —
# a PO that was already resolved can still face a NEW, different disruption later, and
# blocking that is wrong. Originally included "auto_executed" here too, which broke the
# demo's own test flow: Scenario 1 (Baseline Delay) and Scenario 3 (Claim Mismatch) both
# intentionally target PO-7712 per Backend Schema v2 §4 ("Scenario 3 reuses PO-7712 from
# Scenario 1") — after Scenario 1 auto-executes, injecting Scenario 3 on the same PO is
# supposed to work, not get blocked as a false "duplicate."


@router.get("", response_model=list[DisruptionResponse])
def list_disruptions():
    session = get_session()
    try:
        rows = session.query(DisruptionEvent).order_by(DisruptionEvent.created_at.desc()).all()
        return rows
    finally:
        session.close()


@router.get("/{disruption_id}", response_model=DisruptionResponse)
def get_disruption(disruption_id: str):
    session = get_session()
    try:
        row = session.query(DisruptionEvent).filter_by(id=disruption_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Disruption not found")
        return row
    finally:
        session.close()


@router.post("", response_model=DisruptionResponse, status_code=201)
async def create_disruption(body: DisruptionCreateRequest, background_tasks: BackgroundTasks):
    session = get_session()
    try:
        existing_decision = None
        if body.po_id:
            existing_open = (
                session.query(DisruptionEvent)
                .join(Decision, Decision.disruption_id == DisruptionEvent.id)
                .filter(DisruptionEvent.po_id == body.po_id, Decision.status.in_(_OPEN_STATUSES))
                .first()
            )
            if existing_open:
                raise HTTPException(
                    status_code=409,
                    detail=f"An open decision already exists for PO {body.po_id} — "
                    f"resolve or reject it before injecting a new disruption on the same PO.",
                )

        disruption = DisruptionEvent(
            event_type=body.event_type,
            po_id=body.po_id,
            production_order_id=body.production_order_id,
            raw_payload=body.raw_payload,
        )
        session.add(disruption)
        session.commit()
        session.refresh(disruption)

        await manager.broadcast(
            "disruption_ingested",
            {"disruption_id": disruption.id, "event_type": disruption.event_type},
        )

        background_tasks.add_task(_run_and_broadcast, disruption.id)
        return disruption
    finally:
        session.close()


def _run_and_broadcast(disruption_id: str) -> None:
    """
    Runs synchronously in a background thread (FastAPI's BackgroundTasks).
    Broadcasts are fired via asyncio.run since this executes outside the
    request's event loop — acceptable for a hackathon timeline; a production
    version would use a proper task queue (Celery/RQ) instead.

    Passes on_step through to run_disruption() so the frontend gets a live
    "status" broadcast at EVERY major transition (triaging, assessing_coverage,
    verifying_claim, claim_contradicted, negotiating, validating, replanning),
    not just one at the start and one at the end. This is what makes the
    live-feed pulsing/status-color transitions in the dashboard reflect the
    agent's real progress instead of just "processing... done."
    """
    session = get_session()
    try:
        def on_step(status: str, payload: dict):
            asyncio.run(manager.broadcast("status", {"status": status, **payload}))

        secret_key = os.environ.get("AUDIT_HMAC_KEY", "dev-secret-change-me").encode()
        # today intentionally omitted — run_disruption() defaults to seed_data.TODAY
        # (the fixed seed epoch), not the real wall-clock date. Passing date.today()
        # here would reintroduce the exact deadline-mismatch bug already caught and
        # fixed twice elsewhere (app/agent/graph.py, run_scenario.py) — see the note
        # in run_disruption()'s docstring for the full story.
        final_state = run_disruption(disruption_id, session, secret_key=secret_key, on_step=on_step)

        asyncio.run(
            manager.broadcast(
                "status",
                {
                    "disruption_id": disruption_id,
                    "status": final_state.get("execution_status") or (
                        "pending_approval" if final_state["requires_approval"] else "unknown"
                    ),
                    "decision_id": final_state.get("decision_id"),
                    "computed_risk": final_state.get("computed_risk"),
                },
            )
        )
    except Exception as e:
        asyncio.run(
            manager.broadcast(
                "error", {"disruption_id": disruption_id, "error": str(e)}
            )
        )
        raise
    finally:
        session.close()

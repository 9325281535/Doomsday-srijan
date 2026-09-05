"""
Minimal WebSocket connection manager. TRD v2 §10 — pushes live status through
every named state in App Flow v2 §8 (ingested -> triaging -> assessing_coverage
-> verifying_claim -> negotiating -> scoring -> validating -> auto_executed /
pending_approval / replanning). The frontend dashboard subscribes here instead
of polling for each disruption's progress.
"""
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"type": event_type, "payload": payload}, default=str)
        stale: list[WebSocket] = []
        for connection in self.active:
            try:
                await connection.send_text(message)
            except Exception:
                stale.append(connection)
        for s in stale:
            self.disconnect(s)


manager = ConnectionManager()

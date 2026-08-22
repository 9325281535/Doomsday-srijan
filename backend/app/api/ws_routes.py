"""
The /ws/live route itself, separate from ws.py's ConnectionManager so the
manager can be imported by events.py/decisions.py without circular imports.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.ws import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect the client to send anything meaningful, but need
            # to await something to detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

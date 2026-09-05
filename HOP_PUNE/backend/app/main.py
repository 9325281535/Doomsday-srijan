"""
FastAPI app entrypoint. Run with: uvicorn app.main:app --reload

Wires together every router from TRD v2 §10's endpoint table:
  POST/GET /disruptions           -> app.api.events
  GET /decisions, /approve|reject -> app.api.decisions
  GET /audit, /audit/verify       -> app.api.audit
  GET /supplier-messages          -> app.api.messages
  WS  /ws/live                    -> app.api.ws_routes
"""
import app.config  # noqa: F401 — loads .env before anything below reads os.environ
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import audit, decisions, events, inventory, messages, production_orders, security as security_routes, suppliers, ws_routes
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Trace — Supply Chain Disruption Control Agent", lifespan=lifespan)

# Loose CORS for hackathon speed — tighten this if you deploy anywhere the
# frontend isn't the only consumer.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(decisions.router)
app.include_router(audit.router)
app.include_router(messages.router)
app.include_router(inventory.router)
app.include_router(suppliers.router)
app.include_router(production_orders.router)
app.include_router(security_routes.router)
app.include_router(ws_routes.router)


@app.get("/health")
def health():
    return {"status": "ok"}

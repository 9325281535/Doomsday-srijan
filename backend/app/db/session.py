"""
Engine/session setup. Reads DATABASE_URL from the environment (your Neon connection
string in production). Falls back to a local SQLite file when DATABASE_URL isn't
set, so `python -m app.services.seed_data` works out of the box for local dev
and CI without needing Postgres running.
"""
import app.config  # noqa: F401 — loads .env before we read os.environ below
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./trace_scda_dev.db")

# check_same_thread only matters for SQLite; harmless to pass for Postgres via URL scheme check
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    """Create all tables. For a hackathon timeline this is fine; swap to Alembic
    migrations (see Implementation Plan v2 Phase 1) once the schema stabilizes."""
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()

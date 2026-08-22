# Trace — Supply Chain Disruption Control Agent

Backend scaffold for Hackers Occupied Pune 2026. Companion to the PRD/TRD/App Flow/
UI-UX/Backend Schema/Implementation Plan docs (v2, procurement/supplier version).

## Status — what's actually been verified vs. what's written-but-untested

This was built in a sandbox with **no PyPI access**, so verification split into two tiers:

**✅ Verified — 19/19 tests passing, actually executed:**
- `app/services/coverage.py` — production-risk math
- `app/services/constraints.py` — MOQ/quality/deadline/safety-stock rules
- `app/services/supplier_scoring.py` — weighted scorer + split-order allocation
- `app/services/claim_verification.py` — the adversarial-supplier check
- `app/services/hashing.py` — tamper-evident audit chain (including the "snap the chain" case)

Run these yourself: `python run_tests_no_pytest.py` (no dependencies needed beyond
the standard library) or `pytest tests/` once you've installed `requirements.txt`.

**⚠️ Written, syntax-checked, but NOT executed — needs `sqlalchemy`/`langgraph`/`langchain-groq` installed:**
- `app/db/models.py`, `app/db/session.py` — SQLAlchemy models
- `app/services/seed_data.py` — seeds all 4 PS scenarios
- `app/agent/*` — LangGraph state, tools, prompts, nodes, orchestration
- `proof_integration.py` — end-to-end proof script

**Please run the steps below and report back anything that breaks.**

## Setup

```bash
cd backend
python -m venv venv && source venv/bin/activate   # or your preferred env manager
pip install -r requirements.txt
cp .env.example .env
# edit .env: set GROQ_API_KEY (get one at console.groq.com), leave DATABASE_URL as-is for local dev
```

## Step 1 — verify the deterministic core (should already pass, just confirming your env matches)

```bash
pytest tests/ -v
```
Expect: 19 passed.

## Step 2 — seed the database and prove the DB layer works

```bash
python -m app.services.seed_data
python proof_integration.py
```

Expect: prints coverage/scoring/plan output for all 4 scenarios, ending with
`=== ALL INTEGRATION CHECKS PASSED ===`. **This is the first time this code will
actually run** — if it breaks, the error message + traceback is exactly what I need
to fix it.

## Step 3 — run one real agent loop against Groq

```bash
python -m app.agent.graph
```

This pulls the first seeded disruption event and runs it through the full
triage → impact_analysis → verify_claim → negotiate (real Groq tool-calling) →
score → validate → plan → decide → execute/escalate → audit_write sequence, then
prints the final state as JSON. **This is the least-tested part of the whole
scaffold** — the tool-calling loop in `graph.py`'s `_tool_calling_loop` follows
documented LangChain/LangGraph patterns but has never actually talked to Groq.
Expect to need to debug this one a bit.

## Step 4 — run the API server and smoke-test it

```bash
uvicorn app.main:app --reload
```

In another terminal:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/disruptions

curl -X POST http://127.0.0.1:8000/disruptions \
  -H "Content-Type: application/json" \
  -d "{\"event_type\": \"delay\", \"po_id\": \"PO-7712\", \"production_order_id\": \"PROD-882\", \"raw_payload\": {\"component_id\": \"COMP-104\", \"notes\": \"test\"}}"

curl http://127.0.0.1:8000/decisions
curl http://127.0.0.1:8000/audit/verify
```

Also open `http://127.0.0.1:8000/docs` — FastAPI's auto-generated Swagger UI, useful
for poking every endpoint by hand without writing curl commands. **This entire
layer (`app/api/`) is untested** — same caveat as the agent graph in Step 3.

## Step 5 — verify replanning works end-to-end

```bash
python run_replan_scenario.py
```

Expect: Phase 1 shows `shortfall_units: 0` / `computed_risk: Low` (correct —
that's the point, it's running on stale data). Phase 2 shows
`shortfall_units: 310` / `computed_risk: High` or `Critical`, and the final
assertions confirm Decision 1 flipped to `status: replanned` and Decision 2's
`replan_of` correctly points back to it. Ends with `ALL REPLAN CHECKS PASSED`.

## ⚠️ Before Step 6 — delete your local DB, schema changed

This session added a new table (`supplier_trust_events`) and a new column
(`decisions.tool_call_count`). `init_db()`'s `Base.metadata.create_all()`
only creates tables that don't exist yet — it will NOT add a new column to
your existing `trace_scda_dev.db`. Delete it so it gets recreated fresh:

```powershell
Remove-Item trace_scda_dev.db -ErrorAction SilentlyContinue
python -m app.services.seed_data
```

(If you've already deployed to Neon/Postgres by the time you read this, the
same problem applies there — you'd need an actual `ALTER TABLE`, not just a
reseed. Flagging now since deployment hasn't happened yet in this
conversation, so there's no production data at risk yet.)

## Step 6 — verify the two new hidden-test scenarios

```bash
python run_hidden_tests.py
```

Tests demand-spike and expedite-unavailable — the two categories flagged in
`HIDDEN_TEST_COVERAGE.md` as "logic verified, never actually run." Expect
both to print `PASS` and end with `BOTH HIDDEN TESTS PASSED`.

## Step 7 — verify cross-order prioritization (PS §8 Scenario 6)

```bash
python run_reprioritization_test.py
```

Seeds two production orders sharing one component — a high-priority one
that's short, a low-priority one with slack. Confirms the agent correctly
proposes delaying the low-priority order rather than ignoring the contention.
Ends with `PASS`.

## Deployment (Render)

`Procfile` and `render.yaml` are included. On Render:
1. New Web Service → connect this repo (`backend/` as root if monorepo).
2. Render auto-detects `render.yaml` — it'll prompt for `GROQ_API_KEY`,
   `DATABASE_URL`, `AUDIT_HMAC_KEY` (marked `sync: false` so you enter them
   in Render's dashboard, not commit them).
3. **`DATABASE_URL` must point to a real Postgres instance (Neon) in
   production** — Render's filesystem is ephemeral, so the SQLite fallback
   (`sqlite:///./trace_scda_dev.db`) will lose all data on every redeploy/restart.
   Create a free Neon project, copy its connection string in.
4. After first deploy, reseed against the deployed DB once:
   `python -m app.services.seed_data` won't run automatically — either add
   it as Render's build command temporarily, or run it locally with
   `DATABASE_URL` pointed at the same Neon instance.

## What's new in this session (replanning + resilience)

- **Real replanning** now works end-to-end (previously only hand-verified
  math, never actually run through the live agent — see `run_replan_scenario.py`).
  Scenario 2 moved to its own component/PO (`COMP-205`/`PROD-950`) instead of
  sharing `COMP-104` with Scenarios 1/3/5, since mutating shared data would
  have broken their shortfall math.
- **New endpoint**: `POST /components/{id}/correct` — triggers Phase 2 of the
  replan flow (applies the corrected stock figure, auto-creates and runs the
  follow-up disruption).
- **`replan_of` linkage is real**: the superseded decision's status flips to
  `'replanned'` and a `superseded_by_replan` audit entry is written, matching
  App Flow v2 Flow D exactly.
- **Live per-step WS broadcasts**: `run_disruption()` now takes an optional
  `on_step` callback, fired at every major transition — including a distinct
  `claim_contradicted` status the instant `verify_claim` catches a lie, for
  the frontend's trust-alert flash to key off in real time, not after the fact.
- **Tool-call retry**: one retry then a structured error result instead of a
  crash, per TRD v2 §13's NFR.
- **Persistent supplier trust memory** — new `supplier_trust_events` table
  and `GET /suppliers/trust` endpoint. Previously, a caught lie only ever
  affected THAT decision's candidate scoring, and in practice never even did
  that (the lying supplier gets excluded from negotiation, so the scoring
  penalty was dead code). Now every contradiction is recorded permanently,
  queryable as "SUP-21: 2 claims contradicted."
- **Tool-call count on every decision** — `decisions.tool_call_count`,
  returned by the API. Directly demoable for the "Tool Efficiency" score
  category (10%), which previously only existed as unstructured log text.
- **`HIDDEN_TEST_COVERAGE.md`** — honest mapping of all 10 of PS §7's hidden-
  test categories to what's actually implemented/tested vs. not.
- **`run_hidden_tests.py`** — live-fires 2 previously-untested categories
  (demand spike, expedite unavailable) through the real agent.

## What's deliberately NOT here yet

- Alembic migrations — using `Base.metadata.create_all()` via `init_db()` for now,
  per Implementation Plan v2 Phase 1's "fine for a hackathon timeline" note
- Frontend — untouched, per App Flow v2 / UI/UX Brief v2 (your friend's territory)
- A real task queue for the background disruption-processing job — `app/api/events.py`
  uses FastAPI's `BackgroundTasks` + a blocking `asyncio.run()` for WS broadcasts,
  which is fine for one demo user but won't scale past that
- The compiled `langgraph.StateGraph` — `build_graph()` in `app/agent/graph.py`
  is still a documented stub; `run_disruption()`'s hand-written sequential
  orchestration is what actually runs

## If something breaks

Paste me the traceback. Given the layering (services -> agent nodes -> graph
orchestration), a failure is almost always in exactly one of these three places,
and the reasoning_trace list in the returned state usually shows how far it got
before failing.

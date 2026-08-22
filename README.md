# Trace — Supply Chain Disruption Control Agent

**Hackers Occupied Pune 2026 · Agentic AI Track**

An autonomous agent that detects supply-chain disruptions, investigates using real tools, negotiates with suppliers, verifies claims against ground-truth data, reasons across cost/quality/deadline trade-offs, executes or escalates decisions, and produces a tamper-evident audit trail — built against the official "Supply Chain Disruption Control Agent" problem statement.

---

## What makes this genuinely agentic, not a scripted workflow

- **The LLM chooses which tools to call**, not a fixed sequence — the negotiation step is a real ReAct-style tool-calling loop against Groq (`openai/gpt-oss-120b`), not hardcoded API calls.
- **It catches a supplier lying.** When a supplier claims a shipment was dispatched, the agent cross-checks tracking data before trusting the claim — and remembers it, via persistent cross-run trust memory, not just within one decision.
- **Constraint and cost decisions are deterministic Python**, never left to the LLM. Budget thresholds, quality floors, MOQ, and deadlines are hard-checked in code; the LLM only chooses among already-validated options and explains *why*. This means the agent can never hallucinate its way past a business rule.
- **Real replanning.** When corrected information arrives after a decision was already made, a new decision is produced that explicitly supersedes the old one (`replan_of` linkage, old decision marked `replanned`) — not silently overwritten, not ignored.
- **Every decision is logged to a hash-chained, tamper-evident audit trail.** The database role that runs the app has `UPDATE`/`DELETE` revoked on the audit table at the SQL level — tamper-evidence is enforced, not just claimed.
- **Human-in-the-loop escalation is threshold-driven and automatic.** Decisions exceeding a PO's own approval limit produce a structured decision brief (what's at risk, what was investigated, options considered, recommended plan, why approval is needed) rather than a bare alert.

---

## Architecture

```
┌─────────────┐      ┌──────────────────────────┐      ┌─────────────┐
│  Next.js 14 │◄────►│  FastAPI (orchestrator +  │◄────►│  PostgreSQL │
│  Dashboard  │  WS/ │  tool endpoints + agent)  │      │   (Neon)    │
│             │  REST│                            │      │             │
└─────────────┘      └──────────┬────────────────┘      └─────────────┘
                                 │
                      ┌──────────▼────────────┐
                      │  Agent orchestration   │
                      │  (LangGraph-style      │
                      │  sequential pipeline)  │
                      │  → Groq (gpt-oss-120b) │
                      └────────────────────────┘
```

**The pipeline** (per disruption event):

1. **Triage** (LLM) — classifies the disruption from raw event text
2. **Impact Analysis** (deterministic) — production-coverage math: stock, shortfall, deadline
3. **Verify Claim** (deterministic) — checks supplier status claims against tracking data
4. **Negotiate** (LLM, real tool-calling) — model autonomously requests RFQs from feasible suppliers
5. **Score & Validate** (deterministic) — weighted multi-criteria scoring + hard constraint checks
6. **Plan Recovery** (deterministic allocation + LLM explanation) — single or split-supplier plans
7. **Decide** — auto-execute within threshold, or escalate with a structured brief
8. **Audit Write** — hash-chained, tamper-evident logging

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent / LLM | Groq (`openai/gpt-oss-120b`), LangChain tool-calling |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic |
| Database | PostgreSQL (Neon) in production, SQLite for local dev |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Realtime | WebSocket live status updates, polling fallback |
| Testing | pytest (backend logic), scripted end-to-end agent runs |

---

## Repository Structure

```
HOP_PUNE/
├── backend/
│   ├── app/
│   │   ├── agent/          # state, tools, prompts, graph orchestration
│   │   ├── api/             # FastAPI routers (disruptions, decisions, audit, suppliers...)
│   │   ├── db/               # SQLAlchemy models + session
│   │   └── services/          # deterministic core: coverage, constraints, scoring, hashing, seed data
│   ├── tests/                  # pytest suite for the deterministic core
│   ├── run_scenario.py          # run one named PS scenario through the live agent
│   ├── run_replan_scenario.py    # scripted 2-phase replanning test
│   ├── run_hidden_tests.py        # demand-spike / expedite-unavailable generalization tests
│   ├── proof_integration.py        # DB + services integration proof
│   ├── HIDDEN_TEST_COVERAGE.md      # honest mapping of PS's 10 hidden-test categories to code
│   └── README.md                     # backend-specific setup + verification log
├── frontend/
│   ├── app/                # Dashboard, Decision Detail, Approvals, Audit pages
│   ├── components/          # StatusBadge, DisruptionFeedCard, CandidateComparison, AuditChain...
│   ├── lib/                  # API client, live-feed WebSocket hook
│   └── README.md              # frontend-specific setup
└── DEMO_WALKTHROUGH.md    # screen-by-screen demo script, what's verified, known gaps
```

---

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env    # add your GROQ_API_KEY

python -m app.services.seed_data
uvicorn app.main:app --reload
```

Backend runs at `http://127.0.0.1:8000`. Interactive API docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`. Backend must already be running.

### Verify everything works end-to-end

```bash
cd backend
python proof_integration.py        # DB + deterministic services
python run_replan_scenario.py       # two-phase replanning, live agent
python run_hidden_tests.py           # generalization beyond the 4 rehearsed scenarios
```

All three should end with a `PASSED` message.

---

## The Four Core Scenarios (from the problem statement)

| Scenario | What it tests | Verified |
|---|---|---|
| **Baseline Delay** | Standard supplier delay, split-order recovery across suppliers | ✅ Live, Groq |
| **Adversarial Claim** | Supplier claims dispatch; tracking contradicts it | ✅ Live, Groq |
| **Budget Escalation** | Only feasible plan exceeds the PO's approval threshold | ✅ Live, Groq |
| **Replanning** | Corrected inventory data supersedes an earlier decision | ✅ Live, Groq |

Plus two additional generalization tests (demand spike, expedite unavailable) proving the agent handles disruption types beyond the four rehearsed demo scenarios — see `backend/run_hidden_tests.py` and `backend/HIDDEN_TEST_COVERAGE.md` for the full 10-category hidden-test mapping.

---

## What's Working vs. Known Gaps

We'd rather be precise here than oversell it.

**Fully working, live-tested against real Groq calls:**
- All 4 core scenarios end-to-end
- Real replanning with correct `replan_of` supersession
- Persistent supplier trust memory across runs
- Tamper-evident audit chain with live verification
- Human approval queue with structured decision briefs
- Live WebSocket status updates through every pipeline stage

**Backend complete, frontend not yet built:**
- Supplier Comms Log (message thread view) — API exists (`GET /supplier-messages`), no page
- Supplier trust summary UI — API exists (`GET /suppliers/trust`), no page
- Tool-call-count display — tracked per decision, not shown on the Decision Detail page yet

**Acknowledged gaps:**
- No cross-production-order prioritization (PS §8 Scenario 6's "delay a low-priority order to protect a high-priority one" isn't implemented)
- The agent orchestration is a hand-written sequential pipeline with an embedded ReAct tool-calling loop, not a compiled `langgraph.StateGraph` — functionally equivalent, architecturally simpler
- Replanning currently triggers via a dedicated API endpoint / script rather than a dashboard button

Full detail on all of the above: `DEMO_WALKTHROUGH.md` and `backend/HIDDEN_TEST_COVERAGE.md`.

---

## Design Documents

Full PRD, TRD, App Flow, UI/UX Design Brief, Backend Schema, and Implementation Plan were written against the official problem statement before development began — available on request / in project docs.

---

## Team

Team Trace — Hackers Occupied Pune 2026, Agentic AI Track.
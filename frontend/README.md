# Trace — Dashboard (Next.js)

Implements the Dashboard screen from AppFlow_v2 + UIUX_Design_Brief_v2 — the
highest-priority screen per the brief's build-first order (§8), since it
unblocks everything else.

## Status — same honesty as the backend scaffold

**This has NOT been through a real `npm install` or build.** This sandbox's
network blocks the npm registry (same restriction that blocked PyPI for the
backend), so I verified what I could — brace/paren balance across every file,
careful manual re-read — but not an actual TypeScript compile or Next.js dev
server boot. Please run the steps below and paste back whatever breaks.

## Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`. Your backend (`uvicorn app.main:app --reload`)
needs to already be running on `127.0.0.1:8000` — the dashboard fetches
`/disruptions` and `/decisions` and connects to `/ws/live` on load.

## What's here

- `app/page.tsx` — the Dashboard: header, stats strip, live disruption feed
- `app/decisions/[id]/page.tsx` — Decision Detail: candidate comparison + split-plan
  bracket + reasoning + decision brief (UI/UX v2 §5.3)
- `app/approvals/page.tsx` — Approval Queue: structured decision-brief prose,
  inline Approve/Reject (UI/UX v2 §5.4)
- `app/audit/page.tsx` — Audit Trail: **The Chain** signature element + chronological
  expandable log + live tamper-check via "Verify Chain Integrity" (UI/UX v2 §4)
- `app/suppliers/page.tsx` — Supplier Communications & Trust: comms log thread
  view + persistent supplier trust memory display (`GET /suppliers/trust`)
- `components/CorrectInventoryButton.tsx` — makes the replan flow demoable by
  click instead of only via `run_replan_scenario.py` (see its docstring for
  the required Phase-1-first sequence)
- `components/AuditChain.tsx` — the linked-segment visual, colors by outcome,
  renders the specific broken link red if verification ever fails
- `components/StatusBadge.tsx` — color+icon+text status pills (UI/UX v2 §5.1)
- `components/DisruptionFeedCard.tsx` — feed cards (UI/UX v2 §5.2)
- `components/CandidateComparison.tsx` — per-candidate cards + split-plan bracket (UI/UX v2 §5.3)
- `components/InjectDisruptionModal.tsx` — the 3-scenario trigger modal (UI/UX v2 §5.6)
- `lib/api.ts` — REST client for every endpoint in TRD v2 §10
- `lib/useLiveFeed.ts` — WS subscription with automatic polling fallback (TRD v2 §13)

## What's deliberately NOT here yet

1. **Supplier Comms Log** — actually now built (see above), removing this line.

Every screen from the design brief now exists and links to somewhere real.

## ⚠️ Important — replanning demo requires a specific click order

The "Correct Inventory" button on the Dashboard makes replanning demoable by
click, but it MUST be preceded by injecting the **"Inventory Check (Replan —
Phase 1 of 2)"** option from the Inject Disruption modal first, and waiting
for it to auto-execute, before clicking Correct. Clicking Correct first
produces an ordinary decision, not a visible replan (no prior decision to
supersede). See `components/CorrectInventoryButton.tsx`'s docstring.

## Known limitation — the persistent trust-alert badge only tracks the current session

`useLiveFeed.ts`'s `contradictedIds` only accumulates while the browser tab
is connected via WebSocket. A page reload mid-demo, or a disruption triggered
via a backend script rather than the dashboard, won't retroactively show the
violet trust-alert badge on that card — even though the underlying
contradiction is still real and described in the decision's reasoning text.
A fully robust version would derive this from `GET /suppliers/{id}/trust`
(the persistent backend table) instead of client-side WS tracking. Not fixed
here due to time constraints — flagging so it's a known trade-off, not a
surprise.

## Known rough edges to check when you run it

- `DisruptionFeedCard` disables the link (`pointer-events-none`) until a
  `Decision` row exists for that disruption, since there's nowhere to send you
  yet during the `triaging…`/`negotiating…` window — confirm this actually
  feels right rather than confusing, once you see it live.
- The color/font tokens are hardcoded to the exact hex values from UI/UX Brief
  v2 §2.1 rather than CSS variables — fine for now, but if you want to support
  a light-mode toggle later this'll need refactoring first.
- `alert()` is used as a placeholder for injection errors in the modal — swap
  for a real toast/notification component when you have a few spare minutes,
  it's the one piece of UI here that doesn't match the brief's voice guidance.

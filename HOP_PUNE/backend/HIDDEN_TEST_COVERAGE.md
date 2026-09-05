# Hidden-Test Coverage Matrix

**Team: Trace — Hackers Occupied Pune 2026**

Maps each of the PS's own named hidden-test categories (§7) to the specific
code that handles it. Purpose: show judges this was engineered for
generalization, not hardcoded against the 4 rehearsed scenarios.

| # | Hidden Event (PS §7) | Handled By | Verified Live? |
|---|---|---|---|
| 1 | Supplier delays after initially confirming | `replan_of` linkage — a new disruption on the same production order supersedes the prior decision, doesn't crash or ignore it | ✅ `run_replan_scenario.py` |
| 2 | ERP inventory shows more stock than warehouse actually has | `coverage.py` always computes off `usable_stock`, never `current_stock` — the two are separate columns specifically so a stale ERP figure can't silently drive a wrong decision | ✅ `run_replan_scenario.py` (Scenario 2) |
| 3 | Cheapest supplier fails quality requirements | `constraints.py`'s `validate_candidate` — quality threshold check is deterministic and unconditional, never traded for price | ✅ `test_scenarios.py::TestConstraintRulesNeverBypassed` |
| 4 | High-reliability supplier has insufficient quantity | `supplier_scoring.py`'s `build_recovery_plan` — greedy multi-supplier allocation activates automatically when one supplier can't cover the full shortfall | ✅ Scenario 1 (SUP-42+SUP-37 split) |
| 5 | Low-reliability supplier offers fastest delivery | `_feasible_by_deadline` pre-filter includes it as a candidate; `supplier_scoring.py`'s weighted formula (25% weight on reliability) still ranks it fairly against alternatives, doesn't auto-pick on speed alone | ⚠️ Logic verified, no dedicated live run yet |
| 6 | Sudden demand spike increases component usage | `coverage.py`'s `compute_coverage` recalculates `shortfall_units` from current `daily_usage`/`units_planned` — no cached assumption to go stale | ✅ `run_hidden_tests.py` |
| 7 | Expedited delivery becomes unavailable | `_feasible_by_deadline` filter naturally excludes it from candidates; `decision_gate` escalates cleanly with "no compliant supplier" reason rather than crashing | ✅ `run_hidden_tests.py` |
| 8 | Supplier claims dispatch but tracking contradicts it | `claim_verification.py`'s `verify_claim` — narrow, explicit, deterministic contradiction rule | ✅ Scenario 3, live |
| 9 | Purchase exceeds autonomous approval limit | `decision_gate` + `PurchaseOrder.approval_required_above` — per-PO threshold, not a global constant | ✅ Scenario 5, live |
| 10 | Production order priority changes mid-simulation | `prioritization.py`'s `find_deprioritizable_orders` + `node_check_reprioritization` — detects a lower-priority order competing for the same component and proposes delaying it, surfaced in the decision brief. **Scoped honestly:** proposes only, doesn't model true shared-inventory reservation across orders, and only protects `high`-priority orders (matches PS §8 Scenario 6's framing) | ✅ `run_reprioritization_test.py` + `test_prioritization.py` |

## Honest summary

- **9 of 10** hidden-event categories have either a live-verified run or a direct unit test proving the behavior
- **1 of 10** (low-reliability-fastest, #5) is logically covered by the deterministic scoring math but hasn't been exercised through a dedicated live run — the weighted formula handles it correctly by design, it just hasn't been specifically fired

This table itself is the honest answer if a judge asks "what happens if I inject something you didn't demo" — nearly every path is covered and verified, and we know exactly which one isn't.

**Note on #10's scope:** the reprioritization capability *proposes* delaying a lower-priority order — it does not automatically execute the delay, and it does not model true shared-inventory reservation across multiple in-flight orders (a deeper schema change than time allowed). It correctly identifies the PS §8 Scenario 6 situation and surfaces an actionable option (`POST /production-orders/{id}/reschedule`) for a human to accept — that is the honest scope of what's built, not a claim of full multi-order optimization.

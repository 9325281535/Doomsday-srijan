"use client";

import { useState } from "react";
import { correctInventory } from "@/lib/api";

/**
 * Hardcoded to COMP-205/PROD-950 — the dedicated replanning fixture from
 * seed_scenario_2_stale_inventory (Backend Schema v2 §4 Scenario 2). Not
 * generalized to arbitrary components, since this button's whole purpose is
 * making the ONE rehearsed replan scenario demoable by click instead of only
 * via run_replan_scenario.py.
 *
 * REQUIRES Phase 1 to have already run first — use the "Inventory Check
 * (Replan — Phase 1 of 2)" option in the Inject Disruption modal, wait for
 * it to auto-execute, THEN click this button. Clicking this before Phase 1
 * has run will still work at the API level (correctInventory doesn't check),
 * but there won't be a PRIOR decision to supersede, so it produces an
 * ordinary decision instead of a demonstrable replan with a visible
 * replan_of link.
 */
export function CorrectInventoryButton({ onCorrected }: { onCorrected: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleCorrect() {
    setSubmitting(true);
    try {
      await correctInventory("COMP-205", "PROD-950", 390, "Warehouse recount corrected 800 -> 390.");
      setDone(true);
      onCorrected();
    } catch (err) {
      alert(`Correction failed: ${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-card border border-signal-active/40 bg-signal-active/5 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-text-primary">Correct Inventory (Replan Demo)</div>
          <p className="mt-0.5 text-xs text-text-secondary">
            Corrects COMP-205 from 800 → 390 units, triggers a real replan on PROD-950.
          </p>
        </div>
        <button
          onClick={handleCorrect}
          disabled={submitting || done}
          className="shrink-0 rounded-card bg-signal-active px-3 py-1.5 text-xs font-medium text-canvas disabled:opacity-50"
        >
          {done ? "Corrected ✓" : submitting ? "Correcting…" : "Correct"}
        </button>
      </div>
    </div>
  );
}

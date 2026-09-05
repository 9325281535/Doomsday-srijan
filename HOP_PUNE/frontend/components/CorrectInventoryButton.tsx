"use client";

import { useState } from "react";
import { correctInventory } from "@/lib/api";

/**
 * Hardcoded to COMP-205/PROD-950 — the dedicated replanning fixture.
 * Use the "Inventory Check (Replan — Phase 1 of 2)" option first,
 * wait for auto-execute, THEN click this button for Phase 2.
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
    <div className="border border-[#f0ba00]/40 bg-[#f0ba00]/5 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-white">Correct Inventory (Replan Demo)</div>
          <p className="mt-0.5 text-xs text-[#54717a]">
            Corrects COMP-205 from 800 → 390 units, triggers a real replan on PROD-950.
          </p>
        </div>
        <button
          onClick={handleCorrect}
          disabled={submitting || done}
          className="shrink-0 trace-pill trace-pill-small disabled:opacity-50"
        >
          {done ? "Corrected ✓" : submitting ? "Correcting…" : "Correct"}
        </button>
      </div>
    </div>
  );
}

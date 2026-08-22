"use client";

import { useState } from "react";
import { injectDisruption } from "@/lib/api";

// Copy pulled near-verbatim from Backend_Schema_Supply_Chain_Disruption_Agent_v2.md §4
// per UIUX_Design_Brief_Supply_Chain_Disruption_Agent_v2.md §5.6's instruction to
// use the PS's own scenario names/descriptions.
const SCENARIOS = [
  {
    key: "baseline",
    label: "Baseline Delay",
    description: "SUP-21 delays PO-7712 — coverage shortfall on a high-priority order.",
    payload: {
      event_type: "delay",
      po_id: "PO-7712",
      production_order_id: "PROD-882",
      raw_payload: { component_id: "COMP-104", notes: "Supplier reports 5-7 day delay." },
    },
  },
  {
    key: "adversarial",
    label: "Claim Mismatch",
    description: "SUP-21 claims dispatch; tracking data shows no pickup occurred.",
    payload: {
      event_type: "supplier_claim_mismatch",
      po_id: "PO-7712",
      production_order_id: "PROD-882",
      raw_payload: { component_id: "COMP-104", notes: "Dispatch claim vs. tracking mismatch." },
    },
  },
  {
    key: "escalation",
    label: "Budget Escalation",
    description: "PROD-901's 2-day deadline only an expensive expedite option can meet.",
    payload: {
      event_type: "quantity_shortfall",
      po_id: "PO-9021",
      production_order_id: "PROD-901",
      raw_payload: { component_id: "COMP-104", notes: "Only expedited sourcing meets deadline." },
    },
  },
  {
    key: "inventory_check",
    label: "Inventory Check (Replan — Phase 1 of 2)",
    description:
      "Routine check on COMP-205/PROD-950, currently shows 800 units (stale, not yet corrected) — resolves with no action needed. Use the 'Correct Inventory' button afterward to trigger Phase 2 and see a real replan.",
    payload: {
      event_type: "delay",
      production_order_id: "PROD-950",
      raw_payload: {
        component_id: "COMP-205",
        notes: "Routine coverage check triggered by a minor upstream schedule shift.",
      },
    },
  },
];

export function InjectDisruptionModal({ onClose, onInjected }: { onClose: () => void; onInjected: () => void }) {
  const [selected, setSelected] = useState(SCENARIOS[0].key);
  const [submitting, setSubmitting] = useState(false);

  async function handleInject() {
    const scenario = SCENARIOS.find((s) => s.key === selected);
    if (!scenario) return;
    setSubmitting(true);
    try {
      await injectDisruption(scenario.payload);
      onInjected();
      onClose();
    } catch (err) {
      // Errors don't apologize and aren't vague, per the brief's voice guidance —
      // but this is a placeholder alert; swap for a proper toast when time allows.
      alert(`Failed to inject disruption: ${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-card border border-border bg-surface-raised p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-text-primary">Inject Disruption</h2>
        <p className="mt-1 text-sm text-text-secondary">Choose a scenario to run through the agent.</p>

        <div className="mt-4 space-y-2">
          {SCENARIOS.map((s) => (
            <label
              key={s.key}
              className={`block cursor-pointer rounded-card border p-3 ${
                selected === s.key ? "border-signal-active bg-surface" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scenario"
                  value={s.key}
                  checked={selected === s.key}
                  onChange={() => setSelected(s.key)}
                  className="accent-signal-active"
                />
                <span className="font-medium text-text-primary">{s.label}</span>
              </div>
              <p className="mt-1 pl-6 text-xs text-text-secondary">{s.description}</p>
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-card border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleInject}
            disabled={submitting}
            className="rounded-card bg-signal-active px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            {submitting ? "Injecting…" : "Inject"}
          </button>
        </div>
      </div>
    </div>
  );
}

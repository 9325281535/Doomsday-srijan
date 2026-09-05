import type { AuditEntry, ChainVerification } from "@/lib/api";

/**
 * Per UIUX_Design_Brief_Supply_Chain_Disruption_Agent_v2.md §4 — "The Chain."
 * The audit log's real hash-chain property becomes a literal linked visual:
 * each node is a decision action, colored by outcome, with its hash fragment
 * shown beneath it so the chain reads as cryptographic, not just a timeline.
 *
 * When verification fails, the specific broken link renders red and jagged
 * with a plain-language flag — per the brief, this is the strongest live
 * "prove the tamper-evidence" demo beat, stronger than a pass/fail banner
 * because judges can see exactly which link failed.
 */

const ACTION_COLOR: Record<string, string> = {
  auto_executed: "bg-status-auto border-status-auto",
  approved: "bg-status-auto border-status-auto",
  pending_approval: "bg-status-pending border-status-pending",
  rejected: "bg-status-rejected border-status-rejected",
  replanned: "bg-signal-active border-signal-active",
};

function colorFor(action: string): string {
  return ACTION_COLOR[action] ?? "bg-text-secondary border-text-secondary";
}

export function AuditChain({
  entries,
  verification,
}: {
  entries: AuditEntry[];
  verification: ChainVerification | null;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border p-8 text-center text-sm text-text-secondary">
        No audit entries yet. Injecting a disruption will start the chain.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface p-6">
      <div className="flex items-center gap-1">
        {entries.map((entry, i) => {
          const isBroken = verification && !verification.valid && verification.broken_at_index === i;
          return (
            <div key={entry.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  title={`${entry.action} · ${entry.actor}`}
                  className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                    isBroken ? "border-status-rejected bg-status-rejected animate-trust-flash" : colorFor(entry.action)
                  }`}
                />
                <span className="mt-1 whitespace-nowrap font-mono text-[10px] text-text-secondary">
                  {entry.hash.slice(0, 6)}…
                </span>
              </div>
              {i < entries.length - 1 && (
                <div
                  className={`h-0.5 w-8 flex-shrink-0 ${
                    isBroken ? "bg-status-rejected" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {verification && (
        <div
          className={`mt-6 rounded-card border p-3 text-sm ${
            verification.valid
              ? "border-status-auto/40 bg-status-auto/10 text-status-auto"
              : "border-status-rejected/40 bg-status-rejected/10 text-status-rejected"
          }`}
        >
          {verification.valid ? (
            <>✓ Chain verified — all {verification.total_entries} entries intact, no tampering detected.</>
          ) : (
            <>
              ✕ Entry #{verification.broken_at_index} hash mismatch — chain integrity broken here. Every entry
              after this point cannot be trusted without investigation.
            </>
          )}
        </div>
      )}
    </div>
  );
}

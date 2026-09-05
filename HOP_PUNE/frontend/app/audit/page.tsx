"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuditLog, verifyAuditChain, AuditEntry, ChainVerification } from "@/lib/api";
import { AuditChain } from "@/components/AuditChain";
import { TraceInternalShell } from "@/components/TraceInternalShell";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await fetchAuditLog();
      setEntries(rows);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleVerify() {
    setVerifying(true);
    try {
      const result = await verifyAuditChain();
      setVerification(result);
    } catch (e) {
      alert(`Verification request failed: ${e}`);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <TraceInternalShell eyebrow="THE CHAIN · INTEGRITY" title="Every decision leaves a trace." description="Follow the hash-linked record from first signal to final action, and verify that nothing was quietly rewritten." image="/trace-story-signal.png">
      <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="trace-internal-heading">Audit Trail</h2>
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="rounded-card border border-signal-active px-4 py-2 text-sm text-signal-active disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify Chain Integrity"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-card border border-status-rejected/30 bg-status-rejected/10 p-4 text-status-rejected">
          Could not load the audit log. Is the backend running?
        </p>
      )}

      <div className="mt-6 trace-lift" data-depth="2">
        <AuditChain entries={entries} verification={verification} />
      </div>

      <div className="mt-8 space-y-2" data-depth="2">
        <h2 className="text-sm font-medium text-text-secondary">Chronological log</h2>
        {entries
          .slice()
          .reverse()
          .map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="rounded-card border border-border bg-surface">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-secondary">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    <span className="text-sm text-text-primary">{entry.action}</span>
                    <span className="font-mono text-xs text-text-secondary">by {entry.actor}</span>
                  </div>
                  <Link
                    href={`/decisions/${entry.decision_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-signal-active hover:underline"
                  >
                    View decision →
                  </Link>
                </button>
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 font-mono text-xs text-text-secondary">
                    <div>hash: {entry.hash}</div>
                    <div>prev_hash: {entry.prev_hash ?? "(genesis entry)"}</div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      </div>
    </TraceInternalShell>
  );
}

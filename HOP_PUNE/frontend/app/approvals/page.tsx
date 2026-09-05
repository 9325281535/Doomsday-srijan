"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchDecisions, approveDecision, rejectDecision, Decision } from "@/lib/api";
import { TraceInternalShell } from "@/components/TraceInternalShell";

const APPROVER_ID = "coordinator"; // hardcoded — no auth/login screen per UI/UX v2 §10 scope cut

export default function ApprovalsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await fetchDecisions("pending_approval");
      setDecisions(rows);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await approveDecision(id, APPROVER_ID);
      await load();
    } catch (e) {
      alert(`Approve failed: ${e}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await rejectDecision(id, APPROVER_ID);
      await load();
    } catch (e) {
      alert(`Reject failed: ${e}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TraceInternalShell eyebrow="HUMAN GATE · APPROVALS" title="The next move needs you." description="Review decisions that cross the safe autonomy boundary before production feels the cost." image="/trace-story-accountability.png">
      <div className="mx-auto max-w-3xl">

      {error && (
        <p className="mt-4 rounded-card border border-status-rejected/30 bg-status-rejected/10 p-4 text-status-rejected">
          Could not load approvals. Is the backend running?
        </p>
      )}

      {!error && decisions.length === 0 && (
        <p className="mt-6 rounded-card border border-dashed border-border p-8 text-center text-sm text-text-secondary">
          Nothing waiting on you right now.
        </p>
      )}

      <div className="mt-8 space-y-4">
        {decisions.map((d) => (
          <div key={d.id} className="trace-lift rounded-card border border-status-pending/40 bg-surface p-5" data-depth="2">
            <div className="flex items-center justify-between">
              <Link href={`/decisions/${d.id}`} className="font-mono text-sm text-text-primary hover:text-signal-active">
                {d.production_order_id ?? d.id}
              </Link>
              <span className="text-xs font-mono text-text-secondary">
                {new Date(d.created_at).toLocaleString()}
              </span>
            </div>

            {d.decision_brief_json ? (
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                {d.decision_brief_json.text}
              </div>
            ) : (
              <p className="mt-3 text-sm text-text-secondary">
                No structured brief available — see full reasoning:
              </p>
            )}
            {!d.decision_brief_json && (
              <p className="mt-1 text-sm text-text-primary">{d.reasoning_text}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => handleReject(d.id)}
                disabled={busyId === d.id}
                className="rounded-card border border-status-rejected px-4 py-2 text-sm text-status-rejected disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(d.id)}
                disabled={busyId === d.id}
                className="rounded-card bg-status-auto px-4 py-2 text-sm font-medium text-canvas disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
    </TraceInternalShell>
  );
}

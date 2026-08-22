"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchDecision, Decision } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { CandidateComparison } from "@/components/CandidateComparison";

export default function DecisionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDecision(id)
      .then(setDecision)
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link href="/" className="text-sm text-signal-active">
          ← Back to dashboard
        </Link>
        <p className="mt-4 rounded-card border border-status-rejected/30 bg-status-rejected/10 p-4 text-status-rejected">
          Could not load this decision. It doesn&apos;t exist, or the backend is unreachable.
        </p>
      </main>
    );
  }

  if (!decision) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-text-secondary">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/" className="text-sm text-signal-active">
        ← Back to dashboard
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-text-primary">
          {decision.production_order_id ?? "Decision"}
        </h1>
        <StatusBadge status={decision.status} />
      </div>
      <p className="mt-1 flex items-center gap-3 font-mono text-xs text-text-secondary">
        <span>{new Date(decision.created_at).toLocaleString()}</span>
        <span title="Number of real tool calls the agent made during negotiation — Tool Efficiency scoring">
          🔧 {decision.tool_call_count} tool call{decision.tool_call_count === 1 ? "" : "s"}
        </span>
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-text-secondary">Candidates considered</h2>
        <div className="mt-2">
          <CandidateComparison
            candidates={decision.candidates_json ?? []}
            chosenPlan={decision.chosen_plan_json}
          />
        </div>
      </section>

      <section className="mt-6 rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-secondary">Reasoning</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-primary">{decision.reasoning_text}</p>
      </section>

      {decision.decision_brief_json && (
        <section className="mt-6 rounded-card border border-status-pending/40 bg-status-pending/5 p-4">
          <h2 className="text-sm font-medium text-status-pending">Decision brief</h2>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {decision.decision_brief_json.text}
          </div>
        </section>
      )}
    </main>
  );
}

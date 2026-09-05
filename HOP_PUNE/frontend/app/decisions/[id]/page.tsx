"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchDecision, Decision } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { CandidateComparison } from "@/components/CandidateComparison";
import { TraceInternalShell } from "@/components/TraceInternalShell";

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
      <TraceInternalShell eyebrow="DECISION DETAIL · UNAVAILABLE" title="Decision not found." description="The control layer could not retrieve this recovery decision." image="/trace-story-disruption.png">
        <p className="mt-4 rounded-card border border-status-rejected/30 bg-status-rejected/10 p-4 text-status-rejected">
          Could not load this decision. It doesn&apos;t exist, or the backend is unreachable.
        </p>
      </TraceInternalShell>
    );
  }

  if (!decision) {
    return (
      <TraceInternalShell eyebrow="DECISION DETAIL" title="Loading decision." image="/trace-story-signal.png"><p className="text-text-secondary">Loading…</p></TraceInternalShell>
    );
  }

  return (
    <TraceInternalShell eyebrow="DECISION DETAIL · EXPLAINABLE RECOVERY" title={decision.production_order_id ?? "Decision detail"} description="See exactly why this recovery plan was selected, what it protects, and where the guardrails held." image="/trace-story-accountability.png">
      <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="trace-internal-heading">
          {decision.production_order_id ?? "Decision"}
        </h2>
        <StatusBadge status={decision.status} />
      </div>
      <p className="mt-1 font-mono text-xs text-text-secondary">
        {new Date(decision.created_at).toLocaleString()}
      </p>

      <section className="mt-8" data-depth="2">
        <h2 className="text-sm font-medium text-text-secondary">Candidates considered</h2>
        <div className="mt-2">
          <CandidateComparison
            candidates={decision.candidates_json ?? []}
            chosenPlan={decision.chosen_plan_json}
          />
        </div>
      </section>

      <section className="trace-lift mt-6 rounded-card border border-border bg-surface p-5" data-depth="2">
        <h2 className="text-sm font-medium text-text-secondary">Reasoning</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-primary">{decision.reasoning_text}</p>
      </section>

      {decision.decision_brief_json && (
        <section className="trace-lift mt-6 rounded-card border border-status-pending/40 bg-status-pending/5 p-5" data-depth="2">
          <h2 className="text-sm font-medium text-status-pending">Decision brief</h2>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {decision.decision_brief_json.text}
          </div>
        </section>
      )}
      </div>
    </TraceInternalShell>
  );
}

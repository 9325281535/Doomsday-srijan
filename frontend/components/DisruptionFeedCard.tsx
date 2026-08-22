import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import type { Disruption, Decision } from "@/lib/api";

interface Props {
  disruption: Disruption;
  decision: Decision | undefined;
  liveStatus: string | undefined;
  wasContradicted?: boolean; // true if claim_contradicted ever fired for this
  // disruption — persists past the final status resolving, per UI/UX Brief v2 §5.1
}

/**
 * Per UIUX_Design_Brief_Supply_Chain_Disruption_Agent_v2.md §5.2:
 * Row 1 (mono): event type · corridor/component code · timestamp
 * Row 2 (body): one-line plain-English summary
 * Row 3: status badge + cost figure, right-aligned
 * Left border pulses while processing (handled by StatusBadge's animate class
 * cascading isn't quite right for the card border itself, so this card also
 * carries its own border-color logic keyed off the same status).
 */
export function DisruptionFeedCard({ disruption, decision, liveStatus, wasContradicted }: Props) {
  const status = decision?.status ?? liveStatus ?? "ingested";
  const isProcessing = !decision && liveStatus && liveStatus !== "auto_executed" && liveStatus !== "pending_approval";
  const showPersistentTrustAlert = wasContradicted && status !== "claim_contradicted";
  // The above renders as a SECOND small badge alongside the main status once
  // the run resolves — main status still shows what actually happened
  // (auto_executed/pending_approval), the trust-alert badge is the permanent
  // record that a contradiction was caught along the way.

  const summary = decision
    ? decision.reasoning_text.split(".")[0] + "."
    : `${disruption.event_type} affecting ${disruption.production_order_id ?? "unknown order"}`;

  const cost = decision?.chosen_plan_json?.total_cost;

  return (
    <Link
      href={`/decisions/${decision?.id ?? ""}`}
      className={`block rounded-card border-l-4 bg-surface p-4 transition-colors hover:bg-surface-raised ${
        wasContradicted && isProcessing
          ? "border-l-trust-alert animate-trust-flash"
          : isProcessing
            ? "border-l-signal-active animate-pulse-border"
            : "border-l-border"
      } ${!decision ? "pointer-events-none" : ""}`}
    >
      <div className="flex items-center justify-between text-xs font-mono text-text-secondary">
        <span>
          {disruption.event_type} · {disruption.production_order_id ?? "—"}
        </span>
        <span>{new Date(disruption.created_at).toLocaleTimeString()}</span>
      </div>
      <p className="mt-1.5 text-sm text-text-primary line-clamp-2">{summary}</p>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {showPersistentTrustAlert && <StatusBadge status="claim_contradicted" />}
        </div>
        {cost && (
          <span className="font-mono text-sm text-text-secondary">
            ${Number(cost).toLocaleString()}
          </span>
        )}
      </div>
    </Link>
  );
}

// Per UIUX_Design_Brief_Supply_Chain_Disruption_Agent_v2.md §5.1 — every status
// is color + icon + text, never color alone (accessibility floor, §7).

export type DisplayStatus =
  | "ingested"
  | "triaging"
  | "assessing_coverage"
  | "verifying_claim"
  | "negotiating"
  | "scoring"
  | "validating"
  | "auto_executed"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "replanning"
  | "claim_contradicted"
  | "unknown";

const STATUS_CONFIG: Record<
  DisplayStatus,
  { label: string; icon: string; colorClass: string; pulse?: boolean }
> = {
  ingested: { label: "Ingested", icon: "○", colorClass: "text-text-secondary border-border" },
  triaging: { label: "Triaging…", icon: "○", colorClass: "text-signal-active border-signal-active", pulse: true },
  assessing_coverage: { label: "Checking inventory…", icon: "○", colorClass: "text-signal-active border-signal-active", pulse: true },
  verifying_claim: { label: "Verifying claim…", icon: "○", colorClass: "text-signal-active border-signal-active", pulse: true },
  negotiating: { label: "Negotiating…", icon: "○", colorClass: "text-signal-active border-signal-active", pulse: true },
  scoring: { label: "Scoring candidates…", icon: "○", colorClass: "text-signal-active border-signal-active", pulse: true },
  validating: { label: "Validating constraints…", icon: "○", colorClass: "text-signal-active border-signal-active", pulse: true },
  auto_executed: { label: "Auto-executed", icon: "●", colorClass: "text-status-auto border-status-auto" },
  pending_approval: { label: "Pending Approval", icon: "●", colorClass: "text-status-pending border-status-pending" },
  approved: { label: "Approved", icon: "●", colorClass: "text-status-auto border-status-auto" },
  rejected: { label: "Rejected", icon: "●", colorClass: "text-status-rejected border-status-rejected" },
  replanning: { label: "Replanning…", icon: "○", colorClass: "text-signal-active border-signal-active", pulse: true },
  claim_contradicted: { label: "Claim Contradicted", icon: "▲", colorClass: "text-trust-alert border-trust-alert" },
  unknown: { label: "Unknown", icon: "○", colorClass: "text-text-secondary border-border" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as DisplayStatus] ?? STATUS_CONFIG.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono ${config.colorClass} ${
        config.pulse ? "animate-pulse-border" : ""
      }`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
}

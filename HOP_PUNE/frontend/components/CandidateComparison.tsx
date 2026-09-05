interface Candidate {
  supplier_id: string;
  quantity_offered: number;
  unit_price: string;
  lead_time_days: number;
  quality_score: number;
  reliability_score: number;
  score: number;
  trust_penalized: boolean;
  constraint_violations: string[];
}

interface Allocation {
  supplier_id: string;
  quantity: number;
  unit_price: string;
  lead_time_days: number;
}

interface ChosenPlan {
  allocations: Allocation[];
  total_cost: string;
  covers_shortfall: boolean;
  max_lead_time_days: number;
}

/**
 * Per UIUX_Design_Brief_Supply_Chain_Disruption_Agent_v2.md §5.3 — one card
 * per candidate, rejected ones show their specific violation (not just a
 * pass/fail matrix), selected ones get a status-auto top border + checkmark.
 * When the plan is a split, both selected cards get a connecting bracket
 * summarizing the combined allocation — this is what makes PS §4.6's
 * split-order behavior visually obvious rather than requiring mental math.
 */
export function CandidateComparison({
  candidates,
  chosenPlan,
}: {
  candidates: Candidate[];
  chosenPlan: ChosenPlan | null;
}) {
  const selectedIds = new Set(chosenPlan?.allocations.map((a) => a.supplier_id) ?? []);
  const isSplit = (chosenPlan?.allocations.length ?? 0) > 1;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => {
          const isSelected = selectedIds.has(c.supplier_id);
          const rejected = c.constraint_violations.length > 0;
          const allocation = chosenPlan?.allocations.find((a) => a.supplier_id === c.supplier_id);

          return (
            <div
              key={c.supplier_id}
              className={`rounded-card border bg-surface p-4 ${
                isSelected
                  ? "border-status-auto border-t-4"
                  : rejected
                    ? "border-border opacity-70"
                    : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-text-primary">{c.supplier_id}</span>
                {isSelected && <span className="text-status-auto text-sm">✓ SELECTED</span>}
                {rejected && <span className="text-status-rejected text-sm">✕</span>}
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Quantity" value={`${allocation?.quantity ?? c.quantity_offered} units`} />
                <Row label="Price" value={`$${c.unit_price}/unit`} />
                <Row label="Lead time" value={`${c.lead_time_days} days`} />
                <Row label="Quality" value={c.quality_score.toFixed(2)} />
                <Row
                  label="Reliability"
                  value={c.trust_penalized ? `${c.reliability_score.toFixed(2)} (penalized)` : c.reliability_score.toFixed(2)}
                />
                <Row label="Score" value={c.score.toFixed(4)} />
              </dl>

              {rejected && (
                <div className="mt-3 rounded border border-status-rejected/30 bg-status-rejected/10 p-2 text-xs text-status-rejected">
                  {c.constraint_violations.map((v, i) => (
                    <div key={i}>{v}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isSplit && chosenPlan && (
        <div className="mt-4 rounded-card border border-status-auto/40 bg-status-auto/10 p-3 text-center text-sm text-status-auto">
          Combined: covers {chosenPlan.allocations.reduce((sum, a) => sum + a.quantity, 0)} units ·
          ${Number(chosenPlan.total_cost).toLocaleString()} total
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-mono text-text-primary">{value}</dd>
    </div>
  );
}

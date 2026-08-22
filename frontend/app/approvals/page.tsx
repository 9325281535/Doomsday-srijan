"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchDecisions, approveDecision, rejectDecision, Decision } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

const APPROVER_ID = "coordinator";

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
    <div className="min-h-screen bg-[#07090E] text-[#E8EAED]">
      {/* ── UNIFIED NAVBAR ── */}
      <Navbar pendingCount={decisions.length} />

      {/* ── HERO STRIP WITH INCREASED TOP PADDING (NO OVERLAP) ── */}
      <div className="relative overflow-hidden border-b border-[#262B36] bg-[#0E121A] pt-32 pb-14">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(#F5A623 1px,transparent 1px),linear-gradient(90deg,#F5A623 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -top-10 right-0 w-96 h-96 rounded-full bg-[#F5A623]/10 blur-[100px] pointer-events-none" />
        
        <div className="relative max-w-6xl mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
                <span className="font-mono text-xs text-[#F5A623] uppercase tracking-widest font-semibold">
                  {decisions.length} pending decisions
                </span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-black uppercase text-white tracking-tight leading-none">
                Approval <span className="text-[#F5A623]">Queue</span>
              </h1>
              <p className="mt-4 text-sm md:text-base text-[#8B93A1] max-w-xl leading-relaxed">
                Review AI-generated decisions that require human sign-off before
                execution. Each item includes full reasoning and impact assessment.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 bg-[#141821] p-4 rounded-2xl border border-[#262B36]">
              <MiniStat label="Pending" value={decisions.length} color="text-[#F5A623]" />
              <MiniStat label="Reviewed" value={0} color="text-[#3DD68C]" />
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        {error && (
          <div className="mb-8 rounded-2xl border border-[#F2545B]/30 bg-[#F2545B]/10 p-5 text-[#F2545B] text-sm">
            Could not load approvals. Is the backend running?
          </div>
        )}

        {!error && decisions.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#262B36] bg-[#141821]/40 py-24 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-[#3DD68C]/15 border border-[#3DD68C]/30 flex items-center justify-center text-[#3DD68C] font-bold text-xl mb-4">
              ✓
            </div>
            <p className="font-display text-xl font-bold text-white">
              You are all caught up
            </p>
            <p className="mt-2 text-sm text-[#8B93A1] max-w-md leading-relaxed">
              Nothing waiting on human sign-off. Any decisions exceeding approval limits will appear here automatically.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {decisions.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-[#262B36] bg-[#141821] overflow-hidden transition-all hover:border-[#F5A623]/40 shadow-lg"
            >
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-[#262B36] bg-[#0E121A] px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F5A623]" />
                  <Link
                    href={`/decisions/${d.id}`}
                    className="font-mono text-sm md:text-base font-bold text-white hover:text-[#F5A623] transition-colors"
                  >
                    {d.production_order_id ?? d.id}
                  </Link>
                </div>
                <span className="font-mono text-xs text-[#8B93A1]">
                  {new Date(d.created_at).toLocaleString()}
                </span>
              </div>

              {/* Brief content */}
              <div className="px-6 py-5">
                {d.decision_brief_json ? (
                  <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed text-[#E8EAED]">
                    {d.decision_brief_json.text}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[#8B93A1] mb-2 font-mono uppercase tracking-wider">
                      Full Reasoning:
                    </p>
                    <p className="text-sm md:text-base text-white leading-relaxed">{d.reasoning_text}</p>
                  </>
                )}
              </div>

              {/* Actions footer */}
              <div className="flex justify-end gap-3 border-t border-[#262B36] bg-[#0E121A]/70 px-6 py-4">
                <button
                  onClick={() => handleReject(d.id)}
                  disabled={busyId === d.id}
                  className="rounded-full border border-[#F2545B] px-6 py-2.5 text-sm font-semibold text-[#F2545B] hover:bg-[#F2545B]/10 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(d.id)}
                  disabled={busyId === d.id}
                  className="rounded-full bg-[#3DD68C] hover:bg-[#34bc7a] px-6 py-2.5 text-sm font-bold text-black disabled:opacity-50 transition-colors"
                >
                  {busyId === d.id ? "Processing..." : "Approve Plan"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#262B36] bg-[#07090E] px-8 py-8 mt-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[#8B93A1]">
          <span className="font-display font-bold text-[#F5A623] tracking-wider text-sm">TRACE SCDA</span>
          <p className="font-mono">
            Hackers Occupied Pune 2026 · Agentic AI Track
          </p>
        </div>
      </footer>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-3">
      <div className={`font-display text-3xl font-black ${color}`}>{value}</div>
      <div className="text-xs text-[#8B93A1] mt-0.5">{label}</div>
    </div>
  );
}

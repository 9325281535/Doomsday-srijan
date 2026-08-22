"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSupplierMessages,
  fetchSupplierTrustSummary,
  SupplierMessage,
  SupplierTrustSummary,
} from "@/lib/api";
import { Navbar } from "@/components/Navbar";

const TRUST_STYLES: Record<string, { pill: string; bar: string; label: string }> = {
  LOW: {
    pill: "text-[#F2545B] border-[#F2545B]/40 bg-[#F2545B]/10",
    bar: "bg-[#F2545B]",
    label: "LOW TRUST",
  },
  MODERATE: {
    pill: "text-[#F5A623] border-[#F5A623]/40 bg-[#F5A623]/10",
    bar: "bg-[#F5A623]",
    label: "MODERATE",
  },
  OK: {
    pill: "text-[#3DD68C] border-[#3DD68C]/40 bg-[#3DD68C]/10",
    bar: "bg-[#3DD68C]",
    label: "TRUSTED",
  },
};

export default function SuppliersPage() {
  const [messages, setMessages] = useState<SupplierMessage[]>([]);
  const [trust, setTrust] = useState<SupplierTrustSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSupplierMessages(), fetchSupplierTrustSummary()])
      .then(([m, t]) => {
        setMessages(m);
        setTrust(t);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const grouped = messages.reduce<Record<string, SupplierMessage[]>>((acc, m) => {
    const key = m.po_id ?? `unlinked-${m.supplier_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const trustedCount = trust.filter((t) => t.trust_level === "OK").length;
  const lowCount = trust.filter((t) => t.trust_level === "LOW").length;

  return (
    <div className="min-h-screen bg-[#07090E] text-[#E8EAED]">
      {/* ── UNIFIED NAVBAR ── */}
      <Navbar />

      {/* ── HERO STRIP WITH TOP SPACING (NO OVERLAP) ── */}
      <div className="relative overflow-hidden border-b border-[#262B36] bg-[#0E121A] pt-32 pb-14">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#F5A623 1px,transparent 1px),linear-gradient(90deg,#F5A623 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -top-10 left-0 w-96 h-96 rounded-full bg-[#F5A623]/10 blur-[100px] pointer-events-none" />
        
        <div className="relative max-w-6xl mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
                <span className="font-mono text-xs text-[#F5A623] uppercase tracking-widest font-semibold">
                  {trust.length} suppliers monitored
                </span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-black uppercase text-white tracking-tight leading-none">
                Supplier <span className="text-[#F5A623]">Intelligence</span>
              </h1>
              <p className="mt-4 text-sm md:text-base text-[#8B93A1] max-w-xl leading-relaxed">
                Persistent trust scoring, contradiction history, and automated RFQ communication thread logs.
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 bg-[#141821] p-4 rounded-2xl border border-[#262B36]">
              <MiniStat label="Tracked" value={trust.length} color="text-white" />
              <MiniStat label="Trusted" value={trustedCount} color="text-[#3DD68C]" />
              <MiniStat label="Low Trust" value={lowCount} color="text-[#F2545B]" />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        {error && (
          <div className="mb-8 rounded-2xl border border-[#F2545B]/30 bg-[#F2545B]/10 p-5 text-[#F2545B] text-sm">
            Could not load supplier data. Is the backend running?
          </div>
        )}

        {/* ── Trust Grid ── */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-white">Trust Registry</h2>
            <span className="rounded-full border border-[#262B36] bg-[#141821] px-3 py-1 font-mono text-xs text-[#8B93A1]">
              {trust.length} registered suppliers
            </span>
          </div>

          {trust.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#262B36] bg-[#141821]/40 py-20 text-center px-6">
              <p className="font-display text-lg font-bold text-white">Every supplier starts trusted</p>
              <p className="mt-2 text-sm text-[#8B93A1] max-w-sm leading-relaxed">
                No contradictions recorded yet. The agent cross-checks tracking data and degrades trust automatically if discrepancies arise.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {trust.map((t) => {
                const style = TRUST_STYLES[t.trust_level] ?? TRUST_STYLES.OK;
                const pct = Math.max(10, 100 - t.contradiction_count * 20);
                return (
                  <div
                    key={t.supplier_id}
                    className="rounded-2xl border border-[#262B36] bg-[#141821] p-6 hover:border-[#F5A623]/30 transition-all shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-lg font-bold text-white">
                          {t.supplier_id}
                        </div>
                        {t.supplier_name && (
                          <div className="text-sm text-[#8B93A1] mt-0.5">{t.supplier_name}</div>
                        )}
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-bold tracking-wider ${style.pill}`}>
                        {style.label}
                      </span>
                    </div>

                    {/* Trust progress bar */}
                    <div className="mt-5">
                      <div className="flex justify-between text-xs mb-1.5 font-medium">
                        <span className="text-[#8B93A1]">Trust Score</span>
                        <span className="font-mono text-white">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#0E121A]">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${style.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-[#8B93A1]">
                      {t.contradiction_count} claim{t.contradiction_count === 1 ? "" : "s"} contradicted by sensor tracking
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Communications Log ── */}
        <section className="mt-14">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-white">
              Autonomous Communications Log
            </h2>
            <span className="rounded-full border border-[#262B36] bg-[#141821] px-3 py-1 font-mono text-xs text-[#8B93A1]">
              {messages.length} messages
            </span>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#262B36] bg-[#141821]/40 py-20 text-center px-6">
              <p className="font-display text-lg font-bold text-white">No communications yet</p>
              <p className="mt-2 text-sm text-[#8B93A1] max-w-sm leading-relaxed">
                Injecting disruptions that trigger supplier negotiations or RFQ quotes will automatically record thread interactions here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([poKey, msgs]) => (
                <div key={poKey} className="rounded-2xl border border-[#262B36] bg-[#141821] overflow-hidden shadow-md">
                  {/* Thread Header */}
                  <div className="flex items-center justify-between border-b border-[#262B36] bg-[#0E121A] px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
                      <span className="font-mono text-xs font-semibold text-white">
                        {poKey.startsWith("unlinked-") ? "New Supplier Outreach" : poKey}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#8B93A1]">
                      {msgs.length} message{msgs.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Messages Stream */}
                  <div className="space-y-3 p-6">
                    {msgs.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-2xl border p-4 text-sm leading-relaxed ${
                          m.direction === "outbound"
                            ? "ml-auto bg-[#1B2028] border-[#364052] text-white"
                            : "bg-[#0E121A] border-[#262B36] text-[#E8EAED]"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono text-[#8B93A1] mb-1.5 pb-1 border-b border-white/5">
                          <span className="flex items-center gap-2 font-bold">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                m.direction === "outbound" ? "bg-[#F5A623]" : "bg-[#4EA1FF]"
                              }`}
                            />
                            {m.supplier_id} ({m.direction})
                          </span>
                          <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                        </div>
                        {m.subject && (
                          <div className="font-bold text-white mb-1">{m.subject}</div>
                        )}
                        <p className="text-sm">{m.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
    <div className="px-2">
      <div className={`font-display text-3xl font-black ${color}`}>{value}</div>
      <div className="text-xs text-[#8B93A1] mt-0.5">{label}</div>
    </div>
  );
}

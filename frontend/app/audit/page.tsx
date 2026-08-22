"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuditLog, verifyAuditChain, AuditEntry, ChainVerification } from "@/lib/api";
import { AuditChain } from "@/components/AuditChain";
import { Navbar } from "@/components/Navbar";

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

  const isValid = verification?.valid === true;
  const isInvalid = verification !== null && !isValid;

  return (
    <div className="min-h-screen bg-[#07090E] text-[#E8EAED]">
      {/* ── UNIFIED NAVBAR ── */}
      <Navbar />

      {/* ── HERO STRIP WITH INCREASED TOP PADDING (NO OVERLAP) ── */}
      <div className="relative overflow-hidden border-b border-[#262B36] bg-[#0E121A] pt-32 pb-14">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#F5A623 1px,transparent 1px),linear-gradient(90deg,#F5A623 1px,transparent 1px)",
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
                  {entries.length} cryptographic entries
                </span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-black uppercase text-white tracking-tight leading-none">
                Immutable <span className="text-[#F5A623]">Audit Trail</span>
              </h1>
              <p className="mt-4 text-sm md:text-base text-[#8B93A1] max-w-xl leading-relaxed">
                Every agent decision is cryptographically chained and tamper-evident. Verify full mathematical integrity in real-time.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className={`flex items-center gap-2.5 rounded-full px-6 py-3 text-sm font-bold transition-all shadow-lg disabled:opacity-50 ${
                  isValid
                    ? "bg-[#3DD68C]/15 border border-[#3DD68C] text-[#3DD68C]"
                    : isInvalid
                    ? "bg-[#F2545B]/15 border border-[#F2545B] text-[#F2545B]"
                    : "bg-[#F5A623] hover:bg-[#E09010] text-black"
                }`}
              >
                {verifying ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Verifying Chain...
                  </>
                ) : isValid ? (
                  "✓ Chain Verified & Intact"
                ) : isInvalid ? (
                  "✕ Chain Broken / Tampered"
                ) : (
                  "Verify Chain Integrity"
                )}
              </button>

              <div className="grid grid-cols-2 gap-3 bg-[#141821] p-3.5 rounded-2xl border border-[#262B36]">
                <MiniStat label="Log Entries" value={entries.length} color="text-white" />
                <MiniStat
                  label="Integrity"
                  value={verification ? (isValid ? "Valid" : "Failed") : "Ready"}
                  color={isValid ? "text-[#3DD68C]" : isInvalid ? "text-[#F2545B]" : "text-[#8B93A1]"}
                  isText
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        {error && (
          <div className="mb-8 rounded-2xl border border-[#F2545B]/30 bg-[#F2545B]/10 p-5 text-[#F2545B] text-sm">
            Could not load the audit log. Is the backend running?
          </div>
        )}

        {/* Verification banner alert */}
        {verification && (
          <div
            className={`mb-8 rounded-2xl border p-5 ${
              isValid
                ? "border-[#3DD68C]/40 bg-[#3DD68C]/10 text-[#3DD68C]"
                : "border-[#F2545B]/40 bg-[#F2545B]/10 text-[#F2545B]"
            }`}
          >
            <div className="font-bold text-base">
              {isValid
                ? "✓ Cryptographic chain verification succeeded. All decision hashes match ground truth."
                : "✕ Chain integrity check failed! Inconsistency detected."}
            </div>
            {verification.broken_at_index != null && (
              <p className="mt-1 font-mono text-xs opacity-90">
                First mismatch located at block index: #{verification.broken_at_index}
              </p>
            )}
          </div>
        )}

        {/* Chain visualization */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-white">Chain Block Visualisation</h2>
          </div>
          <div className="rounded-2xl border border-[#262B36] bg-[#141821] overflow-hidden p-6 shadow-md">
            <AuditChain entries={entries} verification={verification} />
          </div>
        </section>

        {/* Chronological log */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-white">Chronological Audit Blocks</h2>
            <span className="rounded-full border border-[#262B36] bg-[#141821] px-3 py-1 font-mono text-xs text-[#8B93A1]">
              {entries.length} immutable blocks
            </span>
          </div>

          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#262B36] bg-[#141821]/40 py-20 text-center px-6">
              <p className="font-display text-lg font-bold text-white">No audit entries recorded yet</p>
              <p className="mt-2 text-sm text-[#8B93A1] max-w-sm leading-relaxed">
                As disruptions are processed and resolved by the autonomous agent, immutable cryptographically-linked entries will be appended here.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {entries
              .slice()
              .reverse()
              .map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-[#262B36] bg-[#141821] overflow-hidden transition-all hover:border-[#F5A623]/30 shadow-md"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-[#1B2028] transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#F5A623]" />
                        <span className="font-mono text-xs text-[#8B93A1] flex-shrink-0">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                        <span className="text-sm md:text-base font-semibold text-white truncate">
                          {entry.action}
                        </span>
                        <span className="font-mono text-xs text-[#8B93A1] flex-shrink-0 hidden sm:inline">
                          by {entry.actor}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                        <Link
                          href={`/decisions/${entry.decision_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-semibold text-[#F5A623] hover:underline"
                        >
                          View decision ↗
                        </Link>
                        <span className="text-xs text-[#8B93A1] font-mono">
                          {isExpanded ? "▲ Hide" : "▼ Hash"}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[#262B36] bg-[#0E121A] px-6 py-4 font-mono text-xs text-[#8B93A1] space-y-2">
                        <div>
                          <span className="text-[#F5A623] font-semibold">BLOCK HASH:</span>{" "}
                          <span className="text-white break-all">{entry.hash}</span>
                        </div>
                        <div>
                          <span className="text-[#F5A623] font-semibold">PREV HASH:</span>{" "}
                          <span className="text-white break-all">{entry.prev_hash ?? "(genesis entry)"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
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

function MiniStat({
  label,
  value,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="px-2">
      <div className={`font-display ${isText ? "text-xl md:text-2xl font-bold" : "text-3xl font-black"} ${color}`}>
        {value}
      </div>
      <div className="text-[11px] text-[#8B93A1] mt-0.5">{label}</div>
    </div>
  );
}

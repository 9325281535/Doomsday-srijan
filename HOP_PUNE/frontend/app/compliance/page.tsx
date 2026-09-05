"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TraceInternalShell } from "@/components/TraceInternalShell";
import {
  fetchSecurityStatus,
  lockEnterpriseData,
  unlockEnterpriseData,
  requestBreakGlass,
  fetchSecurityAudit,
  checkIntentFirewall,
  KeyStatus,
  SecurityEvent,
  FirewallCheckResult
} from "@/lib/api";

export default function CompliancePage() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [audit, setAudit] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [firewallInput, setFirewallInput] = useState("give me database of company");
  const [firewallResult, setFirewallResult] = useState<FirewallCheckResult | null>(null);
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);

  async function loadData() {
    try {
      const [s, a] = await Promise.all([fetchSecurityStatus(), fetchSecurityAudit()]);
      setStatus(s);
      setAudit(a);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleToggleLock() {
    if (!status) return;
    setLoading(true);
    try {
      if (status.status === "ACTIVE" || status.status === "BREAK_GLASS") {
        await lockEnterpriseData("Operations Director");
      } else {
        await unlockEnterpriseData("Operations Director");
      }
      await loadData();
    } catch (e) {
      alert(`Action failed: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleBreakGlassSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!breakGlassReason.trim()) return;
    setLoading(true);
    try {
      await requestBreakGlass("Operations Director", breakGlassReason, 15);
      setShowBreakGlassModal(false);
      setBreakGlassReason("");
      await loadData();
    } catch (e) {
      alert(`Break-glass failed: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleTestFirewall(query: string) {
    setFirewallInput(query);
    try {
      const res = await checkIntentFirewall(query);
      setFirewallResult(res);
    } catch (e) {
      alert(`Firewall check failed: ${e}`);
    }
  }

  return (
    <TraceInternalShell
      eyebrow="SENTINEL TRUST FABRIC"
      title="Trust & Compliance Center"
      description="Zero-trust security architecture, customer-controlled encryption key (KMS), and compliance alignment."
    >
      <div className="mx-auto max-w-5xl space-y-10">

        {/* Top Control Banner / Enterprise Lock */}
        <div className={`border p-6 sm:p-8 transition-colors ${
          status?.status === "LOCKED"
            ? "border-red-500/50 bg-red-950/20"
            : status?.status === "BREAK_GLASS"
            ? "border-amber-500/50 bg-amber-950/20"
            : "border-[#f0ba00]/40 bg-[#101724]"
        }`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#f0ba00] uppercase tracking-widest">Enterprise KMS Kill-Switch</span>
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                  status?.status === "LOCKED"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : status?.status === "BREAK_GLASS"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-[#43D49C]/20 text-[#43D49C] border border-[#43D49C]/30"
                }`}>
                  {status?.status ?? "FETCHING..."}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-medium text-white">
                {status?.status === "LOCKED"
                  ? "🔒 Customer Data Locked — Agent Tools Blocked"
                  : status?.status === "BREAK_GLASS"
                  ? "⚠️ Emergency Break-Glass Session Active"
                  : "🔐 Data Access Active (Envelope Encrypted)"}
              </h2>
              <p className="mt-2 text-sm text-[#9DAEC3] max-w-2xl">
                {status?.status === "LOCKED"
                  ? "The enterprise has revoked KMS decryption tokens. The SENTINEL recovery agent cannot decrypt raw database records or execute unapproved purchases."
                  : "The agent operates only while customer-controlled KMS keys are authorized. Cryptographic envelope encryption protects records at rest and in transit."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {status?.status === "LOCKED" && (
                <button
                  onClick={() => setShowBreakGlassModal(true)}
                  disabled={loading}
                  className="rounded-full border border-amber-500/50 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-all text-center"
                >
                  Break Glass 🧨
                </button>
              )}
              <button
                onClick={handleToggleLock}
                disabled={loading}
                className={`trace-pill text-sm font-bold text-center ${
                  status?.status === "LOCKED" ? "!bg-[#43D49C] !text-black" : "!bg-red-500 !text-white"
                }`}
              >
                {status?.status === "LOCKED" ? "Authorize / Unlock 🔓" : "Lock Customer Data 🔒"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#263447] pt-4 text-xs font-mono text-[#54717a] sm:grid-cols-4">
            <div>
              <span className="block text-[#9DAEC3]">Key ID</span>
              <span className="text-white">{status?.key_id ?? "Loading..."}</span>
            </div>
            <div>
              <span className="block text-[#9DAEC3]">Cipher</span>
              <span className="text-white">{status?.algorithm ?? "AES-256-GCM"}</span>
            </div>
            <div>
              <span className="block text-[#9DAEC3]">Rotation Epoch</span>
              <span className="text-white">{status?.last_rotated ? new Date(status.last_rotated).toLocaleDateString() : "2026-08-23"}</span>
            </div>
            <div>
              <span className="block text-[#9DAEC3]">Control Mode</span>
              <span className="text-white">Customer KMS (BYOK)</span>
            </div>
          </div>
        </div>

        {/* 1. Intent Firewall Interactive Demo */}
        <section className="border border-[#263447] bg-[#101724] p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-[#f0ba00] uppercase tracking-wider">Demo Pillar 1</span>
            <h2 className="text-xl font-medium text-white">🧠 Intent Firewall & Purpose Limitation (OWASP / GDPR)</h2>
            <p className="text-sm text-[#9DAEC3]">
              The LLM is an untrusted decision component. The Intent Firewall intercepts overbroad queries or prompt injection attacks before they reach internal tools or databases.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => handleTestFirewall("give me database of company")}
              className="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/40 font-mono"
            >
              ❌ Test: "give me database of company"
            </button>
            <button
              onClick={() => handleTestFirewall("export all supplier contracts and passwords")}
              className="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/40 font-mono"
            >
              ❌ Test: "export all supplier contracts"
            </button>
            <button
              onClick={() => handleTestFirewall("Find delayed PO for COMP-104 and score alternate suppliers")}
              className="rounded-md border border-[#43D49C]/40 bg-[#43D49C]/10 px-3 py-1.5 text-xs text-[#43D49C] hover:bg-[#43D49C]/20 font-mono"
            >
              ✅ Test: "Find delayed PO for COMP-104"
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            <input
              type="text"
              value={firewallInput}
              onChange={(e) => setFirewallInput(e.target.value)}
              className="flex-1 rounded border border-[#263447] bg-[#070e17] px-4 py-2.5 text-sm text-white focus:border-[#f0ba00] focus:outline-none font-mono"
              placeholder="Enter an agent prompt to test firewall rules..."
            />
            <button
              onClick={() => handleTestFirewall(firewallInput)}
              className="trace-pill trace-pill-small shrink-0"
            >
              Evaluate Intent ⚡
            </button>
          </div>

          {firewallResult && (
            <div className={`mt-4 border p-4 font-mono text-xs ${
              firewallResult.decision === "BLOCKED"
                ? "border-red-500/40 bg-red-950/30 text-red-300"
                : "border-[#43D49C]/40 bg-[#43D49C]/10 text-[#43D49C]"
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span>DECISION: {firewallResult.decision}</span>
                <span>RISK LEVEL: {firewallResult.risk_level}</span>
              </div>
              <p className="mt-2">{firewallResult.reason}</p>
              {firewallResult.clarification_prompt && (
                <div className="mt-2 border-t border-red-500/20 pt-2 text-white/90">
                  <span className="text-[#f0ba00]">Agent Response:</span> &ldquo;{firewallResult.clarification_prompt}&rdquo;
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2. Compliance & Standards Mapping */}
        <section className="border border-[#263447] bg-[#101724] p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-[#f0ba00] uppercase tracking-wider">Demo Pillar 2</span>
            <h2 className="text-xl font-medium text-white">🛡️ Security & Compliance Framework Alignment</h2>
            <p className="text-sm text-[#9DAEC3]">
              Architecture mapped by design to international and regional security standards (control-aligned design, non-certified).
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="border border-[#263447] bg-[#0a0f16] p-5">
              <div className="flex items-center justify-between text-xs font-mono text-[#f0ba00]">
                <span>ISO/IEC 27001:2022</span>
                <span className="text-[#43D49C]">ALIGNED</span>
              </div>
              <h3 className="mt-3 font-medium text-white text-base">ISMS & Access Control</h3>
              <ul className="mt-3 space-y-1.5 text-xs text-[#9DAEC3]">
                <li>• Least-privilege RBAC / ABAC</li>
                <li>• HMAC-SHA256 Hash Chain Integrity</li>
                <li>• Customer Master Key Revocation</li>
                <li>• Incident Containment (Lockdown)</li>
              </ul>
            </div>

            <div className="border border-[#263447] bg-[#0a0f16] p-5">
              <div className="flex items-center justify-between text-xs font-mono text-[#f0ba00]">
                <span>GDPR Article 32 & 25</span>
                <span className="text-[#43D49C]">ALIGNED</span>
              </div>
              <h3 className="mt-3 font-medium text-white text-base">Data Protection by Design</h3>
              <ul className="mt-3 space-y-1.5 text-xs text-[#9DAEC3]">
                <li>• Purpose-bound Data Minimization</li>
                <li>• AES-256-GCM Envelope Encryption</li>
                <li>• Pseudonymized Supplier Claims</li>
                <li>• Zero Personal Data in LLM Prompts</li>
              </ul>
            </div>

            <div className="border border-[#263447] bg-[#0a0f16] p-5">
              <div className="flex items-center justify-between text-xs font-mono text-[#f0ba00]">
                <span>India DPDP Act (2023/25)</span>
                <span className="text-[#43D49C]">ALIGNED</span>
              </div>
              <h3 className="mt-3 font-medium text-white text-base">Specified Purpose Safeguards</h3>
              <ul className="mt-3 space-y-1.5 text-xs text-[#9DAEC3]">
                <li>• Incident-scoped Processing Only</li>
                <li>• Full Provenance Audit Trail</li>
                <li>• No Persistence Beyond Session TTL</li>
                <li>• Human-in-the-Loop Threshold Gate</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Security Audit Trail */}
        <section className="border border-[#263447] bg-[#101724] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-[#f0ba00] uppercase tracking-wider">Demo Pillar 3</span>
              <h2 className="text-xl font-medium text-white">🔐 Security & Key Management Audit Trail</h2>
            </div>
            <Link href="/audit" className="text-xs font-mono text-[#f0ba00] hover:underline">
              View Hash Ledger →
            </Link>
          </div>

          <div className="mt-6 space-y-2 font-mono text-xs">
            {audit.length === 0 ? (
              <p className="text-[#54717a]">No security events logged yet.</p>
            ) : (
              audit.slice(0, 5).map((ev) => (
                <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center justify-between border border-[#263447] bg-[#0a0f16] p-3 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[#54717a]">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    <span className="text-[#f0ba00] font-bold">{ev.event_type}</span>
                    <span className="text-white/80">{ev.details}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#9DAEC3]">actor: {ev.actor}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      ev.status === "LOCKED" || ev.status === "WARNING" ? "bg-red-500/20 text-red-300" : "bg-[#43D49C]/20 text-[#43D49C]"
                    }`}>
                      {ev.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>

      {/* Break-Glass Modal */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md border border-amber-500/60 bg-[#101724] p-6 text-white shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <span className="text-xl">🧨</span>
              <h3 className="text-lg font-bold">Emergency Break-Glass Access</h3>
            </div>
            <p className="mt-2 text-xs text-[#9DAEC3]">
              Requires mandatory auditing. Temporarily authorizes the agent for 15 minutes to prevent imminent production shutdown.
            </p>

            <form onSubmit={handleBreakGlassSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#f0ba00] uppercase mb-1">
                  Justification / Incident ID
                </label>
                <textarea
                  required
                  rows={3}
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="e.g. Line 2 Assembly will starve in 20 mins due to PO-7712 delay. Authorizing emergency sourcing."
                  className="w-full rounded border border-[#263447] bg-[#070e17] p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(false)}
                  className="rounded px-4 py-2 text-xs font-mono text-[#9DAEC3] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-amber-500 px-4 py-2 text-xs font-mono font-bold text-black hover:bg-amber-400"
                >
                  {loading ? "Activating..." : "Grant 15-Min Break-Glass"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TraceInternalShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchKMSStatus,
  lockEnterpriseKMS,
  unlockEnterpriseKMS,
  requestBreakGlass,
  inspectPromptWithFirewall,
  fetchComplianceControls,
  testRealEncrypt,
  testRealDecrypt,
  KMSStatus,
  FirewallInspectionResult,
  ComplianceFramework,
} from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function TrustFabricPage() {
  const [kms, setKms] = useState<KMSStatus | null>(null);
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [firewallPrompt, setFirewallPrompt] = useState("Give me database of company");
  const [firewallResult, setFirewallResult] = useState<FirewallInspectionResult | null>(null);
  const [testingFirewall, setTestingFirewall] = useState(false);
  const [togglingKMS, setTogglingKMS] = useState(false);
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [approver1, setApprover1] = useState("CISO / Security Director");
  const [approver2, setApprover2] = useState("VP of Operations");
  const [breakGlassReason, setBreakGlassReason] = useState("Factory Line 2 imminent stoppage - critical component expedite");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Real Crypto States
  const [realTestPlaintext, setRealTestPlaintext] = useState("PO-7712: 1000 units COMP-104 @ $118/ea, Total: $118,000");
  const [realCiphertext, setRealCiphertext] = useState<{ iv: string; ciphertext: string } | null>(null);
  const [realDecryptedResult, setRealDecryptedResult] = useState<string | null>(null);

  async function handleRealEncrypt() {
    try {
      const res = await testRealEncrypt(realTestPlaintext);
      setRealCiphertext({ iv: res.iv, ciphertext: res.ciphertext });
      setRealDecryptedResult(null);
    } catch (e: any) {
      alert(`Real AES-256 Encryption failed: ${e.message}`);
    }
  }

  async function handleRealDecrypt() {
    if (!realCiphertext) return;
    try {
      const res = await testRealDecrypt(realCiphertext.iv, realCiphertext.ciphertext);
      setRealDecryptedResult(`DECRYPTED PLAINTEXT: "${res.plaintext}"`);
    } catch (e: any) {
      setRealDecryptedResult(`BLOCKED 403: ${e.message}`);
    }
  }

  async function loadData() {
    try {
      const [kmsData, complianceData] = await Promise.all([
        fetchKMSStatus(),
        fetchComplianceControls(),
      ]);
      setKms(kmsData);
      setFrameworks(complianceData.frameworks);
    } catch (e) {
      console.error("Failed to load trust fabric data:", e);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleToggleKMS() {
    if (!kms) return;
    setTogglingKMS(true);
    try {
      if (kms.status === "LOCKED") {
        await unlockEnterpriseKMS();
      } else {
        await lockEnterpriseKMS();
      }
      await loadData();
    } catch (e) {
      alert(`KMS action failed: ${e}`);
    } finally {
      setTogglingKMS(false);
    }
  }

  async function handleTestFirewall(promptToTest?: string) {
    const p = promptToTest ?? firewallPrompt;
    setTestingFirewall(true);
    try {
      const res = await inspectPromptWithFirewall(p);
      setFirewallResult(res);
    } catch (e) {
      alert(`Firewall inspection failed: ${e}`);
    } finally {
      setTestingFirewall(false);
    }
  }

  async function handleBreakGlassSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await requestBreakGlass(approver1, approver2, breakGlassReason);
      setShowBreakGlassModal(false);
      await loadData();
    } catch (e) {
      alert(`Break glass authorization failed: ${e}`);
    }
  }

  const isLocked = kms?.status === "LOCKED";
  const isBreakGlass = kms?.status === "BREAK_GLASS";

  return (
    <div className="min-h-screen bg-[#07090E] text-[#E8EAED]">
      {/* ── UNIFIED NAVBAR ── */}
      <Navbar />

      {/* ── HERO STRIP WITH GENEROUS TOP PADDING ── */}
      <div className="relative overflow-hidden border-b border-[#262B36] bg-[#0E121A] pt-32 pb-14">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#F5A623 1px,transparent 1px),linear-gradient(90deg,#F5A623 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -top-10 right-0 w-[500px] h-[500px] rounded-full bg-[#F5A623]/10 blur-[120px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className={`h-2.5 w-2.5 rounded-full ${isLocked ? "bg-[#F2545B]" : "bg-[#3DD68C] animate-pulse"}`} />
                <span className="font-mono text-xs text-[#F5A623] uppercase tracking-widest font-semibold">
                  SENTINEL TRUST FABRIC | ZERO TRUST CORE
                </span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-black uppercase text-white tracking-tight leading-none">
                Trust &amp; <span className="text-[#F5A623]">Security Center</span>
              </h1>
              <p className="mt-4 text-sm md:text-base text-[#8B93A1] max-w-2xl leading-relaxed">
                &ldquo;Autonomous when authorized. Blind when not.&rdquo; Customer-controlled encryption keys,
                intent firewall filtering, purpose-bound access, and verified compliance mappings.
              </p>
            </div>

            {/* Enterprise Lock CTA Button */}
            <div className="flex flex-col items-start md:items-end gap-3">
              <button
                onClick={handleToggleKMS}
                disabled={togglingKMS}
                className={`flex items-center gap-3 rounded-full px-8 py-4 text-sm md:text-base font-bold transition-all shadow-xl disabled:opacity-50 ${
                  isLocked
                    ? "bg-[#3DD68C] hover:bg-[#34bc7a] text-black shadow-[0_4px_25px_rgba(61,214,140,0.3)]"
                    : "bg-[#F2545B] hover:bg-[#d9444b] text-white shadow-[0_4px_25px_rgba(242,84,91,0.3)]"
                }`}
              >
                <span>{isLocked ? "UNLOCK SENTINEL DATA" : "LOCK ENTERPRISE DATA"}</span>
              </button>

              <div className="text-xs font-mono text-[#8B93A1]">
                Master Key: <span className="text-white">{kms?.master_key_id ?? "cmk-pune-sec-2026-v1"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10 space-y-12">
        {/* ── 1. ENTERPRISE KMS KEY STATUS CARD ── */}
        <section className="rounded-2xl border border-[#262B36] bg-[#141821] p-6 md:p-8 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#262B36]">
            <div>
              <h2 className="font-display text-2xl font-bold text-white flex items-center gap-3">
                <span>Enterprise Key Management (KMS)</span>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-mono font-bold ${
                    isLocked
                      ? "bg-[#F2545B]/15 text-[#F2545B] border border-[#F2545B]"
                      : isBreakGlass
                      ? "bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]"
                      : "bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]"
                  }`}
                >
                  {kms?.status ?? "ACTIVE"}
                </span>
              </h2>
              <p className="text-sm text-[#8B93A1] mt-1">
                Envelope encryption with AES-256-GCM. Customer holds the root key; revoking it immediately blinds the agent.
              </p>
            </div>

            {isLocked && (
              <button
                onClick={() => setShowBreakGlassModal(true)}
                className="px-5 py-2.5 rounded-full border border-[#F5A623] text-[#F5A623] hover:bg-[#F5A623]/10 text-xs font-bold transition-colors"
              >
                Break-Glass Emergency Access
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6">
            <div>
              <div className="text-xs text-[#8B93A1] font-mono uppercase">Encryption Mode</div>
              <div className="text-sm md:text-base font-bold text-white mt-1">AES-256 Envelope</div>
            </div>
            <div>
              <div className="text-xs text-[#8B93A1] font-mono uppercase">Decryption State</div>
              <div className={`text-sm md:text-base font-bold mt-1 ${isLocked ? "text-[#F2545B]" : "text-[#3DD68C]"}`}>
                {isLocked ? "BLOCKED / REVOKED" : "AUTHORIZED"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#8B93A1] font-mono uppercase">Tenant Boundary</div>
              <div className="text-sm md:text-base font-bold text-white mt-1">{kms?.tenant_id ?? "ACME-CORP-01"}</div>
            </div>
            <div>
              <div className="text-xs text-[#8B93A1] font-mono uppercase">Active Decrypt Sessions</div>
              <div className="text-sm md:text-base font-bold text-white mt-1">{kms?.active_sessions ?? 0}</div>
            </div>
          </div>

          {/* Real Cryptographic Proof Console */}
          <div className="mt-8 pt-6 border-t border-[#262B36] bg-[#0E121A] p-5 rounded-2xl border">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs font-bold text-[#F5A623] uppercase">
                Real Cryptographic AES-256-GCM Proof Console
              </span>
              <span className="text-[11px] font-mono text-[#8B93A1]">OpenSSL AESGCM Engine</span>
            </div>
            <p className="text-xs text-[#8B93A1] mb-4">
              Encrypt sensitive operational data in real-time. Try locking the KMS above, then attempt decryption to verify the cryptographic block.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <label className="text-[#8B93A1] font-mono">1. Plaintext Data Payload:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={realTestPlaintext}
                    onChange={(e) => setRealTestPlaintext(e.target.value)}
                    className="flex-1 rounded-xl bg-[#141821] border border-[#262B36] px-3.5 py-2 text-white font-mono text-xs"
                  />
                  <button
                    onClick={handleRealEncrypt}
                    disabled={isLocked}
                    className="px-4 py-2 bg-[#F5A623] hover:bg-[#E09010] text-black font-bold rounded-xl disabled:opacity-40 transition-colors"
                  >
                    Encrypt
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[#8B93A1] font-mono">2. Real Ciphertext (Base64 + 96-bit IV):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={realCiphertext ? `${realCiphertext.iv}:${realCiphertext.ciphertext.slice(0, 24)}...` : "Click Encrypt"}
                    className="flex-1 rounded-xl bg-[#141821] border border-[#262B36] px-3.5 py-2 text-[#3DD68C] font-mono text-xs"
                  />
                  <button
                    onClick={handleRealDecrypt}
                    disabled={!realCiphertext}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl disabled:opacity-40 transition-colors"
                  >
                    Decrypt
                  </button>
                </div>
              </div>
            </div>

            {realDecryptedResult && (
              <div className={`mt-4 p-3 rounded-xl font-mono text-xs ${
                realDecryptedResult.startsWith("BLOCKED")
                  ? "bg-[#F2545B]/15 border border-[#F2545B]/30 text-[#F2545B]"
                  : "bg-[#3DD68C]/15 border border-[#3DD68C]/30 text-[#3DD68C]"
              }`}>
                {realDecryptedResult}
              </div>
            )}
          </div>
        </section>

        {/* ── 2. INTENT FIREWALL INTERACTIVE SANDBOX ── */}
        <section className="rounded-2xl border border-[#262B36] bg-[#141821] p-6 md:p-8 shadow-lg">
          <div className="pb-6 border-b border-[#262B36]">
            <h2 className="font-display text-2xl font-bold text-white flex items-center gap-3">
              <span>Intent Firewall &amp; Data Minimization Sandbox</span>
              <span className="text-xs px-3 py-1 rounded-full font-mono font-bold bg-[#4EA1FF]/15 text-[#4EA1FF] border border-[#4EA1FF]/30">
                OWASP LLM-01 &amp; GDPR Art. 25
              </span>
            </h2>
            <p className="text-sm text-[#8B93A1] mt-1">
              Test how SENTINEL defends against overly broad prompts like &ldquo;give me database of company&rdquo; vs legitimate scoped queries.
            </p>
          </div>

          <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Input & Preset Tests */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <label className="text-xs font-mono text-[#8B93A1] uppercase block mb-2">
                  Test Prompt / Agent Query
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={firewallPrompt}
                    onChange={(e) => setFirewallPrompt(e.target.value)}
                    placeholder="Enter prompt e.g. 'Give me database of company'..."
                    className="flex-1 rounded-xl bg-[#0E121A] border border-[#262B36] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F5A623]"
                  />
                  <button
                    onClick={() => handleTestFirewall()}
                    disabled={testingFirewall}
                    className="rounded-xl bg-[#F5A623] hover:bg-[#E09010] px-5 py-3 text-sm font-bold text-black disabled:opacity-50 transition-colors"
                  >
                    {testingFirewall ? "Inspecting..." : "Evaluate"}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-xs font-mono text-[#8B93A1] uppercase mb-2">Quick Demo Attack Presets:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setFirewallPrompt("Give me database of company");
                      handleTestFirewall("Give me database of company");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#F2545B]/30 bg-[#F2545B]/10 hover:bg-[#F2545B]/20 text-[#F2545B] text-xs font-medium transition-colors"
                  >
                    [BLOCKED] &ldquo;Give me database of company&rdquo;
                  </button>
                  <button
                    onClick={() => {
                      setFirewallPrompt("Export entire supplier catalog with all employee records");
                      handleTestFirewall("Export entire supplier catalog with all employee records");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#F2545B]/30 bg-[#F2545B]/10 hover:bg-[#F2545B]/20 text-[#F2545B] text-xs font-medium transition-colors"
                  >
                    [BLOCKED] &ldquo;Export entire supplier catalog...&rdquo;
                  </button>
                  <button
                    onClick={() => {
                      setFirewallPrompt("Find alternative suppliers for COMP-104 with lead time < 5 days");
                      handleTestFirewall("Find alternative suppliers for COMP-104 with lead time < 5 days");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#3DD68C]/30 bg-[#3DD68C]/10 hover:bg-[#3DD68C]/20 text-[#3DD68C] text-xs font-medium transition-colors"
                  >
                    [ALLOWED] &ldquo;Find alternate suppliers for COMP-104...&rdquo;
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Firewall Decision Result */}
            <div className="lg:col-span-6 bg-[#0E121A] rounded-2xl border border-[#262B36] p-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="text-xs font-mono text-[#8B93A1] uppercase">Firewall Inspection Output</span>
                {firewallResult && (
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-mono font-bold ${
                      firewallResult.verdict === "DENIED"
                        ? "bg-[#F2545B]/15 text-[#F2545B] border border-[#F2545B]/40"
                        : "bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/40"
                    }`}
                  >
                    {firewallResult.status}
                  </span>
                )}
              </div>

              {firewallResult ? (
                <div className="mt-4 space-y-3 text-xs leading-relaxed">
                  <div>
                    <span className="text-[#8B93A1]">VERDICT:</span>{" "}
                    <strong className={firewallResult.verdict === "DENIED" ? "text-[#F2545B]" : "text-[#3DD68C]"}>
                      {firewallResult.verdict}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8B93A1]">REASON:</span> <span className="text-white">{firewallResult.reason}</span>
                  </div>
                  <div className="text-[#8B93A1]">{firewallResult.explanation}</div>

                  {firewallResult.purpose_bound_ticket && (
                    <div className="mt-3 p-3 rounded-xl bg-[#141821] border border-[#3DD68C]/20 font-mono text-[11px] space-y-1">
                      <div className="text-[#3DD68C] font-bold">PURPOSE-BOUND TICKET: {firewallResult.purpose_bound_ticket.ticket_id}</div>
                      <div>Scope: {firewallResult.purpose_bound_ticket.scoped_resources.join(", ")}</div>
                      <div>Fields Allowed: {firewallResult.purpose_bound_ticket.minimized_fields.slice(0, 4).join(", ")}...</div>
                      <div className="text-[#8B93A1]">Unauthorized Fields Stripped: Internal Margins, Employee PII, Auth Tokens</div>
                    </div>
                  )}

                  {firewallResult.required_action && (
                    <div className="p-3 rounded-xl bg-[#F2545B]/10 border border-[#F2545B]/20 text-[#F2545B]">
                      <strong>Required Action:</strong> {firewallResult.required_action}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#8B93A1]">
                  Click &ldquo;Evaluate&rdquo; or a demo preset above to see the Intent Firewall in action.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 3. COMPLIANCE & CONTROL READINESS MAPPING ── */}
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Compliance &amp; Security Control Mapping</h2>
            <p className="text-sm text-[#8B93A1] mt-1">
              Verifiable alignment with international standards and national privacy frameworks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {frameworks.map((fw) => (
              <div key={fw.id} className="rounded-2xl border border-[#262B36] bg-[#141821] p-6 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-display text-lg font-bold text-white">{fw.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30 font-semibold">
                      {fw.alignment_status}
                    </span>
                  </div>
                  <p className="text-xs text-[#8B93A1] mb-4">{fw.title}</p>

                  <div className="space-y-3">
                    {fw.controls.map((ctrl) => (
                      <div key={ctrl.code} className="p-3 rounded-xl bg-[#0E121A] border border-white/5 text-xs">
                        <div className="flex items-center justify-between font-mono font-bold text-white mb-1">
                          <span className="text-[#F5A623]">{ctrl.code}</span>
                          <span className="text-[#3DD68C]">{ctrl.status}</span>
                        </div>
                        <div className="font-semibold text-white mb-1">{ctrl.name}</div>
                        <p className="text-[#8B93A1] leading-relaxed text-[11px] mb-2">{ctrl.implementation}</p>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#8B93A1] pt-1.5 border-t border-white/5">
                          <span>Proof: {ctrl.proof_hash}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(ctrl.proof_hash);
                              setCopiedHash(ctrl.proof_hash);
                              setTimeout(() => setCopiedHash(null), 2000);
                            }}
                            className="text-[#F5A623] hover:underline"
                          >
                            {copiedHash === ctrl.proof_hash ? "Copied" : "Copy Hash ↗"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-[#8B93A1] italic">
                  {fw.disclaimer}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── BREAK-GLASS EMERGENCY MODAL ── */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#F5A623]/40 bg-[#141821] p-6 shadow-2xl">
            <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <span>Break-Glass Dual Authorization Protocol</span>
            </h3>
            <p className="text-xs text-[#8B93A1] mt-1">
              Temporarily override enterprise KMS lock under strict 2-person approval for urgent operational recovery.
            </p>

            <form onSubmit={handleBreakGlassSubmit} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="text-[#8B93A1] font-mono uppercase block mb-1">Approver 1 (CISO / Security)</label>
                <input
                  type="text"
                  required
                  value={approver1}
                  onChange={(e) => setApprover1(e.target.value)}
                  className="w-full rounded-xl bg-[#0E121A] border border-[#262B36] px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-[#8B93A1] font-mono uppercase block mb-1">Approver 2 (Operations Lead)</label>
                <input
                  type="text"
                  required
                  value={approver2}
                  onChange={(e) => setApprover2(e.target.value)}
                  className="w-full rounded-xl bg-[#0E121A] border border-[#262B36] px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-[#8B93A1] font-mono uppercase block mb-1">Emergency Operational Reason</label>
                <textarea
                  required
                  rows={2}
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  className="w-full rounded-xl bg-[#0E121A] border border-[#262B36] px-3.5 py-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(false)}
                  className="px-5 py-2 rounded-full border border-[#262B36] text-[#8B93A1] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#F5A623] hover:bg-[#E09010] text-black font-bold"
                >
                  Authorize 15m Emergency Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#262B36] bg-[#07090E] px-8 py-8 mt-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[#8B93A1]">
          <span className="font-display font-bold text-[#F5A623] tracking-wider text-sm">SENTINEL TRUST FABRIC</span>
          <p className="font-mono">Hackers Occupied Pune 2026 · Agentic AI Track</p>
        </div>
      </footer>
    </div>
  );
}

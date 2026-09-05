"use client";

import { useEffect, useState } from "react";
import {
  fetchSupplierMessages,
  fetchSupplierTrustSummary,
  SupplierMessage,
  SupplierTrustSummary,
} from "@/lib/api";
import { TraceInternalShell } from "@/components/TraceInternalShell";

const TRUST_COLOR: Record<string, string> = {
  LOW: "text-status-rejected border-status-rejected bg-status-rejected/10",
  MODERATE: "text-status-pending border-status-pending bg-status-pending/10",
  OK: "text-status-auto border-status-auto bg-status-auto/10",
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

  return (
    <TraceInternalShell
      eyebrow="SUPPLIER NETWORK"
      title="Trust & Communications"
      description="Verifiable history of supplier claims, tracking anomalies, and negotiation messages."
    >
      <div className="mx-auto max-w-4xl">
        {error && (
          <p className="mt-4 border border-status-rejected/30 bg-status-rejected/10 p-4 text-status-rejected">
            Could not load supplier data. Is the backend running?
          </p>
        )}

        <section className="mt-2">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Trust Memory</h2>
          {trust.length === 0 ? (
            <p className="mt-4 border border-dashed border-border p-6 text-center text-sm text-text-secondary">
              No contradictions on record yet. Every supplier starts trusted.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {trust.map((t) => (
                <div
                  key={t.supplier_id}
                  className={`flex items-center justify-between border p-4 text-sm ${TRUST_COLOR[t.trust_level]}`}
                >
                  <span className="font-mono">
                    {t.supplier_id} {t.supplier_name && `— ${t.supplier_name}`}
                  </span>
                  <span>
                    {t.contradiction_count} claim{t.contradiction_count === 1 ? "" : "s"} contradicted — trust:{" "}
                    <strong>{t.trust_level}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Communications Log</h2>
          {Object.keys(grouped).length === 0 && (
            <p className="mt-4 border border-dashed border-border p-8 text-center text-sm text-text-secondary">
              No supplier messages yet. Injecting a disruption that negotiates will populate this.
            </p>
          )}
          <div className="mt-4 space-y-8">
            {Object.entries(grouped).map(([poKey, msgs]) => (
              <div key={poKey} className="border-t border-[#263447] pt-6">
                <div className="mb-4 font-mono text-xs text-[#f0ba00]">
                  {poKey.startsWith("unlinked-") ? "New supplier outreach" : `Subject: ${poKey}`}
                </div>
                <div className="space-y-4">
                  {msgs.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] border border-border p-4 text-sm ${
                        m.direction === "outbound" ? "ml-auto bg-surface-raised" : "bg-surface"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono text-text-secondary mb-3">
                        <span>{m.direction === "outbound" ? "Trace Agent" : m.supplier_id}</span>
                        <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                      </div>
                      {m.subject && <div className="mt-1 font-medium text-text-primary mb-2">{m.subject}</div>}
                      <p className="text-text-primary leading-relaxed whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </TraceInternalShell>
  );
}

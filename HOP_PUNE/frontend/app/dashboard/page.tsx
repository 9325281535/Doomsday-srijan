"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveFeed } from "@/lib/useLiveFeed";
import { TraceInternalShell } from "@/components/TraceInternalShell";
import { DisruptionFeedCard } from "@/components/DisruptionFeedCard";
import { InjectDisruptionModal } from "@/components/InjectDisruptionModal";
import { CorrectInventoryButton } from "@/components/CorrectInventoryButton";

export default function DashboardPage() {
  const { disruptions, decisions, liveStatuses, wsConnected, refresh } = useLiveFeed();
  const [modalOpen, setModalOpen] = useState(false);

  const pendingCount = decisions.filter((d) => d.status === "pending_approval").length;
  const autoExecuted = decisions.filter((d) => d.status === "auto_executed").length;

  return (
    <TraceInternalShell
      eyebrow="CONTROL CENTER"
      title="Disruption Dashboard"
      description="Real-time supply chain disruption monitoring and autonomous recovery agent."
    >
      {/* Stat Cards */}
      <div className="mb-10 grid gap-5 sm:grid-cols-3">
        <div className="trace-control-card p-6">
          <p className="font-mono text-xs text-[#f0ba00]">01</p>
          <p className="mt-8 text-sm text-[#54717a] font-mono">TOTAL DISRUPTIONS</p>
          <p className="mt-2 text-4xl font-medium text-white">{disruptions.length}</p>
        </div>
        <div className="trace-control-card p-6">
          <p className="font-mono text-xs text-[#f0ba00]">02</p>
          <p className="mt-8 text-sm text-[#54717a] font-mono">AUTO-RECOVERED</p>
          <p className="mt-2 text-4xl font-medium text-[#43D49C]">{autoExecuted}</p>
        </div>
        <div className="trace-control-card p-6">
          <p className="font-mono text-xs text-[#f0ba00]">03</p>
          <p className="mt-8 text-sm text-[#54717a] font-mono">PENDING APPROVAL</p>
          <p className="mt-2 text-4xl font-medium text-[#F5B93E]">{pendingCount}</p>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_350px]">
        {/* Live Feed */}
        <section>
          <div className="mb-6 flex items-center justify-between border-b border-[#263447] pb-4">
            <h2 className="text-xl font-medium text-white">Live Event Feed</h2>
            <span className={`flex items-center gap-2 text-xs font-mono uppercase ${wsConnected ? "text-[#43D49C]" : "text-[#F5B93E]"}`}>
              <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-[#43D49C]" : "bg-[#F5B93E] animate-pulse"}`} />
              {wsConnected ? "Agent Connected" : "Reconnecting..."}
            </span>
          </div>

          {disruptions.length === 0 ? (
            <div className="border border-dashed border-[#263447] p-12 text-center">
              <p className="text-sm text-[#54717a] mb-6">No active disruptions detected in the supply chain.</p>
              <button onClick={() => setModalOpen(true)} className="trace-pill mx-auto">
                Inject a test event <span>↗</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {disruptions.map((disruption) => (
                <DisruptionFeedCard
                  key={disruption.id}
                  disruption={disruption}
                  decision={decisions.find((d) => d.disruption_id === disruption.id)}
                  liveStatus={liveStatuses[disruption.id]}
                />
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions / Links */}
        <section className="space-y-6">
          <div className="border border-[#263447] bg-[#101724] p-6">
            <h3 className="font-medium text-white mb-4">Agent Controls</h3>
            <button
              onClick={() => setModalOpen(true)}
              className="w-full text-center trace-pill"
            >
              Inject Disruption <span>⚡</span>
            </button>
          </div>

          {/* Replan Demo */}
          <CorrectInventoryButton onCorrected={refresh} />

          <div className="border border-[#263447] bg-[#101724] p-6">
            <h3 className="font-medium text-white mb-4">System Views</h3>
            <div className="flex flex-col gap-4">
              <Link href="/compliance" className="flex items-center justify-between text-sm text-[#f0ba00] hover:text-white transition-colors">
                <span className="font-semibold">🛡️ Trust & Security Center (KMS)</span>
                <span>→</span>
              </Link>
              <Link href="/approvals" className="flex items-center justify-between text-sm text-[#9DAEC3] hover:text-white transition-colors">
                <span>Approval Queue</span>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-[#F5B93E] px-2 py-0.5 text-[10px] font-bold text-black">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link href="/audit" className="flex items-center justify-between text-sm text-[#9DAEC3] hover:text-white transition-colors">
                <span>Cryptographic Audit Trail</span>
                <span>→</span>
              </Link>
              <Link href="/suppliers" className="flex items-center justify-between text-sm text-[#9DAEC3] hover:text-white transition-colors">
                <span>Supplier Comms & Trust</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {modalOpen && (
        <InjectDisruptionModal
          onClose={() => setModalOpen(false)}
          onInjected={() => {
            setModalOpen(false);
            refresh();
          }}
        />
      )}
    </TraceInternalShell>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveFeed } from "@/lib/useLiveFeed";
import { DisruptionFeedCard } from "@/components/DisruptionFeedCard";
import { InjectDisruptionModal } from "@/components/InjectDisruptionModal";
import { CorrectInventoryButton } from "@/components/CorrectInventoryButton";
import { Navbar } from "@/components/Navbar";

export default function DashboardPage() {
  const { disruptions, decisions, liveStatuses, contradictedIds, wsConnected, refresh } = useLiveFeed();
  const [modalOpen, setModalOpen] = useState(false);

  const decisionByDisruption = useMemo(() => {
    const map = new Map<string, (typeof decisions)[number]>();
    for (const d of decisions) map.set(d.disruption_id, d);
    return map;
  }, [decisions]);

  const pendingCount = decisions.filter((d) => d.status === "pending_approval").length;
  const autoExecutedCount = decisions.filter((d) => d.status === "auto_executed").length;
  const rejectedCount = decisions.filter((d) => d.status === "rejected").length;

  return (
    <div className="min-h-screen bg-[#07090E] text-[#E8EAED]">
      {/* ── UNIFIED NAVBAR ── */}
      <Navbar onInjectClick={() => setModalOpen(true)} pendingCount={pendingCount} />

      {/* ── HERO WITH REAL CINEMATIC BACKGROUND VIDEO ── */}
      <section className="relative min-h-[90vh] pt-24 pb-16 px-8 flex items-center overflow-hidden border-b border-[#262B36]">
        {/* Background Video Layer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-cover object-center scale-105"
          >
            <source src="/videos/hero_loop_seamless.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Heavy Dark & Amber Gradient Overlay for Contrast & Theme Matching */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#07090E] via-[#07090E]/80 to-black/40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-transparent to-[#07090E]/70 pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-[500px] h-[500px] rounded-full bg-[#F5A623]/15 blur-[120px] pointer-events-none" />

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Title & Live Agent Status */}
          <div className="lg:col-span-8">
            <h1 className="font-display font-black uppercase text-[clamp(2.8rem,6.5vw,6rem)] leading-[0.92] tracking-tight">
              <span className="block text-[#F5A623]">BEYOND DISRUPTIONS</span>
              <span className="block text-white">AND SUPPLY LIMITS</span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-[#8B93A1] max-w-xl leading-relaxed">
              Autonomous AI agent for supply chain disruption triage, supplier negotiation, constraint verification, and tamper-evident decision logs.
            </p>

            {/* Quick Metrics Strip */}
            <div className="mt-10 flex flex-wrap items-center gap-8 border-t border-[#262B36] pt-6">
              <div>
                <div className="font-display text-4xl font-black text-[#F5A623]">{disruptions.length}</div>
                <div className="text-xs text-[#8B93A1] mt-0.5">Total Events</div>
              </div>
              <div className="h-8 w-px bg-[#262B36]" />
              <div>
                <div className="font-display text-4xl font-black text-[#3DD68C]">{autoExecutedCount}</div>
                <div className="text-xs text-[#8B93A1] mt-0.5">Auto-Executed</div>
              </div>
              <div className="h-8 w-px bg-[#262B36]" />
              <div>
                <div className="font-display text-4xl font-black text-[#F5A623]">{pendingCount}</div>
                <div className="text-xs text-[#8B93A1] mt-0.5">Pending Approval</div>
              </div>
            </div>
          </div>

          {/* Right Action Card */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-[#141821]/90 backdrop-blur-md border border-[#262B36] p-6 rounded-2xl shadow-xl">
              <h3 className="font-display text-lg font-bold text-white mb-2">Agent Quick Controls</h3>
              <p className="text-xs text-[#8B93A1] mb-5 leading-relaxed">
                Test the autonomous loop by injecting synthetic disruptions or triggering inventory corrections.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => setModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F5A623] hover:bg-[#E09010] px-4 py-3 text-sm font-bold text-black transition-colors"
                >
                  <span>Inject Test Disruption</span>
                  <span>↗</span>
                </button>
                <CorrectInventoryButton onCorrected={refresh} />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── LIVE FEED SECTION ── */}
      <section className="max-w-7xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between pb-6 border-b border-[#262B36]">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Live Disruption Feed</h2>
            <p className="text-sm text-[#8B93A1] mt-0.5">Real-time telemetry and decision history</p>
          </div>
          <span className="font-mono text-xs text-[#8B93A1]">{disruptions.length} events logged</span>
        </div>

        <div className="mt-6 space-y-4">
          {disruptions.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#262B36] bg-[#141821]/50 py-16 text-center">
              <div className="text-4xl mb-3">📡</div>
              <p className="font-display text-base font-semibold text-white">No active disruptions</p>
              <p className="mt-1 text-xs text-[#8B93A1] max-w-xs">
                Inject a disruption above to watch the agent analyze, negotiate, and execute recovery.
              </p>
            </div>
          )}

          {disruptions.map((d) => (
            <DisruptionFeedCard
              key={d.id}
              disruption={d}
              decision={decisionByDisruption.get(d.id)}
              liveStatus={liveStatuses[d.id]}
              wasContradicted={contradictedIds.has(d.id)}
            />
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#262B36] bg-[#07090E] px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#8B93A1]">
          <span className="font-display font-bold text-[#F5A623] tracking-wider">TRACE SCDA</span>
          <span className="font-mono">Hackers Occupied Pune 2026</span>
        </div>
      </footer>

      {modalOpen && (
        <InjectDisruptionModal onClose={() => setModalOpen(false)} onInjected={refresh} />
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { InjectDisruptionModal } from "@/components/InjectDisruptionModal";

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const controlRef = useRef<HTMLElement>(null);
  const controlVideoRef = useRef<HTMLVideoElement>(null);
  const flowRef = useRef<HTMLElement>(null);
  const flowVideoRef = useRef<HTMLVideoElement>(null);
  const trustRef = useRef<HTMLElement>(null);
  const trustVideoRef = useRef<HTMLVideoElement>(null);
  const openModal = () => setModalOpen(true);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    }, { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const section = trustRef.current;
    const video = trustVideoRef.current;
    if (!section || !video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.pause();
    let frame = 0;
    const scrub = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / range));
      section.style.setProperty("--scene-progress", String(progress));
      section.style.setProperty("--scene-fade", String(Math.max(0, Math.min(1, (progress - 0.82) / 0.18))));
      section.style.setProperty("--scene-entry", String(1 - Math.min(1, progress / 0.14)));
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = progress * video.duration;
      video.style.transform = `translate3d(0, ${progress * -10}px, 0) scale(${1.03 + progress * 0.02})`;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(scrub); };
    video.addEventListener("loadedmetadata", scrub);
    window.addEventListener("scroll", onScroll, { passive: true });
    scrub();
    return () => { video.removeEventListener("loadedmetadata", scrub); window.removeEventListener("scroll", onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const section = flowRef.current;
    const video = flowVideoRef.current;
    if (!section || !video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.pause();
    let frame = 0;
    const scrub = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / range));
      section.style.setProperty("--scene-progress", String(progress));
      section.style.setProperty("--scene-fade", String(Math.max(0, Math.min(1, (progress - 0.82) / 0.18))));
      section.style.setProperty("--scene-entry", String(1 - Math.min(1, progress / 0.14)));
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = progress * video.duration;
      video.style.transform = `translate3d(0, ${progress * -12}px, 0) scale(${1.03 + progress * 0.02})`;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(scrub); };
    video.addEventListener("loadedmetadata", scrub);
    window.addEventListener("scroll", onScroll, { passive: true });
    scrub();
    return () => { video.removeEventListener("loadedmetadata", scrub); window.removeEventListener("scroll", onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const section = controlRef.current;
    const video = controlVideoRef.current;
    if (!section || !video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.pause();
    let frame = 0;
    const scrub = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / range));
      section.style.setProperty("--scene-progress", String(progress));
      section.style.setProperty("--scene-fade", String(Math.max(0, Math.min(1, (progress - 0.82) / 0.18))));
      section.style.setProperty("--scene-entry", String(1 - Math.min(1, progress / 0.14)));
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = progress * video.duration;
      video.style.transform = `translate3d(0, ${progress * -14}px, 0) scale(${1.03 + progress * 0.025})`;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(scrub); };
    video.addEventListener("loadedmetadata", scrub);
    window.addEventListener("scroll", onScroll, { passive: true });
    scrub();
    return () => { video.removeEventListener("loadedmetadata", scrub); window.removeEventListener("scroll", onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const video = heroVideoRef.current;
    if (!hero || !video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.pause();
    let frame = 0;
    const scrub = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      const range = Math.max(1, hero.offsetHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, -rect.top / range));
      hero.style.setProperty("--scene-progress", String(progress));
      hero.style.setProperty("--scene-fade", String(Math.max(0, Math.min(1, (progress - 0.82) / 0.18))));
      hero.style.setProperty("--scene-entry", String(1 - Math.min(1, progress / 0.14)));
      hero.style.setProperty("--hero-progress", String(progress));
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = progress * video.duration;
      video.style.transform = `translate3d(0, ${progress * -18}px, 0) scale(${1.04 + progress * 0.035})`;
      hero.querySelector<HTMLElement>(".trace-hero-content")?.style.setProperty("transform", `translate3d(0, ${progress * -10}px, 35px)`);
      hero.querySelector<HTMLElement>(".trace-hero-panel")?.style.setProperty("transform", `translate3d(0, ${progress * -22}px, 70px)`);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(scrub); };
    video.addEventListener("loadedmetadata", scrub);
    window.addEventListener("scroll", onScroll, { passive: true });
    scrub();
    return () => { video.removeEventListener("loadedmetadata", scrub); window.removeEventListener("scroll", onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  return (
    <main className="trace-site min-h-screen bg-[#f4eddf] text-[#073847]">
      <section ref={heroRef} className="trace-hero trace-video-scene relative min-h-[760px] overflow-hidden lg:min-h-screen">
        <div className="trace-scene-sticky">
        <div className="trace-hero-image absolute inset-0" />
        <video ref={heroVideoRef} className="trace-hero-video absolute inset-0" muted playsInline preload="auto" poster="/trace-truck-sunset.png" aria-hidden="true">
          <source src="/trace-hero.mp4" type="video/mp4" />
        </video>
        <div className="trace-hero-shade absolute inset-0" />
        <header className="relative z-10 mx-auto flex w-full max-w-[1800px] items-center justify-between gap-8 px-6 py-7 sm:px-10 lg:px-12">
          <Link href="/" className="trace-logo">TRACE<span>.</span></Link>
          <nav className="hidden items-center gap-10 text-[15px] text-white/90 md:flex"><a href="#control">Control <span className="ml-2 text-lg">⌄</span></a><a href="#flow">How it works <span className="ml-2 text-lg">⌄</span></a><a href="#trust">Trust <span className="ml-2 text-lg">⌄</span></a></nav>
          <div className="flex items-center gap-4"><Link href="/dashboard" className="hidden text-sm text-white/90 sm:block">Open Dashboard</Link><button onClick={openModal} className="trace-pill trace-pill-small">Run a scenario <span>↗</span></button></div>
        </header>
        <div className="trace-hero-content relative z-10 mx-auto grid min-h-[650px] max-w-[1800px] items-center gap-10 px-6 pb-20 pt-20 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:pb-24 lg:pt-8">
          <div className="max-w-[790px]"><p className="trace-kicker">TRACE · SUPPLY CHAIN CONTROL AGENT</p><h1 className="trace-display mt-6 text-white">DISRUPTIONS<br /><span>CONTAINED</span><br />IN SECONDS</h1><p className="mt-8 max-w-[480px] text-base leading-7 text-white/80 sm:text-lg">When a supplier fails, Trace assesses the impact, finds a compliant recovery path, and keeps production moving—with every decision explained.</p><div className="mt-9 flex flex-wrap items-center gap-4"><button onClick={openModal} className="trace-pill">Inject a disruption <span>↗</span></button><a href="#flow" className="trace-outline-pill">See the control flow <span>↓</span></a></div></div>
          <div className="trace-hero-panel lg:justify-self-end lg:pr-4"><div className="trace-copy-panel"><p className="trace-kicker text-[#f7cc00]">MANUFACTURING OPERATIONS, REWIRED</p><h2 className="mt-5 text-4xl font-medium leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl">Risk seen early.<br />Recovery planned<br />with precision.</h2><div className="mt-9 max-w-[430px] border-t border-white/30 pt-5 text-sm leading-6 text-white/80"><p>Inventory coverage, supplier reliability, quality, cost, MOQ, deadlines, and approval limits—checked together before the next move.</p></div><div className="mt-7 flex items-center gap-4 text-sm text-white/85"><span className="h-2 w-2 rounded-full bg-[#f7cc00]" /> Live control layer · 03 routes active</div></div></div>
        </div>
        <div className="relative z-10 mx-auto flex max-w-[1800px] flex-col justify-between gap-8 px-6 pb-8 sm:flex-row sm:items-end sm:px-10 lg:px-12"><div className="flex items-end gap-5 text-white"><strong className="trace-stat">96%</strong><span className="max-w-[180px] pb-1 text-sm leading-5 text-white/75">of safe recovery plans auto-executed within limits</span></div><div className="flex items-center gap-3 text-white/80"><span className="text-2xl text-[#f7cc00]">↗</span><span className="text-sm">Operational clarity at every handoff</span></div></div>
        </div>
      </section>

      <section ref={controlRef} id="control" className="trace-light-section trace-story-control trace-video-scene px-6 py-20 sm:px-10 lg:px-12 lg:py-28"><div className="trace-scene-sticky"><video ref={controlVideoRef} className="trace-section-video" muted playsInline preload="auto" poster="/trace-story-disruption.png" aria-hidden="true"><source src="/trace-control.mp4" type="video/mp4" /></video><div className="trace-section-video-shade absolute inset-0" /><div className="relative z-10 mx-auto grid max-w-[1500px] gap-14 lg:grid-cols-[.85fr_1.15fr] lg:items-start" data-reveal><div><p className="trace-kicker-dark">THE CONTROL LAYER</p><h2 className="trace-section-title mt-5">One place to see<br />what production<br /><span>needs next.</span></h2></div><div className="grid gap-5 sm:grid-cols-2"><ControlCard icon="01" title="Production risk" text="Know when a shortage becomes a stop—not just when a PO becomes late." /><ControlCard icon="02" title="Recovery sourcing" text="Score reliable suppliers and split orders without losing the math." /><ControlCard icon="03" title="Human guardrails" text="Auto-execute what is safe. Route expensive decisions to approval." /><ControlCard icon="04" title="Claim verification" text="Compare what suppliers say with what tracking data proves." /></div></div></div></section>

      <section ref={flowRef} id="flow" className="trace-flow-section trace-story-signal trace-video-scene px-6 py-20 sm:px-10 lg:px-12 lg:py-28"><div className="trace-scene-sticky"><video ref={flowVideoRef} className="trace-section-video" muted playsInline preload="auto" poster="/trace-story-signal.png" aria-hidden="true"><source src="/trace-flow.mp4" type="video/mp4" /></video><div className="trace-section-video-shade absolute inset-0" /><div className="relative z-10 mx-auto max-w-[1500px]" data-reveal><div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="trace-kicker-dark">THE DECISION FLOW</p><h2 className="trace-section-title mt-5">From signal<br />to <span>action.</span></h2></div><p className="max-w-md text-sm leading-6 text-[#54717a]">Deterministic checks do the guarding. AI coordinates the response. People stay in control where it matters.</p></div><div className="mt-16 grid gap-0 border-t border-[#d5cdbc] sm:grid-cols-2 lg:grid-cols-7">{["Disruption detected", "Risk classified", "Claims verified", "Suppliers scored", "Recovery planned", "Human gate", "Audit written"].map((step, i) => <div key={step} className="trace-stagger border-b border-[#d5cdbc] py-5 pr-5 lg:border-b-0 lg:border-r lg:px-5 lg:first:border-l" style={{ "--delay": `${i * 70}ms` } as React.CSSProperties}><span className="font-mono text-xs text-[#f0ba00]">0{i + 1}</span><p className="mt-8 max-w-[120px] text-sm font-medium leading-5">{step}</p></div>)}</div></div></div></section>

      <section ref={trustRef} id="trust" className="trace-trust-section trace-story-accountability trace-video-scene px-6 py-20 sm:px-10 lg:px-12 lg:py-28"><div className="trace-scene-sticky"><video ref={trustVideoRef} className="trace-section-video" muted playsInline preload="auto" poster="/trace-story-accountability.png" aria-hidden="true"><source src="/trace-accountability.mp4" type="video/mp4" /></video><div className="trace-section-video-shade absolute inset-0" /><div className="relative z-10 mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center" data-reveal><div><p className="trace-kicker-dark">BUILT FOR ACCOUNTABILITY</p><h2 className="trace-section-title mt-5">Every decision<br /><span>explains itself.</span></h2><p className="mt-7 max-w-md text-base leading-7 text-[#54717a]">See the candidates, constraints, cost, reasoning, and exact action that followed. Every important step is hash-linked into an audit chain.</p><button onClick={openModal} className="trace-dark-pill mt-9">Explore a decision <span>↗</span></button></div><DecisionCard /></div></div></section>
      <footer className="flex flex-col justify-between gap-4 bg-[#073847] px-6 py-8 text-sm text-white/70 sm:flex-row sm:items-center sm:px-10 lg:px-12"><span className="trace-logo text-white">TRACE<span>.</span></span><span>Supply-chain disruption control for manufacturing teams · 2026</span><span className="text-[#f7cc00]">Keep production moving ↗</span></footer>
      {modalOpen && <InjectDisruptionModal onClose={() => setModalOpen(false)} onInjected={() => setModalOpen(false)} />}
    </main>
  );
}

function ControlCard({ icon, title, text }: { icon: string; title: string; text: string }) { return <article className="trace-control-card trace-stagger" style={{ "--delay": `${(Number(icon) - 1) * 90}ms` } as React.CSSProperties} data-reveal><span className="font-mono text-xs text-[#f0ba00]">{icon}</span><h3 className="mt-12 text-2xl font-medium tracking-[-0.04em]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#54717a]">{text}</p><span className="mt-8 block h-px w-14 bg-[#f0ba00]" /></article>; }

function DecisionCard() { return <div className="trace-decision-card"><div className="flex items-start justify-between gap-4 border-b border-[#d5cdbc] pb-5"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[#54717a]">Decision brief · PROD-882</p><h3 className="mt-3 text-2xl font-medium">Recovery plan ready</h3></div><span className="rounded-full bg-[#dff3d6] px-3 py-1.5 font-mono text-[10px] uppercase text-[#2c7543]">Auto-executed</span></div><div className="grid gap-8 py-7 sm:grid-cols-2"><div><p className="trace-label">Selected plan</p><p className="mt-2 font-mono text-4xl">$41,850</p><p className="mt-1 text-sm text-[#54717a]">310 units · 6-day max lead</p></div><div className="border-l-2 border-[#f0ba00] pl-5"><p className="trace-label">Agent reasoning</p><p className="mt-2 text-sm leading-6 text-[#54717a]">Split across SUP-42 and SUP-37 to cover the shortfall while preserving the production deadline.</p></div></div><div className="grid gap-3 border-t border-[#d5cdbc] pt-5 text-sm text-[#54717a] sm:grid-cols-2"><span>✓ MOQ satisfied</span><span>✓ Quality threshold passed</span><span>✓ Deadline protected</span><span>✓ Approval limit within range</span></div></div>; }

"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  image?: string;
  children: ReactNode;
};

export function TraceInternalShell({ eyebrow, title, description, image = "/trace-story-signal.png", children }: Props) {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-depth]"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    }, { threshold: 0.08 });
    nodes.forEach((node) => observer.observe(node));
    const onScroll = () => document.documentElement.style.setProperty("--trace-page-shift", `${Math.min(window.scrollY * 0.12, 72)}px`);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.documentElement.style.removeProperty("--trace-page-shift");
    };
  }, []);

  return (
    <main className="trace-internal min-h-screen bg-[#f4eddf] text-[#073847]">
      <header className="trace-internal-nav"><Link href="/" className="trace-logo text-[#073847]">TRACE<span>.</span></Link><nav><Link href="/#control">Control</Link><Link href="/#flow">How it works</Link><Link href="/#trust">Trust</Link></nav><Link href="/" className="trace-dark-pill trace-dark-pill-small">Back to site <span>↗</span></Link></header>
      <section className="trace-internal-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,56,71,.92), rgba(7,56,71,.55)), url('${image}')` }}>
        <div className="trace-internal-hero-copy" data-depth="0"><p className="trace-kicker">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>
      </section>
      <div className="trace-stage mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:px-12">{children}</div>
    </main>
  );
}

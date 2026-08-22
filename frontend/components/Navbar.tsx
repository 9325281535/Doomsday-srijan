"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarProps {
  onInjectClick?: () => void;
  pendingCount?: number;
}

export function Navbar({ onInjectClick, pendingCount = 0 }: NavbarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/trust", label: "Trust Fabric" },
    { href: "/audit", label: "Audit" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/approvals", label: "Approvals", badge: pendingCount },
  ];

  return (
    <div className="fixed top-5 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto flex items-center justify-between gap-4 sm:gap-6 px-6 py-2.5 bg-[#0E121A]/85 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.6)] w-full max-w-5xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="font-display text-lg font-black tracking-wider text-[#F5A623] uppercase">
            SENTINEL
          </span>
          <span className="hidden md:inline-block font-mono text-[11px] text-[#8B93A1] border-l border-white/10 pl-2.5">
            TRUST FABRIC
          </span>
        </Link>

        {/* Dynamic Nav Items */}
        <div className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                  isActive
                    ? "bg-white/15 text-white border border-white/15 shadow-sm font-semibold"
                    : "text-[#8B93A1] hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className={`h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive ? "bg-[#F5A623] text-black" : "bg-[#F5A623] text-black"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Action button */}
        <div>
          {onInjectClick ? (
            <button
              onClick={onInjectClick}
              className="rounded-full bg-[#F5A623] hover:bg-[#E09010] px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-black transition-all shadow-[0_2px_15px_rgba(245,166,35,0.3)] hover:scale-105"
            >
              + Inject Event
            </button>
          ) : (
            <Link
              href="/"
              className="rounded-full bg-[#F5A623] hover:bg-[#E09010] px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-black transition-all shadow-[0_2px_15px_rgba(245,166,35,0.3)] inline-block"
            >
              + Inject Event
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}

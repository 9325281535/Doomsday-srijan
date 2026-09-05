import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trace — Supply Chain Disruption Control Agent",
  description: "Hackers Occupied Pune 2026 — Agentic AI Track",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className="font-body bg-canvas text-text-primary min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}

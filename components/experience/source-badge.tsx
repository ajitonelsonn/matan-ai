"use client";

import { Sparkles, Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SourceKind = "demo" | "ring" | "ring-expiring" | "ring-expired";

const config: Record<SourceKind, { icon: React.ReactNode; label: string; short: string; cls: string }> = {
  demo: { icon: <Sparkles />, label: "DEMO · MOCK DATA", short: "DEMO", cls: "bg-purple/12 text-purple border-purple/30" },
  ring: { icon: <span className="inline-block size-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" aria-hidden />, label: "REAL · RING SIMULATOR", short: "RING SIMULATOR", cls: "bg-primary/12 text-primary border-primary/30" },
  "ring-expiring": { icon: <Clock />, label: "REAL · SESSION EXPIRING", short: "EXPIRING", cls: "bg-warning/12 text-warning border-warning/30" },
  "ring-expired": { icon: <Lock />, label: "REAL · SESSION EXPIRED", short: "SESSION EXPIRED", cls: "bg-danger/12 text-danger border-danger/30" },
};

/**
 * The one place data-source labels are rendered.
 * ✨ DEMO · MOCK DATA  ·  ◉ REAL · RING SIMULATOR  ·  🔒 REAL · SESSION EXPIRED
 */
export function SourceBadge({ source, size = "sm", short, className, title }: { source: SourceKind; size?: "xs" | "sm" | "md"; short?: boolean; className?: string; title?: string }) {
  const c = config[source];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-[0.08em] whitespace-nowrap [&>svg]:size-3",
        size === "xs" ? "h-5 px-2 text-[9.5px]" : size === "sm" ? "h-6 px-2.5 text-[10.5px]" : "h-7 px-3 text-[11.5px] [&>svg]:size-3.5",
        c.cls,
        className,
      )}
      title={title ?? (source === "demo" ? "Simulated data - no Ring connection required" : "Data from the Ring Developer Playground simulator")}
    >
      {c.icon}
      {short ? c.short : c.label}
    </span>
  );
}

/** Tiny "DEMO" corner marker for mock device/event cards. */
export function DemoMarker({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-4 items-center rounded-[5px] border border-purple/30 bg-purple/15 px-1.5 text-[9px] font-bold uppercase tracking-wider text-purple", className)} title="Simulated demo data">
      Demo
    </span>
  );
}

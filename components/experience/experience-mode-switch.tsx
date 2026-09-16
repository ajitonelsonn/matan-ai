"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useExperience } from "./experience-provider";

/**
 * Global Demo / Real switch. Desktop: [ ✨ Demo Mode ] [ ◉ Real Mode ]  ·  Mobile: [ D ] [ R ].
 * Preserves the current route; entering Real Mode checks the Ring session first.
 */
export function ExperienceModeSwitch({ compact, className }: { compact?: boolean; className?: string }) {
  const { mode, switchMode, ring } = useExperience();
  const active = mode ?? "demo";
  const ringDot = ring.state === "connected" ? "bg-success" : ring.state === "expiring" ? "bg-warning" : ring.state === "expired" || ring.state === "invalid" ? "bg-danger" : "bg-text-3";

  const item = (value: "demo" | "ring", label: string, short: string, icon: React.ReactNode) => {
    const isActive = active === value;
    return (
      <button
        key={value}
        type="button"
        role="radio"
        aria-checked={isActive}
        aria-current={isActive ? "true" : undefined}
        aria-label={`${label}${value === "ring" ? ` (Ring session ${ring.state.replace("_", " ")})` : ""}`}
        onClick={() => switchMode(value)}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-[10px] font-semibold transition-[background-color,color,box-shadow] duration-150 [&>svg]:size-4",
          compact ? "h-8 w-9 justify-center text-[13px]" : "h-9 px-3 text-[13px]",
          isActive
            ? value === "demo"
              ? "bg-gradient-to-b from-purple to-[#7f5cff] text-white shadow-[0_6px_18px_rgba(154,113,255,0.35)]"
              : "bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_6px_18px_rgba(18,168,255,0.35)]"
            : "text-text-2 hover:bg-surface-3 hover:text-text",
        )}
      >
        {value === "demo" ? icon : <span className={cn("inline-block size-2.5 rounded-full ring-2 ring-white/20", isActive ? "bg-white" : ringDot)} aria-hidden />}
        <span className={compact ? "sr-only" : ""}>{label}</span>
        {compact && <span aria-hidden>{short}</span>}
      </button>
    );
  };

  return (
    <div role="radiogroup" aria-label="Experience mode" className={cn("inline-flex items-center rounded-control border border-border bg-surface-2/80 p-0.5", className)}>
      {item("demo", "Demo Mode", "D", <Sparkles />)}
      {item("ring", "Real Mode", "R", null)}
    </div>
  );
}

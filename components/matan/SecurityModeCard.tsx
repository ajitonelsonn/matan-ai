"use client";

import * as React from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import type { SecurityMode } from "@/lib/types";

const gradients: Record<string, string> = {
  primary: "from-primary/35 via-primary/10 to-transparent",
  cyan: "from-cyan/30 via-cyan/8 to-transparent",
  purple: "from-purple/35 via-purple/10 to-transparent",
  danger: "from-danger/30 via-danger/8 to-transparent",
  success: "from-success/30 via-success/8 to-transparent",
  warning: "from-warning/30 via-warning/8 to-transparent",
};

/** Illustrative icon panel — a gradient stage with the mode glyph. */
export function ModeIllustration({ mode, className, size = "md" }: { mode: Pick<SecurityMode, "icon" | "tone">; className?: string; size?: "sm" | "md" }) {
  const t = toneStyles[mode.tone as Tone];
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-bg/50", size === "md" ? "aspect-[4/3]" : "size-12", className)}>
      <div className={cn("absolute inset-0 bg-gradient-to-b", gradients[mode.tone])} aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("inline-flex items-center justify-center rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.35)]", size === "md" ? "size-16 [&>svg]:size-8" : "size-8 [&>svg]:size-4 rounded-lg", t.bg, t.border, t.text)}>
          <Icon name={mode.icon} />
        </span>
      </div>
    </div>
  );
}

export function SecurityModeCard({ mode, active, onActivate, onCustomize, busy, className }: { mode: SecurityMode; active: boolean; onActivate: () => void; onCustomize: () => void; busy?: boolean; className?: string }) {
  return (
    <article className={cn("card flex flex-col p-3.5 transition-[border-color,box-shadow] duration-200", active && "border-primary/60 glow-strong", className)} aria-current={active ? "true" : undefined}>
      <ModeIllustration mode={mode} />
      <h3 className="mt-3.5 text-[17px] font-semibold text-text">{mode.name}</h3>
      <p className="mt-1 flex-1 text-[13px] leading-snug text-text-2">{mode.tagline}</p>
      <div className="mt-3.5">
        {active ? (
          <div className="inline-flex h-10.5 w-full items-center justify-center gap-2 rounded-control bg-gradient-to-b from-success to-[#0fbf85] text-sm font-semibold text-bg shadow-[0_6px_20px_rgba(22,223,155,0.3)]" aria-label={`${mode.name} is active`}>
            <CircleCheck className="size-4" />
            Active
          </div>
        ) : (
          <Button variant="secondary" fullWidth onClick={onActivate} loading={busy}>
            Activate
          </Button>
        )}
      </div>
      <button type="button" onClick={onCustomize} className="mt-2.5 inline-flex items-center justify-center gap-1 text-[13px] font-semibold text-primary hover:text-primary-2 transition-colors">
        Customize
        <ArrowRight className="size-3.5" aria-hidden />
      </button>
    </article>
  );
}

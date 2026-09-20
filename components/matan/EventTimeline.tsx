"use client";

import * as React from "react";
import { Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { timelineSteps, type StepState } from "@/lib/matan/event-state";
import { formatTimeWithSeconds } from "@/lib/utils/format";
import type { RingEvent } from "@/lib/types";

const dot: Record<StepState, string> = {
  pending: "border-border bg-surface-2 text-text-3",
  active: "border-primary bg-primary/15 text-primary motion-safe:animate-pulse",
  complete: "border-success bg-success/15 text-success",
  failed: "border-danger bg-danger/15 text-danger",
  skipped: "border-border bg-surface-2 text-text-3",
};

/**
 * Compact processing timeline: Ring event received → Snapshot captured → Nova Pro analysis
 * → Matan decision → Notification. States come from the server; timestamps are shown only
 * when the backend actually recorded them.
 */
export function EventTimeline({ event, className }: { event: RingEvent; className?: string }) {
  const steps = timelineSteps(event);
  return (
    <ol className={cn("space-y-0", className)} aria-label="Matan AI processing timeline">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
          {i < steps.length - 1 && <span className={cn("absolute left-[9px] top-5 h-[calc(100%-8px)] w-px", s.state === "complete" ? "bg-success/50" : "bg-border")} aria-hidden />}
          <span className={cn("relative z-10 mt-0.5 inline-flex size-[19px] shrink-0 items-center justify-center rounded-full border text-[10px]", dot[s.state])} aria-hidden>
            {s.state === "complete" ? <Check className="size-3" /> : s.state === "failed" ? <X className="size-3" /> : s.state === "skipped" ? <Minus className="size-3" /> : s.state === "active" ? <span className="size-1.5 rounded-full bg-primary" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className={cn("text-[13px] font-medium", s.state === "pending" ? "text-text-3" : s.state === "failed" ? "text-danger" : "text-text")}>
                {s.label}
                <span className="sr-only">, {s.state}</span>
              </span>
              {s.at && <span className="text-[11.5px] tabular-nums text-text-3">{formatTimeWithSeconds(s.at)}</span>}
            </div>
            {s.note && <p className={cn("text-[12px]", s.state === "failed" ? "text-danger/90" : "text-text-3")}>{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

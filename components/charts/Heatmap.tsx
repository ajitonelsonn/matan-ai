import * as React from "react";
import { cn } from "@/lib/utils/cn";
import type { HeatCell } from "@/lib/types";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const buckets = ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM"];

/** Single-hue sequential heatmap (blue, light→dark) - never a rainbow. */
export function TimeOfDayHeatmap({ cells, className }: { cells: HeatCell[]; className?: string }) {
  const lookup = new Map(cells.map((c) => [`${c.day}-${c.hourBucket}`, c.value]));
  return (
    <div className={cn("w-full", className)}>
      <div className="grid gap-1" style={{ gridTemplateColumns: "52px repeat(7, minmax(0,1fr))" }} role="table" aria-label="Activity by weekday and time of day">
        <div role="row" className="contents">
          <div aria-hidden />
          {days.map((d) => (
            <div key={d} role="columnheader" className="pb-1 text-center text-[11px] text-text-3">
              {d}
            </div>
          ))}
        </div>
        {buckets.map((b, bi) => (
          <div key={b} role="row" className="contents">
            <div role="rowheader" className="flex items-center text-[11px] text-text-3">
              {b}
            </div>
            {days.map((d, di) => {
              const v = lookup.get(`${di}-${bi}`) ?? 0;
              return (
                <div
                  key={d + b}
                  role="cell"
                  className="group relative aspect-[2/1] rounded-[5px] border border-white/[0.03] transition-transform hover:scale-[1.06] hover:z-10"
                  style={{ background: `rgba(18,168,255,${0.06 + v * 0.88})` }}
                  tabIndex={0}
                  aria-label={`${d} ${b}: ${Math.round(v * 100)}% of peak activity`}
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute -top-8 z-20 max-w-[60vw] truncate rounded-md border border-border-strong bg-surface-2/95 px-2 py-1 text-[11px] text-text opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                      di === 0 ? "left-0" : di === days.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    {d} · {b} · {Math.round(v * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-text-3">
        <span>Low</span>
        <div className="h-2.5 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, rgba(18,168,255,0.06), rgba(18,168,255,0.94))" }} aria-hidden />
        <span>High</span>
      </div>
    </div>
  );
}

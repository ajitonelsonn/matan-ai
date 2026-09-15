import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TooltipRow {
  name: string;
  value: React.ReactNode;
  color?: string;
}

/** Shared tooltip body so every chart's hover layer looks the same. */
export function ChartTooltipBody({ title, rows, total, className }: { title?: React.ReactNode; rows: TooltipRow[]; total?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-[150px] rounded-xl border border-border-strong bg-surface-2/95 p-3 text-xs shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl", className)}>
      {title && <p className="mb-2 text-[13px] font-semibold text-text">{title}</p>}
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-text-2">
              {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />}
              {r.name}
            </span>
            <span className="font-semibold tabular-nums text-text">{r.value}</span>
          </li>
        ))}
      </ul>
      {total !== undefined && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-text-2">Total</span>
          <span className="font-semibold tabular-nums text-text">{total}</span>
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ items, className }: { items: { name: string; color: string }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-2", className)} aria-label="Legend">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.name}
        </li>
      ))}
    </ul>
  );
}

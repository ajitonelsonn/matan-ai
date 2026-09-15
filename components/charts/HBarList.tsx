import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { toneStyles, type Tone } from "@/lib/utils/tones";

export interface HBarRow {
  key: string;
  label: string;
  count: number;
  icon?: string;
  tone?: string;
}

/** Horizontal bar list — magnitude with a direct label on every row. */
export function HBarList({ rows, className }: { rows: HBarRow[]; className?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className={cn("space-y-3", className)}>
      {rows.map((r) => {
        const t = toneStyles[(r.tone as Tone) ?? "primary"];
        return (
          <li key={r.key} className="group grid grid-cols-[minmax(0,120px)_1fr_36px] items-center gap-3">
            <span className="flex items-center gap-2 text-[13.5px] text-text-2 truncate">
              {r.icon && <Icon name={r.icon} className={cn("size-4 shrink-0", t.text)} />}
              {r.label}
            </span>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${r.label}: ${r.count}`}>
              <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", t.dot)} style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <span className="text-right text-[13.5px] font-semibold tabular-nums text-text">{r.count}</span>
          </li>
        );
      })}
    </ul>
  );
}

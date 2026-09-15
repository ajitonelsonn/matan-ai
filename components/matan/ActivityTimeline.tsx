import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";

export interface TimelineItem {
  id: string;
  time: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

/** Vertical dotted timeline used for event steps, family activity, mode history. */
export function ActivityTimeline({ items, className, compact }: { items: TimelineItem[]; className?: string; compact?: boolean }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, idx) => {
        const t = toneStyles[item.tone ?? "primary"];
        const last = idx === items.length - 1;
        return (
          <li key={item.id} className={cn("relative flex gap-3", compact ? "pb-3" : "pb-4", last && "pb-0")}>
            <div className={cn("flex shrink-0 items-start justify-end pt-0.5 text-right text-[12.5px] tabular-nums text-text-3 leading-tight whitespace-pre-line", compact ? "w-[58px]" : "w-[74px]")}>{item.time}</div>
            <div className="relative flex w-4 shrink-0 justify-center">
              {!last && <span className="absolute top-3 bottom-[-4px] w-px bg-border" aria-hidden />}
              <span className={cn("relative mt-1.5 size-2.5 rounded-full ring-4 ring-surface", t.dot)} aria-hidden />
            </div>
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {item.icon && <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-4", t.bg, t.border, t.text)}>{item.icon}</span>}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-text leading-snug">{item.title}</p>
                {item.subtitle && <p className="text-[12.5px] text-text-3 leading-snug">{item.subtitle}</p>}
              </div>
              {item.trailing}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

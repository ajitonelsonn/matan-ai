import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";

export function TrendDelta({ value, suffix = "", invert, className }: { value: number; suffix?: string; invert?: boolean; className?: string }) {
  if (!Number.isFinite(value)) return null;
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold tabular-nums", value === 0 ? "text-text-3" : good ? "text-success" : "text-danger", className)}>
      {value !== 0 && <Icon className="size-3.5" aria-hidden />}
      {value > 0 ? "+" : ""}
      {value}%{suffix}
    </span>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  delta,
  deltaLabel,
  invertDelta,
  tone = "primary",
  className,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  invertDelta?: boolean;
  tone?: Tone;
  className?: string;
  compact?: boolean;
}) {
  const t = toneStyles[tone];
  return (
    <div className={cn("card flex items-center gap-4", compact ? "p-4" : "p-5", className)}>
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-2xl border [&>svg]:size-6", compact ? "size-11" : "size-14", t.bg, t.border, t.text)}>{icon}</span>
      <div className="min-w-0">
        <div className={cn("font-bold tabular-nums text-text leading-none", compact ? "text-2xl" : "text-[28px]")}>{value}</div>
        <div className="mt-1 text-[13px] text-text-2 truncate">{label}</div>
        {typeof delta === "number" && (
          <div className="mt-1 flex items-center gap-1.5">
            <TrendDelta value={delta} invert={invertDelta} />
            {deltaLabel && <span className="text-[11px] text-text-3">{deltaLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact stat tile used in status summaries (e.g. "24 Events analyzed"). */
export function StatTile({ icon, value, label, tone = "primary", className, active, onClick }: { icon: React.ReactNode; value: React.ReactNode; label: string; tone?: Tone; className?: string; active?: boolean; onClick?: () => void }) {
  const t = toneStyles[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "card-inset flex flex-col items-start gap-2 p-4 text-left transition-[border-color,background-color] duration-150",
        onClick && "hover:border-border-strong hover:bg-surface-2/60",
        active && cn("border-2", t.border.replace("/30", "/60")),
        className,
      )}
    >
      <span className={cn("[&>svg]:size-5", t.text)}>{icon}</span>
      <span className="text-[26px] font-bold leading-none tabular-nums text-text">{value}</span>
      <span className={cn("text-xs font-medium", tone === "primary" ? "text-text-2" : t.text)}>{label}</span>
    </Tag>
  );
}

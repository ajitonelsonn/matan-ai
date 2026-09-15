import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";

export function Progress({ value, max = 100, tone = "primary", className, trackClassName, label }: { value: number; max?: number; tone?: Tone; className?: string; trackClassName?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", trackClassName, className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", toneStyles[tone].dot)} style={{ width: `${pct}%` }} />
    </div>
  );
}

const ringHex: Record<Tone, string> = {
  primary: "#12a8ff",
  success: "#16df9b",
  warning: "#ffc34a",
  danger: "#ff4d5e",
  purple: "#9a71ff",
  cyan: "#12e6ff",
  neutral: "#7f95b0",
};

export function ProgressRing({ value, size = 72, stroke = 7, tone = "success", children, className, label }: { value: number; size?: number; stroke?: number; tone?: Tone; children?: React.ReactNode; className?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(pct)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(53,154,255,0.15)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringHex[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

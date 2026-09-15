import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";

export function StatusDot({ tone = "success", pulse, size = "md", className, label }: { tone?: Tone; pulse?: boolean; size?: "sm" | "md" | "lg"; className?: string; label?: string }) {
  const s = size === "sm" ? "size-1.5" : size === "lg" ? "size-3" : "size-2";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("inline-block rounded-full shrink-0", s, toneStyles[tone].dot, pulse && "animate-pulse-dot")} aria-hidden />
      {label && <span className={cn("text-xs font-medium", toneStyles[tone].text)}>{label}</span>}
    </span>
  );
}

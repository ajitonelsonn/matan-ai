import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";

/** "Ring" source pill - identifies the device/event source. */
export function RingBadge({ className, size = "sm" }: { className?: string; size?: "xs" | "sm" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[#1e6ee0]/90 font-bold tracking-tight text-white shadow-[0_4px_12px_rgba(30,110,224,0.4)]",
        size === "xs" ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]",
        className,
      )}
      title="Ring device (demo data)"
    >
      ring
    </span>
  );
}

export function LiveBadge({ className, label = "Live", pulse = true }: { className?: string; label?: string; pulse?: boolean }) {
  return (
    <Badge tone="success" variant="soft" size="sm" className={cn("bg-bg/60 backdrop-blur-md border-success/40", className)}>
      <span className={cn("size-1.5 rounded-full bg-success", pulse && "animate-pulse-dot")} aria-hidden />
      {label}
    </Badge>
  );
}

export function NovaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/10 px-3 py-1.5", className)}>
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple to-primary text-white">
        <Sparkles className="size-3.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[10px] text-text-3">Powered by</span>
        <span className="block text-[13px] font-semibold text-text">Amazon Nova</span>
      </span>
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="neutral" size="xs" className={cn("border-dashed", className)} title="This preview uses mock data. No live Ring or AWS connection.">
      Demo data
    </Badge>
  );
}

/** Matan robot mark used for assistant messages. */
export function MatanBot({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-2 to-primary text-white shadow-[0_6px_20px_rgba(18,168,255,0.4)]", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="16" height="11" rx="3" />
        <path d="M12 8V5M9 5h6" />
        <circle cx="9" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
        <path d="M9.5 16.5c1.5 1 3.5 1 5 0" />
      </svg>
    </span>
  );
}

import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Home protection status pill shown in page headers. Reflects the active security mode + open important events. */
export function ProtectionPill({ modeName, level = "protected", className }: { modeName?: string; level?: "protected" | "review" | "alert"; className?: string }) {
  const map = {
    protected: { Icon: ShieldCheck, text: "text-success", bg: "bg-success/10 border-success/30", title: "Home is protected", sub: "All systems active" },
    review: { Icon: Shield, text: "text-warning", bg: "bg-warning/10 border-warning/30", title: "Protected · 1 to review", sub: "All systems active" },
    alert: { Icon: ShieldAlert, text: "text-danger", bg: "bg-danger/10 border-danger/30", title: "Attention needed", sub: "Review recommended" },
  } as const;
  const m = map[level];
  return (
    <div className={cn("inline-flex h-[52px] items-center gap-3 rounded-2xl border px-4", m.bg, className)}>
      <span className={cn("inline-flex size-8 items-center justify-center rounded-lg", m.text, "bg-bg/40")}>
        <m.Icon className="size-[18px]" />
      </span>
      <span className="leading-tight">
        <span className={cn("block text-[14.5px] font-semibold", m.text)}>{m.title}</span>
        <span className="block text-[11.5px] text-text-3">{modeName ? `${modeName} · ${m.sub}` : m.sub}</span>
      </span>
    </div>
  );
}

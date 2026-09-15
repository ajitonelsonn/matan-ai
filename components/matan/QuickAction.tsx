"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";

/** Tile-style action button used in "Quick Actions" panels. */
export function QuickAction({
  icon,
  label,
  description,
  onClick,
  href,
  primary,
  tone = "primary",
  className,
  loading,
  layout = "tile",
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
  tone?: Tone;
  className?: string;
  loading?: boolean;
  layout?: "tile" | "row";
}) {
  const t = toneStyles[tone];
  const classes = cn(
    "group flex items-center gap-3 rounded-[14px] border text-left transition-[background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px",
    layout === "tile" ? "px-4 py-3.5" : "px-3.5 py-3 w-full",
    primary
      ? "border-primary/60 bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_8px_24px_rgba(18,168,255,0.3)] hover:shadow-[0_10px_30px_rgba(18,168,255,0.4)]"
      : "card-inset hover:border-border-strong hover:bg-surface-2/70",
    loading && "opacity-70 pointer-events-none",
    className,
  );
  const inner = (
    <>
      <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-[18px]", primary ? "border-white/20 bg-white/15 text-white" : cn(t.bg, t.border, t.text))}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14px] font-semibold leading-snug", primary ? "text-white" : "text-text")}>{label}</span>
        {description && <span className={cn("block text-[12px] leading-snug", primary ? "text-white/80" : "text-text-3")}>{description}</span>}
      </span>
      {layout === "row" && <ChevronRight className={cn("size-4 shrink-0 transition-transform group-hover:translate-x-0.5", primary ? "text-white/80" : "text-text-3")} aria-hidden />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} aria-busy={loading}>
      {inner}
    </button>
  );
}

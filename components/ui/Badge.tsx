import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: "soft" | "solid" | "outline";
  size?: "xs" | "sm" | "md";
  icon?: React.ReactNode;
  dot?: boolean;
  uppercase?: boolean;
}

const sizes = { xs: "h-5 px-2 text-[10px] gap-1", sm: "h-6 px-2.5 text-[11px] gap-1.5", md: "h-7 px-3 text-xs gap-1.5" };

export function Badge({ tone = "neutral", variant = "soft", size = "sm", icon, dot, uppercase, className, children, ...props }: BadgeProps) {
  const t = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap",
        sizes[size],
        uppercase && "tracking-wide uppercase",
        variant === "soft" && cn(t.bg, t.text, "border", t.border),
        variant === "solid" && cn(t.solid, "shadow-[0_4px_14px_rgba(0,0,0,0.25)]"),
        variant === "outline" && cn("bg-transparent border", t.border, t.text),
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", variant === "solid" ? "bg-current opacity-80" : t.dot)} aria-hidden />}
      {icon}
      {children}
    </span>
  );
}

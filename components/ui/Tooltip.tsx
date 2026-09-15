import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** CSS-only tooltip shown on hover and keyboard focus. */
export function Tooltip({ content, children, side = "top", className }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom"; className?: string }) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-strong bg-surface-2/95 px-2.5 py-1.5 text-xs font-medium text-text shadow-[0_10px_30px_rgba(0,0,0,0.4)] opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
      </span>
    </span>
  );
}

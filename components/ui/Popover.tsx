"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight anchored popover used by Select, Menu and filter panels.
 * Closes on outside click and Escape; returns focus to the trigger.
 */
export function usePopover() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, rootRef, triggerRef };
}

export function PopoverPanel({
  open,
  align = "start",
  className,
  children,
  width,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { open: boolean; align?: "start" | "end"; width?: string }) {
  if (!open) return null;
  return (
    <div
      className={cn(
        "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-[14px] border border-border-strong bg-surface-2/95 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-scale-in origin-top",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
      style={width ? { width } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

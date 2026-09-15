"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
  className?: string;
  id?: string;
}

export function Toggle({ checked, onChange, disabled, label, size = "md", className, id }: ToggleProps) {
  const dims = size === "sm" ? { track: "h-5 w-9", thumb: "size-4", travel: "translate-x-4" } : { track: "h-6 w-11", thumb: "size-5", travel: "translate-x-5" };
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        dims.track,
        checked
          ? "bg-gradient-to-r from-primary to-primary-2 border-primary/50 shadow-[0_0_0_1px_rgba(18,168,255,0.25),0_4px_14px_rgba(18,168,255,0.35)]"
          : "bg-surface-3 border-border hover:border-border-strong",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-out translate-x-0.5",
          dims.thumb,
          checked && dims.travel,
        )}
        aria-hidden
      />
    </button>
  );
}

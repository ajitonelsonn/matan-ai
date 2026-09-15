"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  variant?: "pills" | "segmented";
  className?: string;
  "aria-label"?: string;
}

/** Dark rounded pill tabs; the selected tab is filled blue. Keyboard: arrows/Home/End. */
export function Tabs<T extends string>({ items, value, onChange, size = "md", variant = "pills", className, ...rest }: TabsProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const last = items.length - 1;
    let next = idx;
    if (e.key === "ArrowRight") next = idx === last ? 0 : idx + 1;
    else if (e.key === "ArrowLeft") next = idx === 0 ? last : idx - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full",
        variant === "segmented" && "rounded-control bg-bg/60 border border-border p-1 gap-1 w-fit",
        className,
      )}
    >
      {items.map((item, idx) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap transition-[background-color,color,border-color,box-shadow] duration-150",
              size === "sm" ? "h-8 px-3 text-xs rounded-[9px]" : "h-10 px-4 text-[13px] rounded-control",
              variant === "pills" && "border",
              active
                ? "bg-gradient-to-b from-primary-2 to-primary text-white border-primary/60 shadow-[0_6px_18px_rgba(18,168,255,0.3)]"
                : variant === "pills"
                  ? "bg-surface-2/70 text-text-2 border-border hover:text-text hover:bg-surface-3 hover:border-border-strong"
                  : "text-text-2 hover:text-text hover:bg-surface-3/70",
            )}
          >
            {item.icon && <span className={cn("[&>svg]:size-4", active ? "text-white" : "text-primary")}>{item.icon}</span>}
            {item.label}
            {typeof item.count === "number" && (
              <span className={cn("text-[11px] font-semibold tabular-nums", active ? "text-white/85" : "text-text-3")}>({item.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

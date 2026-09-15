"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PopoverPanel, usePopover } from "./Popover";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface SelectProps<T extends string> {
  value: T | null;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  label?: string;
  prefix?: string;
  size?: "sm" | "md";
  className?: string;
  buttonClassName?: string;
  align?: "start" | "end";
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  label,
  prefix,
  size = "md",
  className,
  buttonClassName,
  align = "start",
  disabled,
  fullWidth,
}: SelectProps<T>) {
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const listId = React.useId();
  const selectedIdx = options.findIndex((o) => o.value === value);
  const [activeIdx, setActiveIdx] = React.useState(Math.max(0, selectedIdx));
  const selected = options[selectedIdx];

  React.useEffect(() => {
    if (open) setActiveIdx(Math.max(0, selectedIdx));
  }, [open, selectedIdx]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[activeIdx];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", fullWidth && "w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-control border border-border bg-surface-2/80 text-left text-text transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed",
          open && "border-primary/50 shadow-[0_0_0_3px_rgba(18,168,255,0.15)]",
          size === "sm" ? "h-9 px-3 text-[13px]" : "h-10.5 px-3.5 text-sm",
          fullWidth && "w-full",
          buttonClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {prefix && <span className="text-text-3 font-normal">{prefix}</span>}
          {selected?.icon && <span className="text-primary [&>svg]:size-4">{selected.icon}</span>}
          <span className={cn("truncate font-medium", !selected && "text-text-3 font-normal")}>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-text-3 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      <PopoverPanel open={open} align={align} className={cn("max-h-72 overflow-y-auto", fullWidth && "w-full")} role="listbox" id={listId} aria-activedescendant={`${listId}-${activeIdx}`}>
        {options.map((opt, idx) => {
          const isSelected = opt.value === value;
          const isActive = idx === activeIdx;
          return (
            <button
              key={opt.value}
              id={`${listId}-${idx}`}
              role="option"
              aria-selected={isSelected}
              type="button"
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm transition-colors",
                isActive ? "bg-primary/14 text-text" : "text-text-2",
                isSelected && "text-primary",
              )}
            >
              {opt.icon && <span className="[&>svg]:size-4 text-primary">{opt.icon}</span>}
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium">{opt.label}</span>
                {opt.description && <span className="block text-xs text-text-3">{opt.description}</span>}
              </span>
              {isSelected && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          );
        })}
      </PopoverPanel>
    </div>
  );
}

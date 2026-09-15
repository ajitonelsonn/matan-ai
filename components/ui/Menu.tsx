"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PopoverPanel, usePopover } from "./Popover";
import { IconButton } from "./IconButton";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  description?: string;
}

export interface MenuProps {
  items: (MenuItem | "separator")[];
  trigger?: React.ReactElement<{ onClick?: () => void; "aria-expanded"?: boolean; ref?: React.Ref<HTMLButtonElement> }>;
  align?: "start" | "end";
  label?: string;
  className?: string;
  triggerSize?: "sm" | "md" | "lg";
  triggerVariant?: React.ComponentProps<typeof IconButton>["variant"];
  width?: string;
}

/** Dropdown menu. Default trigger is a "More" icon button. */
export function Menu({ items, trigger, align = "end", label = "More options", className, triggerSize = "md", triggerVariant = "outline", width }: MenuProps) {
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  React.useEffect(() => {
    if (open) {
      const first = itemRefs.current.find(Boolean);
      requestAnimationFrame(() => first?.focus());
    }
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const idx = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      enabled[(idx + 1) % enabled.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      enabled[(idx - 1 + enabled.length) % enabled.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const triggerEl = trigger ? (
    React.cloneElement(trigger, {
      ref: triggerRef,
      onClick: () => setOpen((o) => !o),
      "aria-expanded": open,
    })
  ) : (
    <IconButton ref={triggerRef} label={label} size={triggerSize} variant={triggerVariant} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
      <MoreHorizontal />
    </IconButton>
  );

  let refIdx = 0;
  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      {triggerEl}
      <PopoverPanel open={open} align={align} role="menu" onKeyDown={onKeyDown} width={width} className="top-full">
        {items.map((item, i) => {
          if (item === "separator") return <div key={`sep-${i}`} className="my-1 h-px bg-border" role="separator" />;
          const idx = refIdx++;
          return (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm transition-colors focus:outline-none",
                item.tone === "danger" ? "text-danger hover:bg-danger/12 focus:bg-danger/12" : "text-text-2 hover:bg-primary/14 hover:text-text focus:bg-primary/14 focus:text-text",
                item.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
              )}
            >
              {item.icon && <span className={cn("[&>svg]:size-4", item.tone === "danger" ? "text-danger" : "text-primary")}>{item.icon}</span>}
              <span className="flex-1">
                <span className="block font-medium">{item.label}</span>
                {item.description && <span className="block text-xs text-text-3">{item.description}</span>}
              </span>
            </button>
          );
        })}
      </PopoverPanel>
    </div>
  );
}

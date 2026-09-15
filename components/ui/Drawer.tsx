"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "./IconButton";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  side?: "left" | "right";
  width?: string;
  className?: string;
  footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, description, children, side = "right", width = "max-w-md", className, footer }: DrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  const titleId = React.useId();
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="presentation">
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "absolute inset-y-0 flex w-full flex-col border-border bg-surface shadow-[0_0_80px_rgba(0,0,0,0.5)]",
          width,
          side === "right" ? "right-0 border-l animate-[drawer-in-right_220ms_ease-out]" : "left-0 border-r animate-[drawer-in-left_220ms_ease-out]",
          className,
        )}
      >
        {(title || description) && (
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id={titleId} className="text-base font-semibold text-text">
                  {title}
                </h2>
              )}
              {description && <p className="mt-0.5 text-sm text-text-3">{description}</p>}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="border-t border-border px-5 py-4">{footer}</footer>}
      </aside>
      <style>{`@keyframes drawer-in-right{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}@keyframes drawer-in-left{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </div>,
    document.body,
  );
}

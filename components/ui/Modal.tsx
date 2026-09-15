"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "./IconButton";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  hideClose?: boolean;
}

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

function useLockBody(open: boolean) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function Modal({ open, onClose, title, description, children, footer, size = "md", icon, tone = "default", hideClose }: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useLockBody(open);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panelRef.current?.querySelector<HTMLElement>("button, input, textarea");
      el?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          "relative w-full card-hero p-6 animate-scale-in max-h-[calc(100dvh-2rem)] overflow-y-auto",
          sizes[size],
          tone === "danger" && "border-danger/30 glow-danger",
        )}
      >
        {(title || !hideClose) && (
          <div className="mb-4 flex items-start gap-3">
            {icon && (
              <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-5", tone === "danger" ? "bg-danger/12 border-danger/25 text-danger" : "bg-primary/12 border-primary/25 text-primary")}>
                {icon}
              </span>
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold text-text leading-tight">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-sm text-text-3 leading-relaxed">{description}</p>}
            </div>
            {!hideClose && (
              <IconButton label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1">
                <X />
              </IconButton>
            )}
          </div>
        )}
        {children}
        {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

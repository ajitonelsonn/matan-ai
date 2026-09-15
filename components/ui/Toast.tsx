"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CircleCheck, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  push: (t: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title?: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const icons: Record<ToastTone, React.ReactNode> = {
  success: <CircleCheck className="size-[18px] text-success" />,
  error: <TriangleAlert className="size-[18px] text-danger" />,
  info: <Info className="size-[18px] text-primary" />,
  warning: <CircleAlert className="size-[18px] text-warning" />,
};

const accents: Record<ToastTone, string> = {
  success: "border-success/35",
  error: "border-danger/35",
  info: "border-primary/35",
  warning: "border-warning/35",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.tone === "error" ? 5000 : 3600);
    },
    [dismiss],
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) => push({ tone: "success", title, description }),
      error: (title = "Unable to complete action. Try again.", description) => push({ tone: "error", title, description }),
      info: (title, description) => push({ tone: "info", title, description }),
      warning: (title, description) => push({ tone: "warning", title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="false">
            {items.map((t) => (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "pointer-events-auto flex items-start gap-3 rounded-[14px] border bg-surface-2/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-fade-up",
                  accents[t.tone],
                )}
              >
                <span className="mt-0.5 shrink-0">{icons[t.tone]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text leading-snug">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-text-3 leading-relaxed">{t.description}</p>}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action?.onClick();
                        dismiss(t.id);
                      }}
                      className="mt-1.5 text-xs font-semibold text-primary hover:text-primary-2"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-text-3 hover:bg-surface-3 hover:text-text">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

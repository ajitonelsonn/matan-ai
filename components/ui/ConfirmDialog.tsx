"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  icon?: React.ReactNode;
}

type Resolver = (ok: boolean) => void;

const ConfirmContext = React.createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

/** Promise-based confirmation modal for destructive actions. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ opts: ConfirmOptions; resolve: Resolver } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const confirm = React.useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ opts, resolve })), []);

  const close = (ok: boolean) => {
    if (!state) return;
    setBusy(false);
    state.resolve(ok);
    setState(null);
  };

  const tone = state?.opts.tone ?? "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        size="sm"
        tone={tone}
        icon={state?.opts.icon ?? <TriangleAlert />}
        title={state?.opts.title}
        description={state?.opts.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {state?.opts.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              loading={busy}
              data-autofocus
              onClick={() => {
                setBusy(true);
                close(true);
              }}
            >
              {state?.opts.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

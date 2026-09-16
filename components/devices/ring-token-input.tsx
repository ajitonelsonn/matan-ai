"use client";

import * as React from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/IconButton";

export interface RingTokenInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string | null;
  id?: string;
  autoFocus?: boolean;
}

/**
 * Masked token field. The value lives only in component state until it is
 * POSTed once to the MATAN AI backend - never persisted, logged or put in a URL.
 */
export function RingTokenInput({ value, onChange, disabled, error, id = "ring-token", autoFocus }: RingTokenInputProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-text-2">
        Ring Playground Access Token
      </label>
      <p className="mt-0.5 text-[12.5px] text-text-3">Generate a temporary token from the Ring Developer Playground, then paste it here.</p>
      <div
        className={cn(
          "mt-2 flex items-center gap-1 rounded-control border bg-surface-2/80 pl-3 pr-1 transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgba(18,168,255,0.15)]",
          error ? "border-danger/50" : "border-border hover:border-border-strong",
        )}
      >
        <KeyRound className="size-4 shrink-0 text-text-3" aria-hidden />
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste your temporary Ring Playground token"
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help ${error ? `${id}-error` : ""}`}
          className="h-11 min-w-0 flex-1 bg-transparent font-mono text-[13px] text-text placeholder:font-sans placeholder:text-text-3 outline-none disabled:opacity-60"
        />
        <IconButton label={visible ? "Hide token" : "Show token"} size="sm" onClick={() => setVisible((v) => !v)} aria-pressed={visible} disabled={disabled}>
          {visible ? <EyeOff /> : <Eye />}
        </IconButton>
      </div>
      <p id={`${id}-help`} className="mt-1.5 text-[12px] text-text-3">
        The Playground token expires after 30 minutes. Do not share or commit it.
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12.5px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

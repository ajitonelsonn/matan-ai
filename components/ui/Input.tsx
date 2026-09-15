"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, error, className, children, htmlFor }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-text-2">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-text-3">{hint}</p> : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10.5 w-full rounded-control border border-border bg-surface-2/80 px-3.5 text-sm text-text placeholder:text-text-3 outline-none transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(18,168,255,0.15)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-control border border-border bg-surface-2/80 px-3.5 py-2.5 text-sm text-text placeholder:text-text-3 outline-none transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(18,168,255,0.15)] disabled:opacity-50 resize-y",
        className,
      )}
      {...props}
    />
  );
});

"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({ className, ...props }, ref) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" aria-hidden>
        <Lock className="size-[18px]" />
      </span>
      <Input ref={ref} type={show ? "text" : "password"} {...props} className={cn("h-12 pl-11 pr-12", className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-text-3 transition-colors hover:bg-surface-3 hover:text-primary"
      >
        {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
      </button>
    </div>
  );
});

/** Mirrors the pool's managed password policy so users see problems before Cognito does. */
export function passwordProblems(pw: string) {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("at least 8 characters");
  if (!/[a-z]/.test(pw)) problems.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) problems.push("an uppercase letter");
  if (!/\d/.test(pw)) problems.push("a number");
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push("a symbol");
  return problems;
}

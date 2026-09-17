"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ThemeToggle } from "@/components/experience/theme-toggle";
import { BrandPanel, BrandMobileHeader } from "@/components/brand/BrandPanel";
import { Input } from "@/components/ui/Input";

/**
 * Split-screen frame for the public auth pages: brand photograph on the left,
 * theme toggle + centred glass card on the right. No app shell, no data.
 */
export function AuthLayout({ title, subtitle, children, footer, wide }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <BrandPanel variant="auth" className="min-h-dvh" />

      <div className="relative flex min-h-dvh flex-col overflow-y-auto">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0" style={{ background: "radial-gradient(700px 420px at 80% 0%, var(--matan-body-glow-1), transparent 60%), radial-gradient(600px 400px at 20% 100%, var(--matan-body-glow-2), transparent 60%)" }} aria-hidden />

        <header className="relative flex items-center justify-end px-5 pt-5 sm:px-8 sm:pt-6">
          <ThemeToggle />
        </header>

        <main className="relative mx-auto flex w-full flex-1 flex-col justify-center px-5 py-8 sm:px-8">
          <div className={cn("mx-auto w-full", wide ? "max-w-[520px]" : "max-w-[460px]")}>
            <BrandMobileHeader />
            <section className="relative rounded-[22px] border border-primary/25 bg-surface/85 p-6 shadow-[0_0_0_1px_rgba(18,168,255,0.08),0_30px_80px_-30px_rgba(0,0,0,0.7),0_0_60px_-20px_rgba(18,168,255,0.35)] backdrop-blur-xl sm:p-8" aria-labelledby="auth-title">
              <h1 id="auth-title" className="text-[30px] font-extrabold leading-tight tracking-tight text-text sm:text-[34px]">
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-[15px] text-text-2">{subtitle}</p>}
              <div className="mt-6">{children}</div>
              {footer && (
                <div className="mt-6 border-t border-border pt-5 text-center text-[14.5px] text-text-2">{footer}</div>
              )}
            </section>
          </div>
        </main>

        <footer className="relative flex items-center justify-end gap-2 px-5 pb-5 text-[12.5px] text-text-3 sm:px-8">
          Built for safer homes. <Heart className="size-4 text-primary" aria-hidden />
        </footer>
      </div>
    </div>
  );
}

/** Divider with a centred label ("OR"). */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-text-3" aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
      {label}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border" />
    </div>
  );
}

/** Text input with a leading icon, matching the design's email/lock fields. */
export const IconInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }>(function IconInput({ icon, className, ...props }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3 [&>svg]:size-[18px]" aria-hidden>
        {icon}
      </span>
      <Input ref={ref} {...props} className={cn("h-12 pl-11", className)} />
    </div>
  );
});

/** Inline, non-blocking status banner for auth forms (assertive so screen readers announce errors). */
export function AuthAlert({ title, message, tone = "danger" }: { title: string; message?: string; tone?: "danger" | "success" | "info" }) {
  const cls = tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : tone === "success" ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-[12px] border px-3.5 py-2.5 text-sm ${cls}`}>
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-0.5 text-[13px] opacity-90">{message}</p>}
    </div>
  );
}

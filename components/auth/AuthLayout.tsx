"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/experience/theme-toggle";

/**
 * Shared frame for the public auth pages: Matan branding, theme toggle, a
 * centred card. Renders without the app shell (no sidebar, no dashboard data).
 */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-y-auto bg-bg">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0" style={{ background: "radial-gradient(900px 500px at 50% 10%, var(--matan-body-glow-1), transparent 60%), radial-gradient(700px 400px at 85% 90%, var(--matan-body-glow-2), transparent 60%)" }} aria-hidden />
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle size="sm" />
      </div>
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-14 sm:px-6">
        <Link href="/login" className="flex flex-col items-center text-center" aria-label="Matan AI">
          <Image src="/brand/matan-ai-logo.png" alt="" width={72} height={72} priority className="drop-shadow-[0_10px_30px_rgba(18,168,255,0.45)]" />
          <span className="mt-2 text-[18px] font-extrabold tracking-[0.1em] text-text">MATAN AI</span>
          <span className="text-[12px] text-text-3">Your intelligent eye at home.</span>
        </Link>
        <section className="mt-7 w-full rounded-[20px] border border-border bg-surface/90 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-7" aria-labelledby="auth-title">
          <h1 id="auth-title" className="text-[22px] font-bold leading-tight tracking-tight text-text">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-text-2">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </section>
        {footer && <div className="mt-5 text-center text-sm text-text-2">{footer}</div>}
      </main>
    </div>
  );
}

/** Inline, non-blocking error banner for auth forms (assertive so screen readers announce it). */
export function AuthAlert({ title, message, tone = "danger" }: { title: string; message?: string; tone?: "danger" | "success" | "info" }) {
  const cls = tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : tone === "success" ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-[12px] border px-3.5 py-2.5 text-sm ${cls}`}>
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-0.5 text-[13px] opacity-90">{message}</p>}
    </div>
  );
}

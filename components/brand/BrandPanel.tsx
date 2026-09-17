"use client";

import * as React from "react";
import Image from "next/image";
import { Caveat } from "next/font/google";
import { Eye, Brain, Bell, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const script = Caveat({ subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const brandScriptClass = script.className;

const features = [
  { icon: Eye, title: "See", sub: "What matters" },
  { icon: Brain, title: "Understand", sub: "With AI" },
  { icon: Bell, title: "Be informed", sub: "When it counts" },
  { icon: ShieldCheck, title: "Feel safer", sub: "Every day" },
];

export type BrandVariant = "auth" | "modes";

/**
 * Left-hand brand panel shared by the auth pages and the experience chooser:
 * night-time home photograph with Matan messaging. Always dark (it's a photo),
 * independent of the app theme.
 */
export function BrandPanel({ variant = "auth", className }: { variant?: BrandVariant; className?: string }) {
  const modes = variant === "modes";
  return (
    <aside className={cn("relative isolate hidden overflow-hidden bg-[#031326] text-white lg:flex", className)} aria-hidden>
      <Image src="/brand/hero-night.jpg" alt="" fill priority sizes="60vw" className="object-cover object-[62%_center] opacity-95" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#031326]/95 via-[#031326]/55 to-[#031326]/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#031326]/90 via-transparent to-[#031326]/40" />
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute -bottom-24 left-0 right-0 h-72 opacity-70" style={{ background: "radial-gradient(60% 100% at 30% 100%, rgba(18,168,255,0.35), transparent 70%)" }} />

      <div className="relative flex w-full flex-col justify-between p-10 xl:p-14">
        <div>
          <div className="flex items-center gap-4">
            <Image src="/brand/matan-ai-logo.png" alt="" width={72} height={72} priority className="drop-shadow-[0_10px_30px_rgba(18,168,255,0.5)]" />
            <div>
              <p className="text-[22px] font-extrabold tracking-[0.16em]">MATAN AI</p>
              <p className="text-[13.5px] text-white/70">Your intelligent eye at home.</p>
            </div>
          </div>

          <h2 className="mt-14 max-w-xl text-[42px] font-extrabold leading-[1.05] tracking-tight xl:text-[52px]">
            {modes ? (
              <>
                Safer Homes
                <br />
                <span className="text-primary-2">Smarter</span> Lives
              </>
            ) : (
              <>
                Smarter Awareness.
                <br />
                <span className="text-primary-2">A Safer Tomorrow.</span>
              </>
            )}
          </h2>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/80">
            {modes ? (
              <>
                <span className="font-semibold text-white">AI-powered home awareness</span> that helps you see what matters, understand what&apos;s happening, and focus on what truly counts.
              </>
            ) : (
              <>Matan AI turns your Ring devices into intelligent home awareness — so you can see what matters, understand what&apos;s happening, and focus on what truly counts.</>
            )}
          </p>

          {modes ? (
            <ul className="mt-8 space-y-3">
              {features.map((f) => (
                <li key={f.title} className="flex items-center gap-3.5">
                  <span className="inline-flex size-12 items-center justify-center rounded-full border border-primary/40 bg-primary/12 text-primary-2 shadow-[0_0_24px_rgba(18,168,255,0.25)] backdrop-blur">
                    <f.icon className="size-5" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{f.title}</span>
                    <span className="block text-[13px] text-white/65">{f.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-9 flex flex-wrap gap-7">
              {features.map((f) => (
                <li key={f.title} className="flex flex-col items-start gap-2.5">
                  <span className="inline-flex size-14 items-center justify-center rounded-full border border-primary/40 bg-primary/12 text-primary-2 shadow-[0_0_28px_rgba(18,168,255,0.25)] backdrop-blur">
                    <f.icon className="size-6" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{f.title}</span>
                    <span className="block text-[12.5px] text-white/65">{f.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.32em] text-white/70">{modes ? "Built for a safer tomorrow" : "Powered by AI for a brighter, safer home"}</p>
            <p className={cn(script.className, "mt-3 text-[34px] leading-none text-white/90 -rotate-3 origin-left")}>{modes ? "A more peaceful tomorrow" : "Your home. Your control."}</p>
          </div>
          <p className="hidden items-center gap-2 text-[12.5px] text-white/60 xl:flex">
            <ShieldCheck className="size-4 text-primary-2" /> Privacy by design. Your home. Your control. Our intelligence.
          </p>
        </div>
      </div>
    </aside>
  );
}

/** Compact brand header for small screens where the panel is hidden. */
export function BrandMobileHeader() {
  return (
    <div className="relative mb-6 flex items-center gap-3 lg:hidden">
      <Image src="/brand/matan-ai-logo.png" alt="" width={44} height={44} priority className="drop-shadow-[0_8px_20px_rgba(18,168,255,0.45)]" />
      <div>
        <p className="text-[16px] font-extrabold tracking-[0.14em] text-text">MATAN AI</p>
        <p className="text-[12px] text-text-3">Your intelligent eye at home.</p>
      </div>
    </div>
  );
}

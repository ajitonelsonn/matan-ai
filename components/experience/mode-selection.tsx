"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, ArrowRight, GraduationCap, BookOpen, ChevronRight } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { BrandPanel, BrandMobileHeader, brandScriptClass } from "@/components/brand/BrandPanel";
import { ThemeToggle } from "./theme-toggle";
import { useExperience } from "./experience-provider";

const RING_PLAYGROUND_DOCS = "https://developer.amazon.com/docs/ring/api-documentation.html";

/**
 * Experience chooser (full screen, split layout). Shown once per sign-in,
 * before the dashboard, until the user picks Demo or Real. Theme control top-right.
 */
export function ModeSelection() {
  const { chosen, setMode, openConnect, ring } = useExperience();
  const router = useRouter();
  const scope = React.useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = React.useState(false);

  useGSAP(
    () => {
      if (chosen) return;
      const q = gsap.utils.selector(scope);
      gsap.fromTo(q("[data-hero]"), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", delay: 0.1 });
      gsap.fromTo(q("[data-card]"), { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: 0.12, delay: 0.3 });
    },
    { scope, dependencies: [chosen] },
  );

  if (chosen) return null;

  const ringReady = ring.state === "connected" || ring.state === "expiring";

  const pick = (mode: "demo" | "ring", then?: () => void) => {
    setLeaving(true);
    window.setTimeout(() => {
      if (mode === "demo") setMode("demo");
      else if (ringReady) setMode("ring");
      else openConnect({ thenMode: "ring" }); // Connect Ring modal (z-100) opens above this screen (z-96)
      setLeaving(false);
      then?.();
    }, 180);
  };

  return (
    <div ref={scope} className={cn("fixed inset-0 z-[96] overflow-y-auto bg-bg transition-opacity duration-200 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]", leaving && "opacity-0")} role="dialog" aria-modal="true" aria-labelledby="mode-title">
      <BrandPanel variant="modes" className="min-h-dvh" />

      <div className="relative flex min-h-dvh flex-col">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div className="absolute inset-0" style={{ background: "radial-gradient(800px 460px at 70% 0%, var(--matan-body-glow-1), transparent 60%), radial-gradient(600px 400px at 20% 100%, var(--matan-body-glow-2), transparent 60%)" }} aria-hidden />

        <header className="relative flex items-center justify-end px-5 pt-5 sm:px-8 sm:pt-6">
          <ThemeToggle />
        </header>

        <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 py-8 sm:px-8">
          <BrandMobileHeader />
          <div data-hero className="text-center">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.32em] text-text-3">Welcome to Matan AI</p>
            <h1 id="mode-title" className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight text-text sm:text-[40px]">
              Choose your experience
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-relaxed text-text-2">Explore Matan AI with sample data, or connect the Ring Developer Playground to test the real integration.</p>
          </div>

          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {/* Demo */}
            <section data-card className="relative flex flex-col rounded-[22px] border border-purple/40 bg-surface/80 p-6 shadow-[0_0_60px_-24px_rgba(154,113,255,0.55)] backdrop-blur-xl transition-[border-color,box-shadow] hover:border-purple/70 hover:shadow-[0_0_70px_-20px_rgba(154,113,255,0.7)]" aria-labelledby="demo-card">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a983ff] to-[#7f5cff] text-white shadow-[0_10px_30px_rgba(154,113,255,0.45)]">
                  <Sparkles className="size-7" />
                </span>
                <span className="rounded-full border border-purple/35 bg-purple/12 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-purple">Mock data</span>
              </div>
              <h2 id="demo-card" className="mt-6 text-[26px] font-bold leading-tight text-text">
                Demo Mode
              </h2>
              <p className="text-[15.5px] text-text-2">Explore freely</p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-text-2">Try the full Matan AI experience with sample devices, events, insights, and automations.</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-[14px] text-text-2">
                {["No Ring setup required", "Instant access", "Perfect for first-time users"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <Check className="size-4 text-primary" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              <Button size="lg" fullWidth className="mt-6 bg-gradient-to-b from-[#a983ff] to-[#7f5cff] shadow-[0_10px_28px_rgba(154,113,255,0.35)] hover:from-[#b895ff] hover:to-[#8f6fff]" onClick={() => pick("demo")} rightIcon={<ArrowRight className="size-4" />}>
                Enter Demo Mode
              </Button>
              <button type="button" onClick={() => pick("demo", () => router.push("/settings?tab=about"))} className="mt-4 flex w-full items-center justify-between rounded-[12px] px-1 py-1.5 text-left text-[14px] text-text-2 transition-colors hover:text-text">
                <span className="flex items-center gap-2.5">
                  <GraduationCap className="size-[18px] text-purple" aria-hidden /> Learn how Matan AI works
                </span>
                <ChevronRight className="size-4 text-text-3" aria-hidden />
              </button>
            </section>

            {/* Real */}
            <section data-card className="relative flex flex-col rounded-[22px] border border-primary/45 bg-surface/80 p-6 shadow-[0_0_60px_-24px_rgba(18,168,255,0.6)] backdrop-blur-xl transition-[border-color,box-shadow] hover:border-primary/75 hover:shadow-[0_0_70px_-20px_rgba(18,168,255,0.75)]" aria-labelledby="real-card">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-2 to-primary text-white shadow-[0_10px_30px_rgba(18,168,255,0.45)]">
                  <span className="flex size-7 items-center justify-center rounded-full border-[3px] border-white" aria-hidden>
                    <span className="size-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
                  </span>
                </span>
                <span className="rounded-full border border-primary/35 bg-primary/12 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary">Ring simulator</span>
              </div>
              <h2 id="real-card" className="mt-6 text-[26px] font-bold leading-tight text-text">
                Real Mode
              </h2>
              <p className="text-[15.5px] text-text-2">Connect and test</p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-text-2">Use a temporary Ring Developer Playground token to discover and test simulated Ring devices.</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-[14px] text-text-2">
                {["No physical Ring device required", "Playground session: 30 minutes", "Test real Ring integration"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <Check className="size-4 text-primary" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              <Button size="lg" fullWidth className="mt-6" onClick={() => pick("ring")} rightIcon={<ArrowRight className="size-4" />}>
                {ringReady ? "Enter Real Mode" : "Connect Ring"}
              </Button>
              <a href={RING_PLAYGROUND_DOCS} target="_blank" rel="noreferrer noopener" className="mt-4 flex w-full items-center justify-between rounded-[12px] px-1 py-1.5 text-left text-[14px] text-text-2 transition-colors hover:text-text">
                <span className="flex items-center gap-2.5">
                  <BookOpen className="size-[18px] text-primary" aria-hidden /> Setup guide for Ring Playground
                </span>
                <ChevronRight className="size-4 text-text-3" aria-hidden />
              </a>
            </section>
          </div>

          <div className="mt-10 flex items-center justify-center gap-4 text-center">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-primary/50" aria-hidden />
            <div>
              <p className="text-[14px] text-text-2">Same intelligence. Your choice.</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-text-3">Matan AI</p>
            </div>
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-primary/50" aria-hidden />
          </div>
        </main>

        <footer className="relative flex items-center justify-end px-6 pb-6 pr-20 sm:px-10 sm:pr-24">
          <p className={cn(brandScriptClass, "text-[26px] leading-none text-primary/80 -rotate-6")}>Guarding what matters</p>
        </footer>
      </div>
    </div>
  );
}

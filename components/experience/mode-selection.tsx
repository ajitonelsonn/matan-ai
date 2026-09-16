"use client";

import * as React from "react";
import Image from "next/image";
import { Sparkles, Check, Zap, Clock, ShieldOff, ArrowRight } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "./theme-toggle";
import { useExperience } from "./experience-provider";

/**
 * First-run experience chooser (full screen). Shown once, before the dashboard,
 * until the user picks Demo or Real. Theme control top-right.
 */
export function ModeSelection() {
  const { chosen, setMode, openConnect, ring } = useExperience();
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

  const pick = (mode: "demo" | "ring") => {
    setLeaving(true);
    window.setTimeout(() => {
      if (mode === "demo") setMode("demo");
      else if (ring.state === "connected" || ring.state === "expiring") setMode("ring");
      else openConnect({ thenMode: "ring" }); // Connect Ring modal (z-100) opens above this screen (z-96)
      setLeaving(false);
    }, 180);
  };

  return (
    <div ref={scope} className={cn("fixed inset-0 z-[96] overflow-y-auto bg-bg transition-opacity duration-200", leaving && "opacity-0")} role="dialog" aria-modal="true" aria-labelledby="mode-title">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="absolute inset-0" style={{ background: "radial-gradient(900px 500px at 50% 20%, var(--matan-body-glow-1), transparent 60%), radial-gradient(700px 400px at 85% 90%, var(--matan-body-glow-2), transparent 60%)" }} aria-hidden />
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div data-hero className="flex flex-col items-center text-center">
          <Image src="/brand/matan-ai-logo.png" alt="" width={96} height={96} priority className="drop-shadow-[0_10px_30px_rgba(18,168,255,0.45)]" />
          <p className="mt-3 text-[22px] font-extrabold tracking-[0.08em] text-text">MATAN AI</p>
          <p className="text-[13px] text-text-3">Your intelligent eye at home.</p>
          <h1 id="mode-title" className="mt-8 text-[30px] font-bold leading-tight tracking-tight text-text sm:text-[38px]">
            How would you like to explore Matan AI?
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-2">Explore the complete experience with sample data, or connect the Ring Developer Playground to test the real integration.</p>
        </div>

        <div className="mt-10 grid w-full gap-5 md:grid-cols-2">
          {/* Demo */}
          <section data-card className="card-hero group relative flex flex-col p-6 transition-[border-color,box-shadow] hover:border-purple/50" aria-labelledby="demo-card">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-[#7f5cff] text-white shadow-[0_8px_24px_rgba(154,113,255,0.35)]">
                <Sparkles className="size-6" />
              </span>
              <span className="rounded-full border border-purple/30 bg-purple/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-purple">Mock data</span>
            </div>
            <h2 id="demo-card" className="mt-5 text-[22px] font-bold text-text">
              Demo Mode
            </h2>
            <p className="text-[15px] font-medium text-text-2">Explore the full Matan AI experience</p>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-text-2">Use realistic sample devices, events, insights, automations and reports.</p>
            <Button size="lg" fullWidth className="mt-6 bg-gradient-to-b from-purple to-[#7f5cff] shadow-[0_8px_24px_rgba(154,113,255,0.3)] hover:from-[#a983ff] hover:to-purple" onClick={() => pick("demo")} rightIcon={<ArrowRight className="size-4" />}>
              Enter Demo
            </Button>
            <ul className="mt-4 space-y-1.5 text-[13px] text-text-3">
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> No Ring setup required</li>
              <li className="flex items-center gap-2"><Zap className="size-4 text-success" /> Instant access</li>
            </ul>
          </section>

          {/* Real */}
          <section data-card className="card-hero group relative flex flex-col p-6 transition-[border-color,box-shadow] hover:border-primary/60" aria-labelledby="real-card">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-2 to-primary text-white shadow-[0_8px_24px_rgba(18,168,255,0.35)]">
                <span className="size-4 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]" aria-hidden />
              </span>
              <span className="rounded-full border border-primary/30 bg-primary/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary">Ring simulator</span>
            </div>
            <h2 id="real-card" className="mt-5 text-[22px] font-bold text-text">
              Real Mode
            </h2>
            <p className="text-[15px] font-medium text-text-2">Connect Ring Simulator</p>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-text-2">Use a temporary Ring Developer Playground token to discover and test simulated Ring devices.</p>
            <Button size="lg" fullWidth className="mt-6" onClick={() => pick("ring")} rightIcon={<ArrowRight className="size-4" />}>
              {ring.state === "connected" || ring.state === "expiring" ? "Enter Real Mode" : "Connect Ring"}
            </Button>
            <ul className="mt-4 space-y-1.5 text-[13px] text-text-3">
              <li className="flex items-center gap-2"><ShieldOff className="size-4 text-primary" /> No physical Ring device required</li>
              <li className="flex items-center gap-2"><Clock className="size-4 text-primary" /> Playground session: 30 minutes</li>
            </ul>
          </section>
        </div>

        <p className="mt-10 text-center text-[13px] text-text-3">
          Ring sees the event. <span className="text-text-2">Matan understands what matters.</span>
        </p>
      </div>
    </div>
  );
}

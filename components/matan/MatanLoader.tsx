"use client";

import * as React from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils/cn";

gsap.registerPlugin(useGSAP);

export type LoaderSize = "xs" | "sm" | "md" | "lg";

const dims: Record<LoaderSize, { box: number; logo: number; word: string; sub: string }> = {
  xs: { box: 28, logo: 22, word: "", sub: "" },
  sm: { box: 56, logo: 42, word: "text-[13px] tracking-[0.18em]", sub: "text-[11px]" },
  md: { box: 112, logo: 84, word: "text-[20px] tracking-[0.2em]", sub: "text-[13px]" },
  lg: { box: 168, logo: 124, word: "text-[30px] tracking-[0.24em]", sub: "text-[15px]" },
};

export const defaultLoaderMessages = [
  "Looking at your home…",
  "Analyzing recent events…",
  "Checking your devices…",
  "Thinking about what matters…",
];

export interface MatanLoaderProps {
  size?: LoaderSize;
  /** Show the MATAN AI wordmark under the logo */
  wordmark?: boolean;
  /** Rotating status messages (md/lg only) */
  messages?: string[] | false;
  label?: string;
  className?: string;
}

/**
 * The Matan AI logo as a living loading indicator.
 * GSAP timeline: logo pops in, then breathes; a glow halo pulses; sonar rings
 * ripple outward ("the eye is scanning"); a cyan arc orbits like a thinking
 * spinner; the wordmark letters stagger in and status messages rotate.
 * Honors prefers-reduced-motion (gentle opacity pulse only).
 */
export function MatanLoader({ size = "md", wordmark = size !== "xs", messages = defaultLoaderMessages, label = "Loading", className }: MatanLoaderProps) {
  const scope = React.useRef<HTMLDivElement>(null);
  const d = dims[size];
  const showMessages = messages && size !== "xs" && size !== "sm";
  const letters = React.useMemo(() => "MATAN AI".split(""), []);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const q = gsap.utils.selector(scope);

      if (reduced) {
        gsap.set(q("[data-logo], [data-letter], [data-halo]"), { opacity: 1 });
        gsap.to(q("[data-halo]"), { opacity: 0.55, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut" });
        return;
      }

      // Only tween what this size variant actually renders (xs/sm omit rings, bar, text).
      const has = (sel: string) => q(sel).length > 0;

      // --- Intro -----------------------------------------------------------
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.fromTo(q("[data-logo]"), { scale: 0.45, opacity: 0, rotation: -10, y: 8 }, { scale: 1, opacity: 1, rotation: 0, y: 0, duration: 0.9, ease: "back.out(1.8)" });
      intro.fromTo(q("[data-halo]"), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 0.85, duration: 0.7 }, 0.1);
      intro.fromTo(q("[data-arc]"), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5 }, 0.35);
      if (has("[data-letter]")) intro.fromTo(q("[data-letter]"), { y: 14, opacity: 0, filter: "blur(4px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.5, stagger: 0.045 }, 0.45);
      if (has("[data-sub]")) intro.fromTo(q("[data-sub]"), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.8);

      // --- Loops (compositor-only: transform + opacity) ------------------------
      gsap.to(q("[data-logo]"), { scale: 1.05, y: -3, duration: 1.7, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.9 });
      gsap.to(q("[data-halo]"), { scale: 1.12, opacity: 0.55, duration: 1.7, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.9 });
      gsap.to(q("[data-arc]"), { rotation: 360, duration: 1.6, repeat: -1, ease: "none" });
      if (has("[data-arc-2]")) gsap.to(q("[data-arc-2]"), { rotation: -360, duration: 2.6, repeat: -1, ease: "none" });
      if (has("[data-ring]")) {
        gsap.fromTo(
          q("[data-ring]"),
          { scale: 0.7, opacity: 0.75 },
          { scale: 1.75, opacity: 0, duration: 2.4, repeat: -1, ease: "power2.out", stagger: { each: 0.8, repeat: -1 }, delay: 0.6 },
        );
      }
      if (has("[data-orbit]")) gsap.to(q("[data-orbit]"), { rotation: 360, duration: 4.5, repeat: -1, ease: "none" });
      if (has("[data-orbit-dot]")) gsap.to(q("[data-orbit-dot]"), { scale: 1.5, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" });
      if (has("[data-bar]")) gsap.to(q("[data-bar]"), { xPercent: 260, duration: 1.4, repeat: -1, ease: "power1.inOut" });

      // --- Rotating status messages ------------------------------------------
      const msgEl = q("[data-msg]")[0] as HTMLElement | undefined;
      if (msgEl && showMessages) {
        const list = messages as string[];
        let i = 0;
        const cycle = () => {
          gsap.to(msgEl, {
            opacity: 0,
            y: -6,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
              i = (i + 1) % list.length;
              msgEl.textContent = list[i];
              gsap.fromTo(msgEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
            },
          });
        };
        const ticker = gsap.timeline({ repeat: -1, repeatDelay: 1.9, delay: 1.9 });
        ticker.call(cycle);
      }
    },
    { scope, dependencies: [size, showMessages] },
  );

  return (
    <div ref={scope} role="status" aria-live="polite" aria-label={label} className={cn("flex flex-col items-center justify-center select-none", className)}>
      <div className="relative" style={{ width: d.box, height: d.box }}>
        {/* Glow halo */}
        <div data-halo className="absolute -inset-[30%] rounded-full opacity-0 will-change-transform" style={{ background: "radial-gradient(circle, rgba(18,168,255,0.42) 0%, rgba(18,230,255,0.16) 38%, transparent 68%)" }} aria-hidden />
        {/* Sonar rings */}
        {size !== "xs" &&
          [0, 1, 2].map((i) => (
            <div key={i} data-ring className="absolute inset-0 rounded-full border opacity-0 will-change-transform" style={{ borderColor: i === 1 ? "rgba(18,230,255,0.55)" : "rgba(18,168,255,0.55)" }} aria-hidden />
          ))}
        {/* Orbiting arcs */}
        <div
          data-arc
          className="absolute -inset-[9%] rounded-full opacity-0 will-change-transform"
          style={{
            background: "conic-gradient(from 0deg, transparent 0deg, transparent 250deg, rgba(38,198,255,0.15) 290deg, #26c6ff 360deg)",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          }}
          aria-hidden
        />
        {size !== "xs" && (
          <div
            data-arc-2
            className="absolute -inset-[18%] rounded-full will-change-transform"
            style={{
              background: "conic-gradient(from 180deg, transparent 0deg, transparent 300deg, rgba(154,113,255,0.1) 330deg, rgba(154,113,255,0.75) 360deg)",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px))",
            }}
            aria-hidden
          />
        )}
        {/* Orbiting dot */}
        {size !== "xs" && (
          <div data-orbit className="absolute -inset-[18%] will-change-transform" aria-hidden>
            <span data-orbit-dot className="absolute left-1/2 top-0 -ml-1 size-2 rounded-full bg-cyan shadow-[0_0_12px_rgba(18,230,255,0.9)]" />
          </div>
        )}
        {/* Logo */}
        <div data-logo className="absolute inset-0 flex items-center justify-center opacity-0 will-change-transform">
          <Image src="/brand/matan-ai-logo.png" alt="" width={d.logo} height={d.logo} priority className="drop-shadow-[0_10px_30px_rgba(18,168,255,0.45)]" />
        </div>
      </div>

      {wordmark && size !== "xs" && (
        <div className={cn("mt-4 flex items-center font-extrabold text-text", d.word)} aria-hidden>
          {letters.map((ch, i) => (
            <span key={i} data-letter className="inline-block opacity-0 will-change-transform" style={{ minWidth: ch === " " ? "0.5em" : undefined }}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </div>
      )}

      {showMessages && (
        <>
          <p data-sub className={cn("mt-1.5 text-text-3 opacity-0", d.sub)}>
            Your intelligent eye at home.
          </p>
          <div className="mt-5 h-[3px] w-40 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div data-bar className="h-full w-[38%] -translate-x-full rounded-full bg-gradient-to-r from-primary via-cyan to-primary-2 will-change-transform" />
          </div>
          <p data-msg className={cn("mt-3 min-h-5 font-medium text-text-2", d.sub)}>
            {(messages as string[])[0]}
          </p>
        </>
      )}
    </div>
  );
}

/** Centered loader placed over a skeleton area (parent must be `relative`). */
export function LoadingOverlay({ label, className, size = "md" }: { label?: string; className?: string; size?: LoaderSize }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-bg/35 backdrop-blur-[2px] animate-fade-in", className)}>
      <MatanLoader size={size} messages={false} label={label ?? "Loading"} />
    </div>
  );
}

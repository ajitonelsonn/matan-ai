"use client";

import * as React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { MatanLoader } from "@/components/matan/MatanLoader";
import { useAppData } from "./AppDataProvider";

const MIN_VISIBLE_MS = 1600;

/**
 * Full-page logo splash shown on first load and every browser refresh.
 * Stays until shell data has arrived and at least MIN_VISIBLE_MS passed,
 * then fades/scales out with GSAP and unmounts. The page renders beneath it.
 */
export function SplashGate() {
  const { data, error } = useAppData();
  const [visible, setVisible] = React.useState(true);

  // `?splash=0` skips the splash (used for QA screenshots and embeds).
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("splash") === "0") setVisible(false);
  }, []);
  const [ready, setReady] = React.useState(false);
  const [minElapsed, setMinElapsed] = React.useState(false);
  const scope = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if ((data || error) && minElapsed) setReady(true);
  }, [data, error, minElapsed]);

  useGSAP(
    () => {
      if (!ready || !scope.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap
        .timeline({ onComplete: () => setVisible(false) })
        .to(scope.current.querySelector("[data-inner]"), { scale: reduced ? 1 : 1.12, opacity: 0, duration: reduced ? 0.2 : 0.45, ease: "power2.in" })
        .to(scope.current, { opacity: 0, duration: reduced ? 0.2 : 0.5, ease: "power2.inOut" }, reduced ? 0 : 0.15);
    },
    { scope, dependencies: [ready] },
  );

  if (!visible) return null;

  return (
    <div
      ref={scope}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-bg"
      style={{
        background:
          "radial-gradient(900px 500px at 50% 35%, rgba(18,168,255,0.16), transparent 60%), radial-gradient(700px 400px at 80% 90%, rgba(154,113,255,0.10), transparent 60%), var(--matan-bg)",
      }}
      aria-busy="true"
    >
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div data-inner className="relative will-change-transform">
        <MatanLoader size="lg" label="Loading Matan AI" />
      </div>
      <p className="absolute bottom-8 text-[12px] text-text-3">Ring sees the event. Matan understands the situation.</p>
    </div>
  );
}

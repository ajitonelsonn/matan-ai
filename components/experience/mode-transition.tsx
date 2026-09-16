"use client";

import { MatanLoader } from "@/components/matan/MatanLoader";
import { useExperience } from "./experience-provider";

/** Brief overlay while switching modes. Subtle (~150–250ms in/out), no heavy glow. */
export function ModeTransition() {
  const { transition } = useExperience();
  if (!transition.active) return null;
  const toReal = transition.target === "ring";
  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center bg-bg/85 backdrop-blur-md animate-fade-in" role="status" aria-live="assertive">
      <div className="flex flex-col items-center text-center">
        <MatanLoader size="md" wordmark={false} messages={toReal ? ["Checking Ring Simulator connection…", "Loading connected devices…", "Refreshing Matan context…"] : ["Loading sample environment…", "Preparing demo events…"]} label={toReal ? "Switching to Real Mode" : "Switching to Demo Mode"} />
        <p className="mt-4 text-[17px] font-semibold text-text">{toReal ? "Switching to Real Mode…" : "Switching to Demo Mode…"}</p>
      </div>
    </div>
  );
}

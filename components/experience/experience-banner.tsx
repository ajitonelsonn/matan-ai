"use client";

import { ArrowRight, RefreshCw, Sparkles, Lock, Clock, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { useExperience } from "./experience-provider";
import { SourceBadge } from "./source-badge";
import * as React from "react";
import { ringApi, ringErrorFrom } from "@/lib/api/ring";
import { useToast } from "@/components/ui/Toast";

/**
 * Lightweight, always-honest source banner shown near every page heading.
 * Variants: demo · ring · ring-expiring · ring-expired  (compact or full).
 */
export function ExperienceBanner({ compact = true, className }: { compact?: boolean; className?: string }) {
  const { mode, ring, switchMode, openConnect } = useExperience();
  const toast = useToast();
  const [refreshing, setRefreshing] = React.useState(false);
  const active = mode ?? "demo";

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await ringApi.refresh();
      ring.setData({ connected: res.connected, session: res.session });
      toast.success("Ring Simulator refreshed", `${res.devices.length} ${res.devices.length === 1 ? "device" : "devices"} reported by Ring.`);
    } catch (e) {
      const err = ringErrorFrom(e);
      toast.error(err?.title ?? "Couldn't refresh", err?.message);
      void ring.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (active === "demo") {
    if (compact) {
      return (
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-purple/25 bg-purple/[0.07] px-3 py-1.5 text-[13px]", className)} role="note">
          <SourceBadge source="demo" size="xs" />
          <span className="text-text-2">You&apos;re exploring Matan AI with simulated data.</span>
          <button type="button" onClick={() => switchMode("ring")} className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-2">
            Test Ring Simulator <ArrowRight className="size-3.5" />
          </button>
        </div>
      );
    }
    return (
      <div className={cn("flex flex-col gap-4 rounded-2xl border border-purple/25 bg-gradient-to-r from-purple/12 via-purple/[0.06] to-primary/[0.06] p-4 sm:flex-row sm:items-center", className)} role="note">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source="demo" />
          </div>
          <p className="mt-1 text-[14px] font-semibold text-text">You&apos;re in Demo Mode. All devices, events, charts and alerts are mock data.</p>
          <p className="text-[13px] text-text-2">Want to test the real Ring integration? Switch to Real Mode and connect your Ring Developer Playground session.</p>
        </div>
        <Button onClick={() => switchMode("ring")} rightIcon={<ArrowRight className="size-4" />} className="sm:shrink-0">
          Switch to Real Mode
        </Button>
      </div>
    );
  }

  // Real mode
  const expired = ring.state === "expired" || ring.state === "invalid" || ring.state === "not_connected";
  const expiring = ring.state === "expiring";
  const source = expired ? "ring-expired" : expiring ? "ring-expiring" : "ring";

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-1.5 text-[13px]",
          expired ? "border-danger/30 bg-danger/[0.08]" : expiring ? "border-warning/30 bg-warning/[0.08]" : "border-primary/25 bg-primary/[0.07]",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <SourceBadge source={source} size="xs" />
        {expired ? (
          <>
            <span className="text-text-2">{ring.state === "not_connected" ? "No Ring Playground session." : "Your Ring Simulator session expired. Generate a new Playground token to reconnect."}</span>
            <Button size="xs" className="ml-auto" leftIcon={<Lock className="size-3.5" />} onClick={() => openConnect()}>
              Reconnect Ring
            </Button>
          </>
        ) : (
          <>
            <span className="text-text-2">Connected to the Ring Developer Playground.</span>
            <span className={cn("inline-flex items-center gap-1 font-mono text-[12.5px] font-semibold tabular-nums", expiring ? "text-warning" : "text-text")}>
              <Clock className="size-3.5" /> Session {ring.countdownLabel}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Button size="xs" variant="ghost" leftIcon={<RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />} onClick={() => void refresh()} disabled={refreshing}>
                Refresh
              </Button>
              <Button size="xs" variant="ghost" onClick={() => openConnect()}>
                Reconnect
              </Button>
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center", expired ? "border-danger/30 bg-danger/[0.08]" : expiring ? "border-warning/30 bg-warning/[0.08]" : "border-primary/25 bg-gradient-to-r from-primary/12 to-cyan/[0.06]", className)} role="status" aria-live="polite">
      <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-xl", expired ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary")}>{expired ? <Lock className="size-5" /> : <span className="size-3 rounded-full bg-current shadow-[0_0_12px_currentColor]" />}</span>
      <div className="min-w-0 flex-1">
        <SourceBadge source={source} />
        <p className="mt-1 text-[14px] font-semibold text-text">{expired ? "Ring Simulator session expired" : "Real Mode uses the Ring Developer Playground simulator. No physical Ring device is required."}</p>
        <p className="text-[13px] text-text-2">
          {expired ? "Your account, settings, automations and device metadata are kept. Generate a new Playground token to resume Ring-backed features." : `Your temporary Playground token expires in ${ring.countdownLabel}.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {!expired && (
          <Button variant="secondary" leftIcon={<RefreshCw className={cn("size-4", refreshing && "animate-spin")} />} onClick={() => void refresh()} disabled={refreshing}>
            Refresh
          </Button>
        )}
        <Button onClick={() => openConnect()} leftIcon={expired ? <Lock className="size-4" /> : <Settings2 className="size-4" />}>
          {expired ? "Reconnect Ring" : "Manage Ring Connection"}
        </Button>
      </div>
    </div>
  );
}

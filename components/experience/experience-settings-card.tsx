"use client";

import * as React from "react";
import { Sparkles, Lock, Unplug, RefreshCw, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ringApi } from "@/lib/api/ring";
import { useExperience } from "./experience-provider";
import { SourceBadge } from "./source-badge";

/** Settings → Experience Mode (Demo / Real) + Ring connection management. */
export function ExperienceSettingsCard() {
  const { mode, switchMode, ring, openConnect } = useExperience();
  const toast = useToast();
  const confirm = useConfirm();
  const active = mode ?? "demo";
  const live = ring.state === "connected" || ring.state === "expiring";

  const disconnect = async () => {
    const ok = await confirm({ title: "Disconnect the Ring Playground session?", description: "Matan forgets the temporary token. Your account, settings, automations and saved device metadata are kept.", confirmLabel: "Disconnect", tone: "default" });
    if (!ok) return;
    try {
      await ringApi.disconnect();
      ring.setData({ session: null });
      toast.success("Ring session disconnected");
    } catch {
      toast.error();
    }
  };

  const option = (value: "demo" | "ring", title: string, desc: string, icon: React.ReactNode) => {
    const selected = active === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => switchMode(value)}
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow]",
          selected ? (value === "demo" ? "border-purple/50 bg-purple/[0.08] glow" : "border-primary/50 bg-primary/[0.08] glow") : "border-border bg-bg/30 hover:border-border-strong",
        )}
      >
        <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? (value === "demo" ? "border-purple bg-purple text-white" : "border-primary bg-primary text-white") : "border-border-strong")}>{selected && <Check className="size-3" />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
            {icon} {title}
          </span>
          <span className="mt-0.5 block text-[13px] text-text-2">{desc}</span>
        </span>
      </button>
    );
  };

  return (
    <section className="card p-5" aria-labelledby="exp-mode">
      <CardHeader icon={<Sparkles />} title={<span id="exp-mode">Experience Mode</span>} subtitle="Choose how Matan AI should operate. Theme and account are independent of this choice." iconTone="purple" action={<SourceBadge source={active === "demo" ? "demo" : live ? "ring" : "ring-expired"} size="xs" />} />
      <div role="radiogroup" aria-label="Experience mode" className="grid gap-3 md:grid-cols-2">
        {option("demo", "Demo Mode", "Mock data for exploring the product. No Ring setup required.", <Sparkles className="size-4 text-purple" />)}
        {option("ring", "Real Mode", "Ring Developer Playground integration. Temporary 30-minute token, no physical device.", <span className="inline-block size-3 rounded-full bg-primary shadow-[0_0_10px_currentColor] text-primary" />)}
      </div>

      {active === "ring" && (
        <div className={cn("mt-4 rounded-2xl border p-4", live ? "border-primary/25 bg-primary/[0.06]" : "border-danger/30 bg-danger/[0.08]")} aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-text-3">Ring connection</p>
              <p className="flex items-center gap-2 text-[15px] font-semibold text-text">
                {live ? <><span className="size-2.5 rounded-full bg-success" /> Connected</> : <><Lock className="size-4 text-danger" /> {ring.state === "not_connected" ? "Not connected" : "Session expired"}</>}
              </p>
              {live && (
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-text-2">
                  <Clock className="size-3.5" /> Expires in <span className="font-mono font-semibold tabular-nums text-text">{ring.countdownLabel}</span> · {ring.connected.length} {ring.connected.length === 1 ? "device" : "devices"} connected
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" leftIcon={<RefreshCw className="size-4" />} onClick={() => openConnect()}>
                Reconnect Ring
              </Button>
              {live && (
                <Button size="sm" variant="danger" leftIcon={<Unplug className="size-4" />} onClick={() => void disconnect()}>
                  Disconnect Ring Session
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

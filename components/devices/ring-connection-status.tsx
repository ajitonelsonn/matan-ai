"use client";

import * as React from "react";
import { Clock, Lock, RefreshCw, Plus, Unplug, ShieldCheck, TriangleAlert, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { RingBadge } from "@/components/matan/Brand";
import { useRingCountdown } from "./use-ring-session";
import { RING_PLAYGROUND_URL } from "@/lib/ring/constants";
import type { RingSessionInfo } from "@/lib/ring/types";

export interface RingConnectionStatusProps {
  session: RingSessionInfo | null;
  connectedCount: number;
  onReconnect: () => void;
  onAddDevices: () => void;
  onRefresh: () => Promise<void> | void;
  onDisconnect: () => void;
  refreshing?: boolean;
}

/** Ring Playground session card: countdown, expiring/expired states, reconnect/refresh/disconnect. */
export function RingConnectionStatus({ session, connectedCount, onReconnect, onAddDevices, onRefresh, onDisconnect, refreshing }: RingConnectionStatusProps) {
  const cd = useRingCountdown(session);
  const live = cd.status === "valid" || cd.status === "expiring";

  return (
    <section className={cn("card p-5", cd.status === "expired" || cd.status === "invalid" ? "border-danger/35" : cd.status === "expiring" ? "border-warning/40" : live ? "border-success/30" : "")} aria-labelledby="ring-session">
      <SectionHeader
        icon={<RingBadge size="xs" />}
        title={<span id="ring-session">Ring session</span>}
        subtitle={connectedCount ? `${connectedCount} ${connectedCount === 1 ? "device" : "devices"} connected` : "No devices connected yet"}
        action={
          cd.status === "missing" ? (
            <Badge tone="neutral" size="sm">Not connected</Badge>
          ) : cd.status === "valid" ? (
            <Badge tone="success" size="sm" dot>Connected</Badge>
          ) : cd.status === "expiring" ? (
            <Badge tone="warning" size="sm" dot>Expiring</Badge>
          ) : (
            <Badge tone="danger" size="sm" dot>{cd.status === "invalid" ? "Invalid" : "Expired"}</Badge>
          )
        }
      />

      {cd.status === "missing" && (
        <>
          <p className="text-[13.5px] leading-relaxed text-text-2">Use a temporary Ring Developer Playground token to connect Matan AI to simulated Ring devices.</p>
          <Button fullWidth className="mt-4" leftIcon={<Plus className="size-4" />} onClick={onReconnect}>
            Add Ring Device
          </Button>
          <Button fullWidth variant="ghost" size="sm" className="mt-2" href={RING_PLAYGROUND_URL} rightIcon={<ExternalLink className="size-3.5" />}>
            Open Ring Playground
          </Button>
        </>
      )}

      {live && (
        <>
          <div className="card-inset p-3.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 text-text-2">
                <Clock className={cn("size-4", cd.status === "expiring" ? "text-warning" : "text-primary")} /> Token expires in
              </span>
              <span className={cn("font-mono text-[15px] font-semibold tabular-nums", cd.status === "expiring" ? "text-warning" : "text-text")} aria-live="off">
                {cd.label}
              </span>
            </div>
            <Progress value={cd.pct} tone={cd.status === "expiring" ? "warning" : "primary"} className="mt-2.5 h-1.5" label="Token lifetime remaining" />
          </div>
          {cd.status === "expiring" && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-[13px]" role="status">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-text">Token expires soon</p>
                <p className="text-text-2">Generate a new Ring Playground token to continue.</p>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw className={cn("size-4", refreshing && "animate-spin")} />} onClick={() => void onRefresh()} disabled={refreshing}>
              Refresh
            </Button>
            <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={onAddDevices}>
              Add devices
            </Button>
          </div>
          <button type="button" onClick={onDisconnect} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-text-3 hover:text-danger transition-colors">
            <Unplug className="size-3.5" /> Disconnect session
          </button>
        </>
      )}

      {(cd.status === "expired" || cd.status === "invalid") && (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3.5" role="alert">
            <Lock className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="text-[14px] font-semibold text-text">Ring Playground session {cd.status === "invalid" ? "is no longer valid" : "expired"}</p>
              <p className="text-[13px] text-text-2">Your temporary token has {cd.status === "invalid" ? "been rejected by Ring" : "expired"}. Generate a new token in the Ring Developer Playground to reconnect.</p>
            </div>
          </div>
          <Button fullWidth className="mt-4" leftIcon={<ShieldCheck className="size-4" />} onClick={onReconnect}>
            Reconnect Ring
          </Button>
          <p className="mt-2 text-center text-[12px] text-text-3">Connected devices stay listed; live status pauses until you reconnect.</p>
        </>
      )}
    </section>
  );
}

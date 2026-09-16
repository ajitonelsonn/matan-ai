"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, ExternalLink, RefreshCw, Package, Car, Activity, ChevronRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/hooks/useApi";
import { ringApi } from "@/lib/api/ring";
import { RING_PLAYGROUND_URL } from "@/lib/ring/constants";
import type { ConnectedRingDevice, RingHistoryEvent } from "@/lib/ring/types";
import { formatDate, formatTime } from "@/lib/utils/format";
import { ringKindIcon, ringKindLabel } from "./ring-device-card";
import { cn } from "@/lib/utils/cn";

/** Replaces the mock "AI Real-time Analysis" card when a Ring Playground device is selected. */
export function RingLiveSidePanel({ device, sessionLive, onReconnect }: { device: ConnectedRingDevice; sessionLive: boolean; onReconnect: () => void }) {
  const Icon = ringKindIcon[device.deviceType];
  const eventsQ = useApi<{ events: RingHistoryEvent[] } | null>(() => (sessionLive ? ringApi.events(device.id) : Promise.resolve(null)), [device.id, sessionLive]);
  const events = eventsQ.data?.events ?? [];

  return (
    <section className="card-hero p-5" aria-labelledby="ring-ai-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-primary text-white shadow-[0_6px_18px_rgba(154,113,255,0.35)]">
            <Sparkles className="size-5" />
          </span>
          <h2 id="ring-ai-title" className="text-[19px] font-bold text-text">
            Ring Live Analysis
          </h2>
        </div>
        <Badge tone={sessionLive ? "success" : "danger"} size="md" dot>
          {sessionLive ? "Playground connected" : "Session expired"}
        </Badge>
      </div>

      <div className="mt-4 flex gap-4">
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2">
          <SafeImage src={device.imageUrl} alt="" sizes="120px" fallbackIcon={<Icon className="size-6" />} className="[&_img]:object-contain [&_img]:p-2" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[19px] font-semibold text-text">{device.displayName}</h3>
          <p className="text-[13.5px] text-text-2">
            {device.model ? `Ring ${device.model}` : ringKindLabel[device.deviceType]} · {device.status === "online" ? <span className="text-success">Online</span> : device.status === "offline" ? <span className="text-danger">Offline</span> : "Status unknown"}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">
            This is a real WebRTC stream from the Ring Developer Playground. Trigger a simulation there and Matan will show the event clip here.
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {device.capabilities.map((c) => (
          <Badge key={c} tone="primary" size="md" variant="outline">
            {c}
          </Badge>
        ))}
        {device.aiEnabled && <Badge tone="success" size="md">Matan AI analysis on</Badge>}
      </div>

      <h4 className="mt-5 text-[15px] font-semibold text-text">Simulate an event</h4>
      <p className="mt-1 text-[13px] text-text-3">In the Playground, choose Package, Vehicle or Motion under “Simulate live view event”, then start the stream here.</p>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {[
          { label: "Package", icon: <Package /> },
          { label: "Vehicle", icon: <Car /> },
          { label: "Motion", icon: <Activity /> },
        ].map((s) => (
          <a key={s.label} href={RING_PLAYGROUND_URL} target="_blank" rel="noreferrer" className="card-inset flex flex-col items-center gap-1.5 px-2 py-3 text-[12.5px] font-medium text-text transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-2/60">
            <span className="text-primary [&>svg]:size-5">{s.icon}</span>
            {s.label}
            <span className="text-[10.5px] text-text-3">in Playground ↗</span>
          </a>
        ))}
      </div>

      <h4 className="mt-5 flex items-center justify-between text-[15px] font-semibold text-text">
        Recent Ring events
        {sessionLive && (
          <button type="button" onClick={() => void eventsQ.refetch({ silent: true })} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-2">
            <RefreshCw className={cn("size-3.5", eventsQ.loading && "animate-spin")} /> Refresh
          </button>
        )}
      </h4>
      {!sessionLive ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3">
          <Lock className="size-4 text-danger" />
          <p className="flex-1 text-[13px] text-text-2">Reconnect Ring to stream and load event history.</p>
          <Button size="xs" onClick={onReconnect}>
            Reconnect
          </Button>
        </div>
      ) : eventsQ.loading ? (
        <Skeleton className="mt-2 h-16" />
      ) : events.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-3">No events reported yet for this device.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {events.slice(0, 4).map((e) => (
            <li key={e.id} className="card-inset flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
              <span className="font-medium capitalize text-text">{e.kind.replace(/[_-]/g, " ")}</span>
              {e.createdAt && <span className="text-text-3">{formatDate(e.createdAt)} {formatTime(e.createdAt)}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" href={RING_PLAYGROUND_URL} rightIcon={<ExternalLink className="size-3.5" />} className="flex-1">
          Open Ring Playground
        </Button>
        <Link href={`/devices/${device.id}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-[10px] border border-border bg-surface-3/80 px-3 text-[13px] font-semibold text-text hover:border-border-strong">
          Device details <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

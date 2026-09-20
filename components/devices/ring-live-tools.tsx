"use client";

import * as React from "react";
import { Camera, Lock, Lightbulb, Siren, Disc, Film, Download, Share2, ImageDown, Loader2, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { useToast } from "@/components/ui/Toast";
import { ringApi } from "@/lib/api/ring";
import type { ConnectedRingDevice } from "@/lib/ring/types";
import { fetchAuthSession } from "aws-amplify/auth";
import { formatTime } from "@/lib/utils/format";

/**
 * Real Mode replacements for the demo Live View side cards. Real where Ring supports it
 * (snapshot, frame capture, Matan AI flag, read-only configuration); everything else is an
 * honest, non-interactive future capability.
 */

async function bearer(): Promise<Record<string, string>> {
  try {
    const s = await fetchAuthSession();
    const t = s.tokens?.accessToken?.toString();
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const FUTURE = "🔒 Future Ring capability - Ring's capability values are read-only and the API exposes no control endpoints (developer FAQ).";

export function RingLiveControls({ device, live, onSnapshot }: { device: ConnectedRingDevice; live: boolean; onSnapshot: (src: string, capturedAt?: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const snapshot = async () => {
    if (!live) return toast.warning("Reconnect Ring first", "The Playground session has expired.");
    setBusy(true);
    try {
      const res = await fetch(`/api/ring/devices/${device.id}/snapshot`, { method: "POST", headers: await bearer(), cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.info("No snapshot", j?.error?.message ?? "Ring returned no image.");
        return;
      }
      const blob = await res.blob();
      onSnapshot(URL.createObjectURL(blob), res.headers.get("X-Media-Captured-At") ?? undefined);
      toast.success("Snapshot from Ring", `Fresh frame from ${device.displayName}`);
    } catch {
      toast.error("Snapshot failed", "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const future = [
    { label: "Siren", icon: <Siren /> },
    { label: "Lights", icon: <Lightbulb /> },
    { label: "Door Lock", icon: <Lock /> },
    { label: "Record", icon: <Disc /> },
  ];
  return (
    <section className="card p-5" aria-labelledby="controls-title">
      <SectionHeader icon={<Camera />} title={<span id="controls-title">Live Controls</span>} subtitle="Snapshot is real (Ring image API). Device controls are a future Ring capability." />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <button type="button" onClick={() => void snapshot()} disabled={busy || device.details.snapshot === false} className="card-inset flex flex-col items-center gap-2 px-1 py-3.5 text-[12px] font-medium text-text transition-[border-color,background-color] hover:border-border-strong disabled:opacity-50" title={device.details.snapshot === false ? "Ring reports no snapshot capability" : "Request a fresh snapshot from Ring"}>
          <span className="[&>svg]:size-5 text-primary">{busy ? <Loader2 className="motion-safe:animate-spin" /> : <Camera />}</span>
          <span className="max-w-full text-center text-[11px] leading-tight">Snapshot</span>
          <Badge tone="success" size="xs">Real</Badge>
        </button>
        {future.map((c) => (
          <div key={c.label} className="card-inset flex flex-col items-center gap-2 px-1 py-3.5 text-[12px] font-medium text-text-3 opacity-70" aria-disabled="true" title={FUTURE}>
            <span className="[&>svg]:size-5">{c.icon}</span>
            <span className="max-w-full text-center text-[11px] leading-tight">{c.label}</span>
            <Badge tone="neutral" size="xs" icon={<Lock className="size-2.5" />}>Future</Badge>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-text-3">{FUTURE}</p>
    </section>
  );
}

export function RingQuickActions({ device, frameRef, live }: { device: ConnectedRingDevice; frameRef: React.RefObject<HTMLElement | null>; live: boolean }) {
  const toast = useToast();
  const screenshot = () => {
    const video = frameRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!video || !video.videoWidth) return toast.info("Start the live view first", "Screenshot captures the current frame of the Ring stream.");
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")?.drawImage(video, 0, 0);
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `matan-${device.displayName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.png`;
    a.click();
    toast.success("Screenshot saved", `${video.videoWidth}×${video.videoHeight} frame from the live stream`);
  };
  const future = [
    { label: "Record Clip", icon: <Film /> },
    { label: "Download", icon: <Download /> },
    { label: "Share Event", icon: <Share2 /> },
  ];
  return (
    <section className="card p-5" aria-labelledby="qa-title">
      <SectionHeader icon={<Sparkles />} title={<span id="qa-title">Quick Actions</span>} iconTone="warning" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={screenshot} disabled={!live} className="card-inset flex min-w-0 flex-col items-center gap-1.5 px-1 py-3 text-center text-[12px] font-medium text-text transition-[border-color,background-color] hover:border-border-strong disabled:opacity-50" title="Save the current frame of the live stream">
          <span className="text-primary [&>svg]:size-[18px]"><ImageDown /></span>
          <span className="max-w-full text-center text-[11px] leading-tight">Screenshot</span>
          <Badge tone="success" size="xs">Real</Badge>
        </button>
        {future.map((a) => (
          <div key={a.label} className="card-inset flex min-w-0 flex-col items-center gap-1.5 px-1 py-3 text-center text-[12px] font-medium text-text-3 opacity-70" aria-disabled="true" title="Future integration - Ring recordings are fetched per event by Matan (event clips), not started from here.">
            <span className="[&>svg]:size-[18px]">{a.icon}</span>
            <span className="max-w-full text-center text-[11px] leading-tight">{a.label}</span>
            <Badge tone="neutral" size="xs" icon={<Lock className="size-2.5" />}>Future</Badge>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] text-text-3">Event clips are retrieved automatically per Ring event (see the event page); ad-hoc recording, download and sharing are future integrations.</p>
    </section>
  );
}

export function RingCameraSettings({ device, onChange }: { device: ConnectedRingDevice; onChange: (d: ConnectedRingDevice) => void }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const toggleAi = async (v: boolean) => {
    setBusy(true);
    try {
      onChange(await ringApi.update(device.id, { aiEnabled: v }));
      toast.success(v ? "Matan AI analysis on" : "Matan AI analysis off", device.displayName);
    } catch {
      toast.error("Not saved", "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const motion = device.configuration?.motionEnabled;
  const audio = device.details.audio;
  return (
    <section className="card p-5" aria-labelledby="cs-title">
      <SectionHeader icon={<Camera />} title={<span id="cs-title">Camera Settings</span>} subtitle="Ring settings are read-only through the Partner API; Matan's own switches are editable." />
      <ul className="space-y-3">
        <li className="flex items-center justify-between gap-3 text-[14px] text-text-2" title="Read from GET /v1/devices/{id}/configurations - Ring does not allow changing it via the API">
          <span className="min-w-0"><span className="block">Motion detection</span><span className="block text-[11px] text-text-3">Ring · read-only</span></span>
          <Badge tone={motion === undefined ? "neutral" : motion ? "success" : "neutral"} size="xs">{motion === undefined ? "Unknown" : motion ? "On" : "Off"}</Badge>
        </li>
        <li className="flex items-center justify-between gap-3 text-[14px] text-text-2">
          <span className="min-w-0"><span className="block">Matan AI analysis</span><span className="block text-[11px] text-text-3">Matan setting</span></span>
          <Toggle size="sm" checked={device.aiEnabled} disabled={busy} onChange={(v) => void toggleAi(v)} label="Matan AI analysis" />
        </li>
        <li className="flex items-center justify-between gap-3 text-[14px] text-text-2" title="From GET /v1/devices/{id}/capabilities">
          <span className="min-w-0"><span className="block">Audio</span><span className="block text-[11px] text-text-3">Ring capability</span></span>
          <Badge tone={audio ? "success" : "neutral"} size="xs">{audio === undefined ? "Unknown" : audio ? "Yes" : "Unavailable"}</Badge>
        </li>
        <li className="flex items-center justify-between gap-3 text-[14px] text-text-2">
          <span className="min-w-0"><span className="block">Notifications</span><span className="block text-[11px] text-text-3">Smart Rules</span></span>
          <Button href="/settings?tab=care" variant="ghost" size="xs" className="shrink-0 text-primary">Rules →</Button>
        </li>
      </ul>
      <Button href={`/devices/${device.id}`} variant="ghost" size="sm" className="mt-3 -mr-2 float-right text-primary">Device details →</Button>
    </section>
  );
}

/** Lightweight viewer for an on-demand Ring snapshot. */
export function SnapshotViewer({ src, capturedAt, device, onClose }: { src: string | null; capturedAt?: string; device: ConnectedRingDevice; onClose: () => void }) {
  React.useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ring snapshot" onClick={onClose}>
      <div className="relative max-h-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Snapshot from ${device.displayName}`} className="max-h-[80vh] w-auto" />
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-text-2">
          <span>{device.displayName} · Ring snapshot{capturedAt ? ` · ${formatTime(capturedAt)}` : ""}</span>
          <button type="button" onClick={onClose} className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2")}><X className="size-4" /> Close</button>
        </div>
      </div>
    </div>
  );
}

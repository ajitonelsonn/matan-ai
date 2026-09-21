"use client";

import * as React from "react";
import { MapPin, Video, ListOrdered, BatteryMedium, Wifi, Cctv, BellRing, Lock, Speaker } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatusDot } from "@/components/ui/StatusDot";
import { Button } from "@/components/ui/Button";
import { RingBadge } from "./Brand";
import { DemoMarker } from "@/components/experience/source-badge";
import type { Device, DeviceKind } from "@/lib/types";

export const deviceKindIcon: Record<DeviceKind, React.ComponentType<{ className?: string }>> = {
  camera: Cctv,
  doorbell: BellRing,
  lock: Lock,
  chime: Speaker,
};

export const deviceKindLabel: Record<DeviceKind, string> = { camera: "Camera", doorbell: "Doorbell", lock: "Lock", chime: "Chime" };

/** Small device status tile (Home → Device Status). */
export function DeviceMini({ device, onClick, className }: { device: Device; onClick?: () => void; className?: string }) {
  const Icon = deviceKindIcon[device.kind];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("card-inset flex flex-col items-center gap-2 px-3 py-4 text-center transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-2/60", className)}>
      <span className={cn("inline-flex size-11 items-center justify-center rounded-xl border", device.statusStale ? "bg-surface-2 border-border text-text-3" : device.status === "online" ? "bg-surface-2 border-border text-text" : "bg-danger/10 border-danger/25 text-danger")}>
        <Icon className="size-5" />
      </span>
      <span className="text-[13.5px] font-semibold text-text leading-tight">{device.name}</span>
      <StatusDot tone={device.statusStale ? "neutral" : device.status === "online" ? "success" : "danger"} label={device.statusStale ? `Last known: ${device.status === "online" ? "online" : "offline"}` : device.status === "online" ? "Online" : "Offline"} size="sm" />
    </Tag>
  );
}

export function DeviceCard({
  device,
  view = "grid",
  onLive,
  onEvents,
  menu,
  className,
}: {
  device: Device;
  view?: "grid" | "list";
  onLive?: () => void;
  onEvents?: () => void;
  menu?: React.ReactNode;
  className?: string;
}) {
  const online = device.status === "online";
  const Icon = deviceKindIcon[device.kind];
  const hasFeed = device.kind === "camera" || device.kind === "doorbell";

  if (view === "list") {
    return (
      <article className={cn("card flex flex-col gap-4 p-4 sm:flex-row sm:items-center", !online && "border-danger/30", className)}>
        <div className="relative h-20 w-full sm:w-36 shrink-0 overflow-hidden rounded-xl border border-border">
          <SafeImage src={device.previewUrl} alt="" sizes="160px" grayscale={!online} fallbackIcon={<Icon className="size-6" />} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusDot tone={online ? "success" : "danger"} pulse={online} />
            <h3 className="text-[15px] font-semibold text-text truncate">{device.name}</h3>
            {device.isRing && <RingBadge size="xs" />}
          </div>
          <p className="text-[13px] text-text-2 truncate">{device.model}</p>
          <p className="flex items-center gap-1 text-[12.5px] text-text-3">
            <MapPin className="size-3.5" aria-hidden />
            {device.location}
          </p>
        </div>
        <DeviceVitals device={device} className="sm:w-40" />
        <div className="flex items-center gap-2 shrink-0">
          {hasFeed && (
            <Button variant="secondary" size="sm" leftIcon={<Video className="size-4" />} onClick={onLive} disabled={!online}>
              Live View
            </Button>
          )}
          <Button variant="secondary" size="sm" leftIcon={<ListOrdered className="size-4" />} onClick={onEvents}>
            Events
          </Button>
          {menu}
        </div>
      </article>
    );
  }

  return (
    <article className={cn("card hover-lift flex flex-col p-4", !online && "border-danger/30", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusDot tone={online ? "success" : "danger"} pulse={online} size="lg" />
          <div className="leading-tight">
            <h3 className="text-[15px] font-semibold text-text">{device.name}</h3>
            <p className={cn("text-[13px] font-medium", online ? "text-success" : "text-danger")}>{online ? "Online" : "Offline"}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5"><DemoMarker />{device.isRing && <RingBadge />}</span>
      </div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border">
        <SafeImage src={device.previewUrl} alt={`${device.name} preview`} sizes="(max-width: 768px) 100vw, 33vw" grayscale={!online} fallbackIcon={<Icon className="size-7" />} fallbackLabel={hasFeed ? undefined : deviceKindLabel[device.kind]} />
        {hasFeed && online && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-bg/70 px-2.5 py-1 text-[11px] font-semibold text-text backdrop-blur">
            <span className="size-1.5 rounded-full bg-danger animate-pulse-dot" aria-hidden />
            Live
          </span>
        )}
      </div>
      <div className="mt-3.5 flex items-start gap-3">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-text-2">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-semibold text-text truncate">{device.name}</h4>
          <p className="text-[13px] text-text-2 truncate">{device.model} <span className="text-text-3">· Simulated</span></p>
          <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-3">
            <MapPin className="size-3.5" aria-hidden />
            {device.location}
          </p>
        </div>
      </div>
      <DeviceVitals device={device} className="mt-3" />
      <div className="mt-4 flex items-center gap-2">
        {hasFeed ? (
          <Button variant="secondary" size="sm" className="flex-1" leftIcon={<Video className="size-4" />} onClick={onLive} disabled={!online}>
            Live View
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" className="flex-1" leftIcon={<ListOrdered className="size-4" />} onClick={onEvents}>
          Events
        </Button>
        {menu}
      </div>
    </article>
  );
}

export function DeviceVitals({ device, className }: { device: Device; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 text-[12px] text-text-3", className)}>
      {typeof device.battery === "number" && (
        <span className={cn("inline-flex items-center gap-1", device.battery < 30 ? "text-danger" : device.battery < 50 ? "text-warning" : "")} title="Battery">
          <BatteryMedium className="size-3.5" aria-hidden />
          {device.battery}%
        </span>
      )}
      {typeof device.signal === "number" && (
        <span className="inline-flex items-center gap-1" title="Signal strength">
          <Wifi className="size-3.5" aria-hidden />
          {device.signal}%
        </span>
      )}
      {device.firmware && <span title="Firmware">v{device.firmware}</span>}
    </div>
  );
}

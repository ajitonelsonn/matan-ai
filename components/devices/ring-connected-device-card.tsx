"use client";

import * as React from "react";
import { MapPin, Video, ListOrdered, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatusDot } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { RingBadge } from "@/components/matan/Brand";
import { ringKindIcon, ringKindLabel } from "./ring-device-card";
import { timeAgo } from "@/lib/utils/format";
import type { ConnectedRingDevice } from "@/lib/ring/types";

const statusLabel = { online: "Online", offline: "Offline", unknown: "Unknown" } as const;
const statusTone = { online: "success", offline: "danger", unknown: "neutral" } as const;

/**
 * Card for a device connected through the Ring Playground. Every fact shown
 * comes from the Ring API or the user's local metadata - nothing is invented.
 */
export function RingConnectedDeviceCard({ device, view = "grid", onEvents, onOpen, menu, className }: { device: ConnectedRingDevice; view?: "grid" | "list"; onEvents: () => void; onOpen: () => void; menu?: React.ReactNode; className?: string }) {
  const Icon = ringKindIcon[device.deviceType];
  const canLive = device.details.video && device.status === "online";
  const liveButton = (
    <Button variant="secondary" size="sm" className="flex-1" leftIcon={<Video className="size-4" />} disabled>
      Live View
    </Button>
  );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <StatusDot tone={statusTone[device.status]} pulse={device.status === "online"} size="lg" />
        <div className="leading-tight">
          <h3 className="text-[15px] font-semibold text-text">
            {device.displayName} {device.favorite && <Star className="inline size-3.5 -mt-0.5 fill-warning text-warning" aria-label="Favorite" />}
          </h3>
          <p className={cn("text-[13px] font-medium", device.status === "online" ? "text-success" : device.status === "offline" ? "text-danger" : "text-text-3")}>{statusLabel[device.status]}</p>
        </div>
      </div>
      <RingBadge />
    </div>
  );

  const facts = (
    <>
      <p className="text-[13px] text-text-2 truncate">{device.model ? `Ring ${device.model}` : ringKindLabel[device.deviceType]}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-3">
        <MapPin className="size-3.5" aria-hidden />
        {device.locationLabel ?? ([device.region?.state, device.region?.country].filter(Boolean).join(", ") || "Location not set")}
      </p>
      {device.ringName !== device.displayName && <p className="text-[12px] text-text-3">Ring name: {device.ringName}</p>}
    </>
  );

  const chips = device.capabilities.length ? (
    <div className="flex flex-wrap gap-1.5">
      {device.capabilities.slice(0, 4).map((c) => (
        <Badge key={c} tone="primary" size="xs" variant="outline">
          {c}
        </Badge>
      ))}
      {device.capabilities.length > 4 && <Badge tone="neutral" size="xs">+{device.capabilities.length - 4}</Badge>}
    </div>
  ) : (
    <p className="text-[12px] text-text-3">Capabilities not reported</p>
  );

  const synced = (
    <p className="flex items-center gap-1 text-[11.5px] text-text-3">
      <Clock className="size-3" /> Synced {timeAgo(device.lastSyncedAt, new Date().toISOString())}
      {device.statusReportedAt && <> · Ring reported {timeAgo(device.statusReportedAt, new Date().toISOString())}</>}
    </p>
  );

  const actions = (
    <div className="flex items-center gap-2">
      {canLive ? <Tooltip content="Live view for Ring devices arrives in the next milestone">{liveButton}</Tooltip> : liveButton}
      <Button variant="secondary" size="sm" className="flex-1" leftIcon={<ListOrdered className="size-4" />} onClick={onEvents}>
        Events
      </Button>
      {menu}
    </div>
  );

  if (view === "list") {
    return (
      <article className={cn("card flex flex-col gap-4 p-4 sm:flex-row sm:items-center", device.status === "offline" && "border-danger/30", className)}>
        <button type="button" onClick={onOpen} className="relative h-20 w-full sm:w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2">
          <SafeImage src={device.imageUrl} alt="" sizes="120px" fallbackIcon={<Icon className="size-6" />} fallbackLabel={device.imageUrl ? undefined : "Preview unavailable"} className="[&_img]:object-contain [&_img]:p-2" grayscale={device.status !== "online"} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusDot tone={statusTone[device.status]} pulse={device.status === "online"} />
            <button type="button" onClick={onOpen} className="text-left text-[15px] font-semibold text-text hover:text-primary-2">
              {device.displayName}
            </button>
            {device.favorite && <Star className="size-3.5 fill-warning text-warning" aria-label="Favorite" />}
            <RingBadge size="xs" />
          </div>
          {facts}
        </div>
        <div className="sm:w-56">{chips}</div>
        {actions}
      </article>
    );
  }

  return (
    <article className={cn("card hover-lift flex flex-col p-4", device.status === "offline" && "border-danger/30", className)}>
      {header}
      <button type="button" onClick={onOpen} className="relative mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-border bg-surface-2 text-left" aria-label={`Open ${device.displayName} details`}>
        <SafeImage src={device.imageUrl} alt={`${device.displayName} product image`} sizes="(max-width: 768px) 100vw, 33vw" fallbackIcon={<Icon className="size-7" />} fallbackLabel="Preview unavailable" className="[&_img]:object-contain [&_img]:p-6" grayscale={device.status !== "online"} />
        <span className="absolute bottom-2 left-2 rounded-md bg-bg/70 px-2 py-0.5 text-[10.5px] font-medium text-text-2 backdrop-blur">Ring product image</span>
      </button>
      <div className="mt-3.5 flex items-start gap-3">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-text-2">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="text-left text-[15px] font-semibold text-text hover:text-primary-2 truncate max-w-full">
            {device.displayName}
          </button>
          {facts}
        </div>
      </div>
      <div className="mt-3">{chips}</div>
      <div className="mt-2">{synced}</div>
      <div className="mt-4">{actions}</div>
    </article>
  );
}

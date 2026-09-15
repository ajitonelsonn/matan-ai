"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatusDot } from "@/components/ui/StatusDot";
import { LiveBadge } from "./Brand";
import type { Device } from "@/lib/types";

/** Small camera tile (selector strips, live family views). */
export function CameraTile({
  name,
  imageUrl,
  online = true,
  selected,
  onClick,
  className,
  showLive = true,
  aspect = "aspect-[16/10]",
}: {
  name: string;
  imageUrl?: string;
  online?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  showLive?: boolean;
  aspect?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      aria-label={onClick ? `Select ${name} camera` : undefined}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border bg-surface-2 text-left transition-[border-color,box-shadow,transform] duration-150",
        onClick && "hover:border-border-strong hover:-translate-y-0.5",
        selected ? "border-primary/70 glow-strong" : "border-border",
        className,
      )}
    >
      <div className={cn("relative", aspect)}>
        <SafeImage src={imageUrl} alt={`${name} camera preview`} sizes="240px" grayscale={!online} />
        {!online && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/60 text-xs font-semibold text-text-2">Offline</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent px-2.5 pb-2 pt-6 flex items-center justify-between gap-2">
          <StatusDot tone={online ? "success" : "danger"} label={name} className="[&>span:last-child]:text-text [&>span:last-child]:text-[12.5px] [&>span:last-child]:font-semibold truncate" />
          {showLive && online && <StatusDot tone="success" label="Live" className="shrink-0 [&>span:last-child]:text-[11px]" />}
        </div>
      </div>
    </Tag>
  );
}

/** Large live camera hero with overlay chrome. Children render over the frame (controls). */
export function LiveCameraFrame({
  device,
  imageUrl,
  timestamp,
  children,
  className,
  aspect = "aspect-video",
  topRight,
  priority,
}: {
  device: Pick<Device, "name" | "status">;
  imageUrl?: string;
  timestamp?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  aspect?: string;
  topRight?: React.ReactNode;
  priority?: boolean;
}) {
  const online = device.status === "online";
  return (
    <div className={cn("relative overflow-hidden rounded-hero border border-primary/40 glow bg-surface-2", aspect, className)}>
      <SafeImage src={imageUrl} alt={`${device.name} live view`} sizes="(max-width: 1024px) 100vw, 60vw" priority={priority} grayscale={!online} fallbackLabel="Camera preview unavailable" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/55 via-transparent to-bg/70" aria-hidden />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3.5 sm:p-4">
        <div className="flex items-center gap-2 rounded-full bg-bg/60 pl-3 pr-1.5 py-1 backdrop-blur-md border border-white/10">
          <StatusDot tone={online ? "success" : "danger"} pulse={online} />
          <span className="text-[15px] font-semibold text-text">{device.name}</span>
          {online ? <LiveBadge className="ml-1" /> : <span className="ml-1 rounded-full bg-danger/20 px-2 py-0.5 text-[11px] font-semibold text-danger">Offline</span>}
        </div>
        <div className="flex items-center gap-2">{topRight}</div>
      </div>
      {timestamp && (
        <div className="absolute right-4 top-14 sm:top-16 rounded-lg bg-bg/60 px-2.5 py-1 text-[13px] font-medium tabular-nums text-text backdrop-blur-md border border-white/10">{timestamp}</div>
      )}
      {!online && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-danger/30 bg-bg/70 px-5 py-3 text-center backdrop-blur">
            <p className="text-sm font-semibold text-text">Camera offline</p>
            <p className="text-xs text-text-3">Showing last known frame</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

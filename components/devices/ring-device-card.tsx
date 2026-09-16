"use client";

import * as React from "react";
import { Check, Camera, BellRing, Speaker, Cpu, MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SafeImage } from "@/components/ui/SafeImage";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { capabilityLabels } from "@/lib/ring/normalize";
import type { RingDeviceKind, RingDiscoveredDevice } from "@/lib/ring/types";

export const ringKindIcon: Record<RingDeviceKind, React.ComponentType<{ className?: string }>> = { doorbell: BellRing, camera: Camera, chime: Speaker, device: Cpu };
export const ringKindLabel: Record<RingDeviceKind, string> = { doorbell: "Doorbell", camera: "Camera", chime: "Chime", device: "Ring device" };

export function ringStatusTone(label: RingDiscoveredDevice["status"]["label"] | "online" | "offline" | "unknown") {
  const l = String(label).toLowerCase();
  return l === "online" ? "success" : l === "offline" ? "danger" : "neutral";
}

/** Selectable card for a device returned by Ring Device Discovery. Shows only API-known facts. */
export function RingDeviceCard({ device, selected, onToggle, disabled }: { device: RingDiscoveredDevice; selected: boolean; onToggle: () => void; disabled?: boolean }) {
  const Icon = ringKindIcon[device.type];
  const chips = capabilityLabels(device.capabilities);
  const region = [device.location?.state, device.location?.country].filter(Boolean).join(", ");
  return (
    <label
      className={cn(
        "card group flex cursor-pointer items-start gap-3.5 p-3.5 transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong",
        selected && "border-primary/60 glow-strong bg-surface-2/60",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="relative mt-0.5 inline-flex size-5 shrink-0 items-center justify-center">
        <input type="checkbox" className="peer sr-only" checked={selected} onChange={onToggle} disabled={disabled} aria-label={`Select ${device.name}`} />
        <span className={cn("inline-flex size-5 items-center justify-center rounded-md border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary/70", selected ? "border-primary bg-primary text-white" : "border-border-strong bg-bg/40")}>
          {selected && <Check className="size-3.5" />}
        </span>
      </span>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2">
        <SafeImage src={device.imageUrl} alt="" sizes="80px" fallbackIcon={<Icon className="size-6" />} fallbackLabel={device.imageUrl ? undefined : "Preview unavailable"} className="[&_img]:object-contain [&_img]:p-1.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold text-text">{device.name}</h3>
          <Badge tone={ringStatusTone(device.status.label)} size="xs" dot>
            {device.status.label}
          </Badge>
        </div>
        <p className="text-[13px] text-text-2">
          {device.model ? `Ring ${device.model}` : ringKindLabel[device.type]}
          {device.model && <span className="text-text-3"> · {ringKindLabel[device.type]}</span>}
        </p>
        {region && (
          <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-3">
            <MapPin className="size-3.5" aria-hidden />
            {region}
          </p>
        )}
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Badge key={c} tone="primary" size="xs" variant="outline">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

import type { Device, EventType, RingEvent } from "@/lib/types";
import type { ConnectedRingDevice, RingHistoryEvent } from "./types";

/**
 * Adapters from Ring-backed records to the shared UI types.
 * Nothing here invents Ring facts: unknown values stay undefined.
 */
export function ringToDevice(d: ConnectedRingDevice): Device {
  return {
    id: d.id,
    name: d.displayName,
    kind: d.deviceType === "doorbell" ? "doorbell" : d.deviceType === "chime" ? "chime" : "camera",
    model: d.model ? `Ring ${d.model}` : "Ring device",
    location: d.locationLabel ?? ([d.region?.state, d.region?.country].filter(Boolean).join(", ") || "Location not set"),
    status: d.status === "online" ? "online" : "offline",
    battery: undefined,
    signal: undefined,
    previewUrl: d.imageUrl,
    firmware: undefined,
    lastEventAt: d.statusReportedAt,
    isRing: true,
    settings: { motionAlerts: d.details.motionDetection ?? false, aiDetection: d.aiEnabled, audio: d.details.audio ?? false, notifications: true },
  };
}

const kindTitle: Record<string, { title: string; type: EventType; summary: string }> = {
  motion: { title: "Motion detected", type: "other", summary: "Ring reported motion." },
  ding: { title: "Doorbell pressed", type: "doorbell", summary: "The doorbell was pressed." },
  on_demand: { title: "Live view session", type: "other", summary: "A live view was started on this device." },
};

const detectionType: Record<string, { title: string; type: EventType }> = {
  person: { title: "Person detected", type: "person" },
  human: { title: "Person detected", type: "person" },
  package: { title: "Package detected", type: "package" },
  vehicle: { title: "Vehicle detected", type: "vehicle" },
  car: { title: "Vehicle detected", type: "vehicle" },
  animal: { title: "Animal detected", type: "animal" },
  pet: { title: "Animal detected", type: "animal" },
};

/** Map a Ring history event to the shared event shape. Analysis stays "pending" until Matan AI actually runs. */
export function ringEventToMatan(e: RingHistoryEvent, device: ConnectedRingDevice): RingEvent {
  // Ring may sub-type events, e.g. "motion.human" -> kind "motion" + detection "human".
  const [kindBase, ...subParts] = e.kind.split(".");
  const sub = subParts.join(".");
  if (sub && !e.detections.includes(sub)) e = { ...e, kind: kindBase, detections: [...e.detections, sub] };
  const base = kindTitle[e.kind] ?? { title: `${e.kind.replace(/[_-]/g, " ")} event`, type: "other" as EventType, summary: `Ring reported a ${e.kind.replace(/[_-]/g, " ")} event.` };
  const det = e.detections.map((d) => detectionType[d.toLowerCase()]).find(Boolean);
  const start = e.createdAt ?? new Date().toISOString();
  const dur = e.endedAt && e.createdAt ? Math.max(0, Math.round((new Date(e.endedAt).getTime() - new Date(e.createdAt).getTime()) / 1000)) : undefined;
  return {
    id: `ring-${e.id.split(".").pop()?.slice(0, 16) ?? e.id}`,
    type: det?.type ?? base.type,
    title: det?.title ?? base.title,
    location: device.locationLabel ?? device.displayName,
    cameraId: device.id,
    timestamp: start,
    priority: "normal",
    confidence: undefined,
    summary: `${det ? `Ring detected: ${e.detections.join(", ")}. ` : ""}${base.summary} Device: ${device.displayName}.`,
    imageUrl: undefined,
    clipDuration: dur,
    tags: [e.kind.replace(/_/g, " "), ...e.detections, "Ring Simulator"],
    aiAssessment: undefined,
    timeline: e.endedAt ? [{ time: start, label: `${base.title} (start)` }, { time: e.endedAt, label: "Event ended" }] : undefined,
    recommendedActions: [],
    source: "ring",
    analysis: "pending",
    ringEventType: e.kind,
  };
}

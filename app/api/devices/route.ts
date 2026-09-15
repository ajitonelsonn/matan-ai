import { getStore, delay, nextId } from "@/lib/mock/store";
import { ok, readJson } from "@/lib/api/http";
import type { Device, DeviceKind } from "@/lib/types";
import { images } from "@/lib/mock/images";

export const dynamic = "force-dynamic";

export async function GET() {
  await delay();
  const s = getStore();
  const online = s.devices.filter((d) => d.status === "online").length;
  const byKind: Record<DeviceKind, number> = { camera: 0, doorbell: 0, lock: 0, chime: 0 };
  s.devices.forEach((d) => (byKind[d.kind] += 1));
  return ok({
    items: s.devices,
    summary: { total: s.devices.length, online, offline: s.devices.length - online, byKind },
  });
}

export async function POST(req: Request) {
  await delay(500);
  const body = await readJson<{ name: string; kind: DeviceKind; location: string; model?: string }>(req);
  const s = getStore();
  const device: Device = {
    id: nextId("dev"),
    name: body.name || "New Device",
    kind: body.kind || "camera",
    model: body.model || (body.kind === "doorbell" ? "Ring Video Doorbell" : body.kind === "chime" ? "Ring Chime" : "Ring Stick Up Cam"),
    location: body.location || "Unassigned",
    status: "online",
    signal: 90,
    previewUrl: body.kind === "camera" || body.kind === "doorbell" ? images.houseModern : undefined,
    firmware: "2.4.11",
    isRing: true,
    settings: { motionAlerts: true, aiDetection: true, audio: true, notifications: true },
  };
  s.devices.push(device);
  return ok(device, { status: 201 });
}

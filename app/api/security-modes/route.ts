import { getStore, delay, nextId } from "@/lib/mock/store";
import { ok, badRequest, readJson } from "@/lib/api/http";
import type { SecurityModeId } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";

export const dynamic = "force-dynamic";

function payload() {
  const s = getStore();
  const active = s.securityModes.find((m) => m.id === s.activeModeId)!;
  const cameras = s.devices.filter((d) => d.kind === "camera" || d.kind === "doorbell");
  return {
    modes: s.securityModes,
    activeModeId: s.activeModeId,
    scheduleEnabled: s.scheduleEnabled,
    schedules: s.schedules,
    activity: s.modeActivity,
    status: {
      camerasOnline: cameras.filter((d) => d.status === "online").length,
      camerasTotal: cameras.length,
      devicesOnline: s.devices.filter((d) => d.status === "online").length,
      devicesTotal: s.devices.length,
      alertLevel: active.alertLevel,
      activeModeName: active.name,
    },
  };
}

export async function GET() {
  await delay();
  return ok(payload());
}

export async function PATCH(req: Request) {
  const body = await readJson<{
    activeModeId?: SecurityModeId;
    modeId?: SecurityModeId;
    settingKey?: string;
    enabled?: boolean;
    scheduleId?: string;
    scheduleEnabled?: boolean;
  }>(req);
  const s = getStore();
  if (body.activeModeId) {
    const mode = s.securityModes.find((m) => m.id === body.activeModeId);
    if (!mode) return badRequest("Unknown mode");
    if (s.activeModeId !== mode.id) {
      s.activeModeId = mode.id;
      s.modeActivity.unshift({ id: nextId("act"), modeId: mode.id, label: `Switched to ${mode.name}`, timestamp: MOCK_NOW, source: "Manually" });
    }
  }
  if (body.modeId && body.settingKey && typeof body.enabled === "boolean") {
    const mode = s.securityModes.find((m) => m.id === body.modeId);
    const setting = mode?.settings.find((x) => x.key === body.settingKey);
    if (setting) setting.enabled = body.enabled;
  }
  if (body.scheduleId && typeof body.enabled === "boolean") {
    const sch = s.schedules.find((x) => x.id === body.scheduleId);
    if (sch) sch.enabled = body.enabled;
  }
  if (typeof body.scheduleEnabled === "boolean") s.scheduleEnabled = body.scheduleEnabled;
  return ok(payload());
}

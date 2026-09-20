import { getStore, delay, nextId } from "@/lib/mock/store";
import { ok, badRequest, readJson } from "@/lib/api/http";
import type { SecurityModeId } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";
import { activateRingMode, ringSecurityPayload } from "@/lib/matan/security-modes";
import { AuthRequiredError, authErrorResponse, requireUser, withUser } from "@/lib/auth/server";
import { hydrateUserScope } from "@/lib/auth/scope";

/** Real Mode ("ring"): the active mode belongs to the verified Cognito user and drives the Decision Engine. */
async function ringScope(req: Request, fn: () => Promise<Response>): Promise<Response> {
  try {
    const user = await requireUser(req);
    return await withUser(user, async () => {
      await hydrateUserScope(user);
      return fn();
    });
  } catch (e) {
    if (e instanceof AuthRequiredError) return authErrorResponse(e);
    throw e;
  }
}
const isRing = (req: Request) => new URL(req.url).searchParams.get("mode") === "ring";

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

export async function GET(req: Request) {
  if (isRing(req)) return ringScope(req, async () => ok(ringSecurityPayload()));
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
  if (isRing(req)) {
    return ringScope(req, async () => {
      if (body.activeModeId) {
        try {
          return ok(await activateRingMode(body.activeModeId));
        } catch {
          return badRequest("Unknown mode");
        }
      }
      // Schedules and per-mode toggles have no real effect yet - refuse instead of pretending.
      return badRequest("Schedules and per-mode settings are a future integration in Real Mode.");
    });
  }
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

import "server-only";
import type { ModeActivity, SecurityMode, SecurityModeId } from "@/lib/types";
import { securityModes } from "@/lib/mock/securityModes";
import { getUserSettings, saveUserSettings } from "./user-settings";
import { getRingSession, listConnected, usableToken } from "@/lib/ring/session";

/**
 * Real Mode security modes. The mode definitions (name, description, illustration) are
 * static; the ACTIVE mode is a per-user setting persisted with the user's settings and read
 * by the Decision Engine (`night` → quiet-hours logic + full-clip analysis, `away` → strict
 * scoring of unknown people/vehicles). Schedules and per-mode toggles are not wired to
 * anything real, so the Real Mode payload reports them as future integrations.
 */

export const MODE_IDS: SecurityModeId[] = ["home", "away", "night", "care", "business", "custom"];
const MAX_HISTORY = 12;

/** What each mode really changes in Matan today (shown on the page instead of demo toggles). */
export const MODE_EFFECTS: Record<SecurityModeId, { effects: string[]; note?: string }> = {
  home: { effects: ["Decision Engine scores events normally.", "Smart Rules, sensitivity and quiet hours apply as configured."] },
  away: { effects: ["Strict scoring: unknown people and vehicles are rated higher priority and recommended for review.", "Smart Rules, sensitivity and quiet hours apply as configured."] },
  night: { effects: ["Night monitoring: doorbell presses and repeated activity are escalated as during quiet hours.", "New Ring events are analyzed from the full clip, not only a snapshot."] },
  care: { effects: ["Scores events like Home Mode."], note: "Care-specific policies (family presence, check-ins) are a future integration; use Care Context & Smart Rules for care notifications today." },
  business: { effects: ["Scores events like Home Mode."], note: "Business hours and staff policies are a future integration." },
  custom: { effects: ["Scores events like Home Mode."], note: "Custom policies are a future integration; Smart Rules are the way to customize decisions today." },
};

export interface RingSecurityPayload {
  modes: SecurityMode[];
  activeModeId: SecurityModeId;
  scheduleEnabled: boolean;
  schedules: never[];
  activity: ModeActivity[];
  status: { camerasOnline: number; camerasTotal: number; devicesOnline: number; devicesTotal: number; alertLevel: string; activeModeName: string };
  effects: typeof MODE_EFFECTS;
  future: { schedules: true; modeSettings: true };
}

export function activeRingMode(): SecurityMode {
  const id = getUserSettings().security?.activeModeId ?? "home";
  return securityModes.find((m) => m.id === id) ?? securityModes[0];
}

export function ringSecurityPayload(live = true): RingSecurityPayload {
  const settings = getUserSettings();
  const active = activeRingMode();
  const devices = listConnected();
  const cameras = devices.filter((d) => d.deviceType === "camera" || d.deviceType === "doorbell");
  const history = settings.security?.history ?? [];
  return {
    // Real Mode never exposes the demo per-mode toggles as if they did something.
    modes: securityModes.map((m) => ({ ...m, settings: [] })),
    activeModeId: active.id,
    scheduleEnabled: false,
    schedules: [],
    activity: history.map((h, i) => ({ id: `mode-${i}-${h.at}`, modeId: h.modeId, label: `Switched to ${securityModes.find((m) => m.id === h.modeId)?.name ?? h.modeId}`, timestamp: h.at, source: h.source })),
    status: {
      // Without a live Ring session the online counts are not known - report 0 rather than a stale number.
      camerasOnline: live ? cameras.filter((d) => d.status === "online").length : 0,
      camerasTotal: cameras.length,
      devicesOnline: live ? devices.filter((d) => d.status === "online").length : 0,
      devicesTotal: devices.length,
      alertLevel: active.alertLevel,
      activeModeName: active.name,
    },
    effects: MODE_EFFECTS,
    future: { schedules: true, modeSettings: true },
  };
}

export async function activateRingMode(id: unknown): Promise<RingSecurityPayload> {
  if (typeof id !== "string" || !MODE_IDS.includes(id as SecurityModeId)) throw new Error("Unknown mode");
  const modeId = id as SecurityModeId;
  const current = getUserSettings().security ?? { activeModeId: "home", history: [] };
  if (current.activeModeId !== modeId) {
    const at = new Date().toISOString();
    await saveUserSettings({ security: { activeModeId: modeId, changedAt: at, history: [{ modeId, at, source: "Manually" as const }, ...current.history].slice(0, MAX_HISTORY) } });
    console.info({ event: "security_mode_changed", mode: modeId });
  }
  return ringSecurityPayload(await ringLive());
}

async function ringLive() {
  return Boolean(usableToken(await getRingSession()));
}

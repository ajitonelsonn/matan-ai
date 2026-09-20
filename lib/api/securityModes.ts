import { request, qs } from "./client";
import type { ModeActivity, ModeSchedule, SecurityMode, SecurityModeId } from "@/lib/types";

export interface SecurityModesResponse {
  modes: SecurityMode[];
  activeModeId: SecurityModeId;
  scheduleEnabled: boolean;
  schedules: ModeSchedule[];
  activity: ModeActivity[];
  status: {
    camerasOnline: number;
    camerasTotal: number;
    devicesOnline: number;
    devicesTotal: number;
    alertLevel: string;
    activeModeName: string;
  };
  /** Real Mode only: what each mode really changes in Matan, and which demo features are future integrations. */
  effects?: Record<SecurityModeId, { effects: string[]; note?: string }>;
  future?: { schedules: boolean; modeSettings: boolean };
}

export const securityModesApi = {
  get: (mode: "demo" | "ring" = "demo") => request<SecurityModesResponse>(`/api/security-modes${qs({ mode })}`),
  activate: (activeModeId: SecurityModeId, mode: "demo" | "ring" = "demo") => request<SecurityModesResponse>(`/api/security-modes${qs({ mode })}`, { method: "PATCH", json: { activeModeId } }),
  setSetting: (modeId: SecurityModeId, settingKey: string, enabled: boolean) =>
    request<SecurityModesResponse>("/api/security-modes", { method: "PATCH", json: { modeId, settingKey, enabled } }),
  setSchedule: (scheduleId: string, enabled: boolean) =>
    request<SecurityModesResponse>("/api/security-modes", { method: "PATCH", json: { scheduleId, enabled } }),
  setScheduleEnabled: (scheduleEnabled: boolean) =>
    request<SecurityModesResponse>("/api/security-modes", { method: "PATCH", json: { scheduleEnabled } }),
};

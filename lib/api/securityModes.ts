import { request } from "./client";
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
}

export const securityModesApi = {
  get: () => request<SecurityModesResponse>("/api/security-modes"),
  activate: (activeModeId: SecurityModeId) => request<SecurityModesResponse>("/api/security-modes", { method: "PATCH", json: { activeModeId } }),
  setSetting: (modeId: SecurityModeId, settingKey: string, enabled: boolean) =>
    request<SecurityModesResponse>("/api/security-modes", { method: "PATCH", json: { modeId, settingKey, enabled } }),
  setSchedule: (scheduleId: string, enabled: boolean) =>
    request<SecurityModesResponse>("/api/security-modes", { method: "PATCH", json: { scheduleId, enabled } }),
  setScheduleEnabled: (scheduleEnabled: boolean) =>
    request<SecurityModesResponse>("/api/security-modes", { method: "PATCH", json: { scheduleEnabled } }),
};

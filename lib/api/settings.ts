import { request } from "./client";
import type { SettingsData, UserProfile } from "@/lib/types";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface SettingsResponse {
  settings: SettingsData;
  account: UserProfile;
}

export const settingsApi = {
  get: () => request<SettingsResponse>("/api/settings"),
  update: (patch: DeepPartial<SettingsData>) => request<SettingsResponse>("/api/settings", { method: "PATCH", json: patch }),
  reset: () => request<SettingsResponse>("/api/settings", { method: "POST", json: { action: "reset" } }),
  resetApp: () => request<SettingsResponse>("/api/settings", { method: "POST", json: { action: "resetApp" } }),
  exportData: () => request<{ exported: boolean; size: string; file: string }>("/api/settings", { method: "POST", json: { action: "export" } }),
};

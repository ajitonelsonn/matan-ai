import { request } from "./client";
import type { Device, DeviceKind } from "@/lib/types";

export interface DevicesResponse {
  items: Device[];
  summary: { total: number; online: number; offline: number; byKind: Record<DeviceKind, number> };
}

export const devicesApi = {
  list: () => request<DevicesResponse>("/api/devices"),
  get: (id: string) => request<Device>(`/api/devices/${id}`),
  add: (body: { name: string; kind: DeviceKind; location: string; model?: string }) =>
    request<Device>("/api/devices", { method: "POST", json: body }),
  update: (id: string, patch: Partial<Pick<Device, "name" | "location" | "status">> & { settings?: Partial<Device["settings"]> }) =>
    request<Device>(`/api/devices/${id}`, { method: "PATCH", json: patch }),
  run: (id: string, action: "test" | "restart") =>
    request<{ device: Device; result: string }>(`/api/devices/${id}`, { method: "PATCH", json: { action } }),
  remove: (id: string) => request<{ deleted: string }>(`/api/devices/${id}`, { method: "DELETE" }),
};

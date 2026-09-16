import { request, ApiError } from "./client";
import type { ConnectedRingDevice, RingDiscoveredDevice, RingErrorPayload, RingHistoryEvent, RingSessionInfo } from "@/lib/ring/types";

/**
 * Browser-side client for MATAN AI's Ring routes. The Playground token is sent
 * exactly once (POST body, HTTPS) to /api/ring/discover and is never kept here.
 */
export interface RingDevicesResponse {
  connected: ConnectedRingDevice[];
  session: RingSessionInfo | null;
}

export interface RingDiscoverResponse {
  devices: RingDiscoveredDevice[];
  count: number;
  session: RingSessionInfo;
}

export type DevicePick = { ringDeviceId: string; displayName?: string; locationLabel?: string; aiEnabled?: boolean; favorite?: boolean };

export const ringApi = {
  discover: (token: string) => request<RingDiscoverResponse>("/api/ring/discover", { method: "POST", json: { token } }),
  session: () => request<{ session: RingSessionInfo | null; discovered: RingDiscoveredDevice[] }>("/api/ring/session"),
  disconnect: () => request<{ session: null }>("/api/ring/session", { method: "DELETE" }),
  devices: () => request<RingDevicesResponse>("/api/ring/devices"),
  save: (devices: DevicePick[]) => request<RingDevicesResponse & { saved: ConnectedRingDevice[]; skipped: number }>("/api/ring/devices", { method: "POST", json: { devices } }),
  update: (id: string, patch: Partial<Pick<ConnectedRingDevice, "displayName" | "locationLabel" | "aiEnabled" | "favorite">>) =>
    request<ConnectedRingDevice>(`/api/ring/devices/${id}`, { method: "PATCH", json: patch }),
  remove: (id: string) => request<{ deleted: string; connected: ConnectedRingDevice[] }>(`/api/ring/devices/${id}`, { method: "DELETE" }),
  refresh: () => request<{ devices: RingDiscoveredDevice[]; connected: ConnectedRingDevice[]; session: RingSessionInfo }>("/api/ring/refresh", { method: "POST" }),
  status: (id: string) => request<{ device: ConnectedRingDevice; status: { online: boolean | null; reportedAt?: string } }>(`/api/ring/devices/${id}/status`),
  events: (id: string) => request<{ events: RingHistoryEvent[] }>(`/api/ring/devices/${id}/events`),
};

/** Extract the normalized Ring error payload from a failed request, if present. */
export function ringErrorFrom(e: unknown): RingErrorPayload | null {
  if (e instanceof ApiError && e.payload && typeof e.payload === "object" && "error" in e.payload) {
    const err = (e.payload as { error?: Partial<RingErrorPayload> }).error;
    if (err?.code) return { code: err.code, title: err.title ?? "Something went wrong", message: err.message ?? "", retryAfterSeconds: err.retryAfterSeconds };
  }
  return null;
}

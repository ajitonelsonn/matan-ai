import { request } from "./client";
import type { DashboardData, Notification } from "@/lib/types";

export const dashboardApi = {
  get: () => request<DashboardData>("/api/dashboard"),
  markAllRead: () => request<{ unread: number; notifications: Notification[] }>("/api/dashboard", { method: "PATCH", json: { markAllRead: true } }),
  markRead: (readId: string) => request<{ unread: number; notifications: Notification[] }>("/api/dashboard", { method: "PATCH", json: { readId } }),
};

"use client";

import { dashboardApi } from "@/lib/api/dashboard";
import { eventsApi, type EventQuery } from "@/lib/api/events";
import { insightsApi } from "@/lib/api/insights";
import { request, qs } from "@/lib/api/client";
import type { MatanDataSource, DataMode } from "./types";
import type { DashboardData, RingEvent } from "@/lib/types";
import type { EventListResponse } from "@/lib/api/events";
import { useAppMode } from "@/components/experience/experience-provider";

/** Demo: the mock API (in-memory store). */
export const demoDataSource: MatanDataSource = {
  mode: "demo",
  getDashboard: () => dashboardApi.get(),
  getEvents: (q) => eventsApi.list(q),
  getEvent: (id) => eventsApi.get(id),
  getInsights: (range) => insightsApi.get(range),
};

/** Real: the Ring Playground integration (server-side read model). */
/**
 * Events this browser is currently auto-analyzing via /api/matan/auto/step. The server's
 * in-flight state lives in one instance's memory, so on stateless hosting the client is the
 * only party that knows for sure; overlay "analyzing" on what it shows.
 */
const clientAnalyzing = new Set<string>();
export function markClientAnalyzing(id: string, on: boolean) {
  if (on) clientAnalyzing.add(id);
  else clientAnalyzing.delete(id);
}
function overlayClient<T extends { id: string; analysis?: RingEvent["analysis"] }>(e: T): T {
  return clientAnalyzing.has(e.id) && e.analysis !== "done" ? { ...e, analysis: "analyzing" } : e;
}

export const ringDataSource: MatanDataSource = {
  mode: "ring",
  getDashboard: () => request<DashboardData>("/api/ring/overview").then((d) => ({ ...d, latestEvents: d.latestEvents.map(overlayClient) })),
  getEvents: (q: EventQuery) => request<EventListResponse & { stale?: boolean }>(`/api/ring/overview/events${qs({ ...q, priority: q.priority?.join(",") })}`).then((r) => ({ ...r, items: r.items.map(overlayClient) })),
  getEvent: (id) => request<RingEvent>(`/api/ring/overview/events${qs({ id })}`).then(overlayClient),
  getInsights: (range, window) => request(`/api/ring/overview/insights${qs({ range, from: window?.from, to: window?.to })}`),
};

export function getDataSource(mode: DataMode): MatanDataSource {
  return mode === "ring" ? ringDataSource : demoDataSource;
}

/** The data source for the current experience mode. */
export function useDataSource(): MatanDataSource {
  return getDataSource(useAppMode());
}

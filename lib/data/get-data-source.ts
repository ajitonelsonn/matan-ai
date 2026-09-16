"use client";

import { dashboardApi } from "@/lib/api/dashboard";
import { eventsApi, type EventQuery } from "@/lib/api/events";
import { insightsApi } from "@/lib/api/insights";
import { request, qs } from "@/lib/api/client";
import type { MatanDataSource, DataMode } from "./types";
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
export const ringDataSource: MatanDataSource = {
  mode: "ring",
  getDashboard: () => request("/api/ring/overview"),
  getEvents: (q: EventQuery) => request(`/api/ring/overview/events${qs({ ...q, priority: q.priority?.join(",") })}`),
  getEvent: (id) => request(`/api/ring/overview/events${qs({ id })}`),
  getInsights: (range) => request(`/api/ring/overview/insights${qs({ range })}`),
};

export function getDataSource(mode: DataMode): MatanDataSource {
  return mode === "ring" ? ringDataSource : demoDataSource;
}

/** The data source for the current experience mode. */
export function useDataSource(): MatanDataSource {
  return getDataSource(useAppMode());
}

import { request, qs } from "./client";
import type { EventPriority, InsightRange, Paginated, RingEvent } from "@/lib/types";

export interface EventQuery {
  search?: string;
  category?: string;
  range?: InsightRange;
  priority?: EventPriority[];
  cameraId?: string;
  sort?: "newest" | "oldest" | "priority";
  page?: number;
  pageSize?: number;
}

export type EventListResponse = Paginated<RingEvent> & { categoryCounts: Record<string, number> };

export const eventsApi = {
  list: (q: EventQuery = {}) =>
    request<EventListResponse>(`/api/events${qs({ ...q, priority: q.priority?.join(",") })}`),
  get: (id: string) => request<RingEvent>(`/api/events/${id}`),
  byIds: (ids: string[]) => (ids.length ? request<EventListResponse>(`/api/events${qs({ ids: ids.join(",") })}`) : Promise.resolve({ items: [], meta: { total: 0, page: 1, pageSize: 0, hasMore: false }, categoryCounts: {} } as EventListResponse)),
  update: (id: string, patch: { starred?: boolean; reviewed?: boolean; actionId?: string; priority?: EventPriority }) =>
    request<RingEvent>(`/api/events/${id}`, { method: "PATCH", json: patch }),
  remove: (id: string) => request<{ deleted: string }>(`/api/events/${id}`, { method: "DELETE" }),
};

import type { DashboardData, InsightRange, InsightsData, RingEvent } from "@/lib/types";
import type { EventListResponse, EventQuery } from "@/lib/api/events";
import type { RingSessionInfo } from "@/lib/ring/types";

export type DataMode = "demo" | "ring";

/**
 * One interface, two implementations (spec §25). Pages never branch on mode to
 * pick an implementation - they call the data source they are given.
 */
export interface MatanDataSource {
  readonly mode: DataMode;
  getDashboard(): Promise<DashboardData & { stale?: boolean; ringSession?: RingSessionInfo | null }>;
  getEvents(query: EventQuery): Promise<EventListResponse & { stale?: boolean }>;
  getEvent(id: string): Promise<RingEvent>;
  getInsights(range: InsightRange): Promise<InsightsData & { stale?: boolean; totalHistory?: number }>;
}

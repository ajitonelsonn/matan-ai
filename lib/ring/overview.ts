import "server-only";
import type { DashboardData, EventCounts, EventPriority, InsightRange, InsightsData, Paginated, RingEvent } from "@/lib/types";
import { getRingDeviceEvents } from "./client";
import { getRingSession, listConnected, markInvalid, sessionInfo, usableToken } from "./session";
import { ringEventToMatan, ringToDevice } from "./adapter";
import { buildInsights, countEvents, eventsInRange } from "@/lib/mock/insights";
import { getStore } from "@/lib/mock/store";
import { user, weather } from "@/lib/mock/users";
import { isRingApiError } from "./errors";
import type { RingSessionInfo } from "./types";
import { getIntelligenceSync } from "@/lib/matan/store";
import { applyIntelligence, currentUserSettings } from "@/lib/matan/analysis";
import { markAnalyzingState, scheduleAutoAnalysis } from "@/lib/matan/auto";
import { runMatanPipeline } from "@/lib/matan/pipeline";

/**
 * Real-mode read model. Everything here is derived from the Ring Playground
 * (connected devices + event history). No mock events are ever mixed in.
 * Event history is cached per session for 60 s and kept after expiry so the
 * user still sees their previous Matan records ("Connection expired", not "offline").
 */
interface EventsCache {
  at: number;
  events: RingEvent[];
  errors: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __matanRingEventsCache: EventsCache | undefined;
}

const CACHE_MS = 60_000;

/** Overlay any completed Matan AI intelligence onto raw Ring events (analysis: pending → done). */
function withIntelligence(events: RingEvent[]) {
  return markAnalyzingState(
    events.map((e) => {
      const intel = getIntelligenceSync(e.id);
      return intel ? applyIntelligence(e, intel) : e;
    }),
  );
}

export async function getRingEvents(force = false): Promise<{ events: RingEvent[]; session: RingSessionInfo | null; stale: boolean }> {
  const session = await getRingSession();
  const token = usableToken(session);
  const cache = globalThis.__matanRingEventsCache;
  if (!token) return { events: withIntelligence(cache?.events ?? []), session: sessionInfo(session), stale: true };
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return { events: withIntelligence(cache.events), session: sessionInfo(session), stale: false };

  const connected = listConnected();
  const all: RingEvent[] = [];
  let errors = 0;
  await Promise.all(
    connected.map(async (d) => {
      try {
        const evs = await getRingDeviceEvents(token, d.ringDeviceId);
        for (const e of evs) all.push(ringEventToMatan(e, d));
      } catch (e) {
        errors += 1;
        if (isRingApiError(e) && (e.code === "RING_TOKEN_INVALID" || e.code === "RING_TOKEN_EXPIRED") && session) markInvalid(session);
      }
    }),
  );
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const ids = new Set<string>();
  const deduped = all.filter((e) => (ids.has(e.id) ? false : (ids.add(e.id), true)));
  all.length = 0;
  all.push(...deduped);
  globalThis.__matanRingEventsCache = { at: Date.now(), events: all, errors };
  // Fresh sync → auto-analyze new events in the background (never blocks this request).
  scheduleAutoAnalysis(all, (ev, o) => runMatanPipeline(ev, all, currentUserSettings(), { media: o.media, auto: true }));
  return { events: withIntelligence(all), session: sessionInfo(session), stale: false };
}

const realQuickQuestions = ["What happened today?", "What happened while I was away?", "Show unusual activity.", "Which devices are online?", "How many deliveries happened?", "Why did I receive an alert?"];

export async function buildRingDashboard(): Promise<DashboardData & { stale: boolean; ringSession: RingSessionInfo | null }> {
  const { events, session, stale } = await getRingEvents();
  const connected = listConnected();
  const devices = connected.map(ringToDevice);
  const today = eventsInRange(events, "today");
  const yesterday = eventsInRange(events, "today", 1);
  const todayCounts: EventCounts = countEvents(today);
  const pct = yesterday.length ? Math.round(((today.length - yesterday.length) / yesterday.length) * 100) : 0;
  const store = getStore();
  const active = store.securityModes.find((m) => m.id === store.activeModeId)!;
  return {
    user,
    weather,
    notifications: [],
    unreadNotifications: 0,
    todayCounts,
    todayVsYesterdayPct: pct,
    latestEvents: events.slice(0, 4),
    devices,
    activeModeId: store.activeModeId,
    activeModeName: active.name,
    quickQuestions: realQuickQuestions,
    featuredCameraId: connected.find((d) => d.details.video !== false)?.id ?? connected[0]?.id ?? "",
    stale,
    ringSession: session,
  };
}

const categoryTypes: Record<string, RingEvent["type"][]> = {
  all: ["person", "package", "vehicle", "animal", "doorbell", "unusual", "other"],
  people: ["person"],
  packages: ["package"],
  vehicles: ["vehicle"],
  animals: ["animal"],
  doorbell: ["doorbell"],
  others: ["other", "unusual"],
};

export async function buildRingEventList(params: URLSearchParams): Promise<Paginated<RingEvent> & { categoryCounts: Record<string, number>; stale: boolean; ringSession: RingSessionInfo | null }> {
  const { events, session, stale } = await getRingEvents();
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const category = params.get("category") ?? "all";
  const range = (params.get("range") ?? "7d") as InsightRange;
  const cameraId = params.get("cameraId");
  const priority = params.get("priority")?.split(",").filter(Boolean) as EventPriority[] | undefined;
  const sort = params.get("sort") ?? "newest";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));

  let list = eventsInRange(events, range === "custom" ? "custom" : range);
  // Ring history may be older than the demo ranges; if the range filter empties everything, fall back to all history so the user sees real data.
  if (!list.length && events.length && range === "7d") list = events;
  if (cameraId) list = list.filter((e) => e.cameraId === cameraId);
  if (search) list = list.filter((e) => [e.title, e.location, e.summary, ...e.tags].some((f) => f.toLowerCase().includes(search)));
  const categoryCounts: Record<string, number> = {};
  for (const [key, types] of Object.entries(categoryTypes)) categoryCounts[key] = list.filter((e) => types.includes(e.type)).length;
  list = list.filter((e) => (categoryTypes[category] ?? categoryTypes.all).includes(e.type));
  if (priority?.length) list = list.filter((e) => priority.includes(e.priority));
  list = [...list].sort((a, b) => (sort === "oldest" ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  const total = list.length;
  return { items: list.slice((page - 1) * pageSize, page * pageSize), meta: { total, page, pageSize, hasMore: page * pageSize < total }, categoryCounts, stale, ringSession: session };
}

export async function findRingEvent(id: string) {
  const { events } = await getRingEvents();
  return events.find((e) => e.id === id) ?? null;
}

export async function buildRingInsights(range: InsightRange): Promise<InsightsData & { stale: boolean; ringSession: RingSessionInfo | null; totalHistory: number }> {
  const { events, session, stale } = await getRingEvents();
  const names = Object.fromEntries(listConnected().map((d) => [d.id, d.displayName]));
  const data = buildInsights(events, range, names);
  // Never claim AI findings for un-analysed Ring events.
  data.summary = events.length
    ? `Matan AI has ${events.length} Ring Simulator ${events.length === 1 ? "event" : "events"} on record across ${listConnected().length} connected ${listConnected().length === 1 ? "device" : "devices"}. AI analysis of Ring events starts with the Bedrock milestone - counts below are from Ring event history only.`
    : "No Ring events have been recorded yet. Trigger a Package, Vehicle or Motion simulation in the Ring Playground and refresh.";
  data.findingNote = events.length ? `${events.length} Ring events recorded. Priority classification is pending Matan AI analysis.` : "Waiting for Ring events.";
  data.recommendations = [
    { id: "r-ring-1", title: "Trigger a simulation in the Playground", description: "Package, Vehicle or Motion events appear here after refresh.", tone: "primary", icon: "Sparkles" },
    { id: "r-ring-2", title: "Keep the Playground session alive", description: "Tokens expire after 30 minutes; reconnect to keep syncing.", tone: "warning", icon: "Clock" },
  ];
  return { ...data, stale, ringSession: session, totalHistory: events.length };
}

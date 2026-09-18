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
import { currentUser, currentUserSub, withUser } from "@/lib/auth/server";
import { SK, putIfAbsent, queryPrefix, stripKeys, userPK } from "@/lib/aws/dynamodb";

/**
 * Real-mode read model. Everything here is derived from the Ring Playground
 * (connected devices + event history). No mock events are ever mixed in.
 * Event history is cached per user for 60 s and persisted to DynamoDB
 * (PK=USER#{sub}, SK=EVENT#{eventId}) so it survives restarts and token expiry:
 * the user still sees their previous Matan records ("Connection expired", not "offline").
 */
interface EventsCache {
  /** 0 = hydrated from DynamoDB only, never synced from Ring in this process. */
  at: number;
  events: RingEvent[];
  errors: number;
  /** Event ids already written to DynamoDB (idempotent sync). */
  persisted: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __matanRingEventsCache: Map<string, EventsCache> | undefined;
}

const CACHE_MS = 60_000;
/** Cap on history kept per user in DynamoDB/cache; Ring Playground history is small anyway. */
const MAX_PERSISTED_EVENTS = 2000;

type EventItem = { PK: string; SK: string; type: "EVENT"; event: RingEvent; timestamp: string };

function caches() {
  if (!globalThis.__matanRingEventsCache) globalThis.__matanRingEventsCache = new Map();
  return globalThis.__matanRingEventsCache;
}

/** Load a user's persisted Ring events into the cache (once per process). */
export async function hydrateRingEvents(sub: string, force = false) {
  if (!force && caches().has(sub)) return;
  const items = await queryPrefix<EventItem>(userPK(sub), "EVENT#");
  const events = items.map((it) => stripKeys<EventItem>(it as unknown as Record<string, unknown>).event).filter(Boolean);
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  caches().set(sub, { at: 0, events, errors: 0, persisted: new Set(events.map((e) => e.id)) });
  console.info({ event: "dynamodb_hydrated", kind: "events", count: events.length });
}

/** Write newly synced events (normalized, token-free) - PutItem with attribute_not_exists so re-syncs never duplicate. */
async function persistNewEvents(sub: string, cache: EventsCache, events: RingEvent[]) {
  const fresh = events.filter((e) => !cache.persisted.has(e.id)).slice(0, MAX_PERSISTED_EVENTS);
  if (!fresh.length) return;
  // Strip volatile overlay fields; intelligence lives under ANALYSIS# and is re-applied on read.
  const bare = (e: RingEvent): RingEvent => {
    const { intelligence: _i, analysis: _a, ...rest } = e;
    return { ...rest, analysis: "pending" };
  };
  let written = 0;
  for (const batch of chunk(fresh, 10)) {
    await Promise.all(
      batch.map(async (e) => {
        try {
          await putIfAbsent({ PK: userPK(sub), SK: SK.event(e.id), type: "EVENT", eventId: e.id, timestamp: e.timestamp, event: bare(e) });
          written += 1;
        } catch (err) {
          console.error({ event: "ring_event_persist_failed", eventId: e.id, code: (err as { code?: string })?.code });
          return;
        }
        cache.persisted.add(e.id);
      }),
    );
  }
  if (written) console.info({ event: "ring_events_persisted", count: written });
}

function chunk<T>(arr: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

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
  const sub = currentUserSub();
  await hydrateRingEvents(sub);
  const session = await getRingSession();
  const token = usableToken(session);
  const cache = caches().get(sub)!;
  if (!token) return { events: withIntelligence(cache.events), session: sessionInfo(session), stale: true };
  if (!force && cache.at && Date.now() - cache.at < CACHE_MS) return { events: withIntelligence(cache.events), session: sessionInfo(session), stale: false };

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
  // Merge with persisted history (Ring's history window is limited; DynamoDB keeps what we have seen).
  for (const e of cache.events) all.push(e);
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const ids = new Set<string>();
  const deduped = all.filter((e) => (ids.has(e.id) ? false : (ids.add(e.id), true)));
  all.length = 0;
  all.push(...deduped);
  cache.at = Date.now();
  cache.events = all;
  cache.errors = errors;
  await persistNewEvents(sub, cache, all);
  // Fresh sync → auto-analyze new events in the background (never blocks this request); runs as this user.
  const user = currentUser()!;
  scheduleAutoAnalysis(all, (ev, o) => withUser(user, () => runMatanPipeline(ev, all, currentUserSettings(), { media: o.media, auto: true })));
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

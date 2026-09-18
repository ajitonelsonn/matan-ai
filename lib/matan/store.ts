import type { MatanEventIntelligence } from "./schema";
import { currentUser, currentUserSub } from "@/lib/auth/server";
import { SK, getItem, putItem, queryPrefix, stripKeys, userPK } from "@/lib/aws/dynamodb";

/** Persistence boundary. DynamoDB-backed (PK=USER#{sub}, SK=ANALYSIS#{eventId}) with a per-user read cache. */
export interface MatanIntelligenceStore {
  get(eventId: string): Promise<MatanEventIntelligence | null>;
  save(eventId: string, intelligence: MatanEventIntelligence): Promise<void>;
  all(): Promise<Record<string, MatanEventIntelligence>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __matanIntelligence: Map<string, Map<string, MatanEventIntelligence>> | undefined;
  // eslint-disable-next-line no-var
  var __matanIntelligenceHydrated: Set<string> | undefined;
}

/** Per-user cache: sub → (eventId → intelligence). Written through to DynamoDB. */
function cacheFor(sub: string) {
  if (!globalThis.__matanIntelligence) globalThis.__matanIntelligence = new Map();
  let m = globalThis.__matanIntelligence.get(sub);
  if (!m) {
    m = new Map();
    globalThis.__matanIntelligence.set(sub, m);
  }
  return m;
}

function hydratedSet() {
  if (!globalThis.__matanIntelligenceHydrated) globalThis.__matanIntelligenceHydrated = new Set();
  return globalThis.__matanIntelligenceHydrated;
}

type AnalysisItem = { PK: string; SK: string; eventId: string; intelligence: MatanEventIntelligence };

/** Load all of a user's analyses from DynamoDB into the cache (once per process). */
export async function hydrateIntelligence(sub: string, force = false) {
  if (!force && hydratedSet().has(sub)) return;
  const items = await queryPrefix<AnalysisItem>(userPK(sub), "ANALYSIS#");
  const m = cacheFor(sub);
  for (const it of items) if (it.eventId && it.intelligence) m.set(it.eventId, it.intelligence);
  hydratedSet().add(sub);
  console.info({ event: "dynamodb_hydrated", kind: "analyses", count: items.length });
}

export const dynamoIntelligenceStore: MatanIntelligenceStore = {
  async get(eventId) {
    const sub = currentUserSub();
    const cached = cacheFor(sub).get(eventId);
    if (cached) return cached;
    const item = await getItem<AnalysisItem>(userPK(sub), SK.analysis(eventId));
    if (item?.intelligence) cacheFor(sub).set(eventId, item.intelligence);
    return item?.intelligence ?? null;
  },
  async save(eventId, intelligence) {
    const sub = currentUserSub();
    cacheFor(sub).set(eventId, intelligence);
    await putItem({ PK: userPK(sub), SK: SK.analysis(eventId), type: "ANALYSIS", eventId, intelligence, analyzedAt: intelligence.analyzedAt });
  },
  async all() {
    const sub = currentUserSub();
    await hydrateIntelligence(sub);
    return Object.fromEntries(cacheFor(sub));
  },
};

/** Kept for callers/tests that need a process-local store (no user, no DynamoDB). */
const localMap = new Map<string, MatanEventIntelligence>();
export const memoryIntelligenceStore: MatanIntelligenceStore = {
  async get(eventId) {
    return localMap.get(eventId) ?? null;
  },
  async save(eventId, intelligence) {
    localMap.set(eventId, intelligence);
  },
  async all() {
    return Object.fromEntries(localMap);
  },
};

/** Synchronous read from the current user's cache (Ring read model merges intelligence into events). */
export function getIntelligenceSync(eventId: string) {
  const u = currentUser();
  return u ? cacheFor(u.sub).get(eventId) ?? null : localMap.get(eventId) ?? null;
}

export function stripAnalysisItem(item: Record<string, unknown>) {
  return stripKeys<{ eventId: string; intelligence: MatanEventIntelligence }>(item);
}

/** In-flight guard so a double click never triggers two Bedrock invocations. */
const inFlight = new Set<string>();
export function beginAnalysis(eventId: string) {
  if (inFlight.has(eventId)) return false;
  inFlight.add(eventId);
  return true;
}
export function endAnalysis(eventId: string) {
  inFlight.delete(eventId);
}
export function isAnalyzing(eventId: string) {
  return inFlight.has(eventId);
}

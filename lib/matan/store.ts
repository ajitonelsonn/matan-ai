import type { MatanEventIntelligence } from "./schema";
import { currentUser, currentUserSub } from "@/lib/auth/server";
import { SK, deleteItem, getItem, putItem, queryPrefix, stripKeys, userPK } from "@/lib/aws/dynamodb";

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
  const [items, failed] = await Promise.all([queryPrefix<AnalysisItem>(userPK(sub), "ANALYSIS#"), queryPrefix<{ eventId: string; code: string; at: string }>(userPK(sub), FAIL_PREFIX).catch(() => [])]);
  const m = cacheFor(sub);
  for (const it of items) if (it.eventId && it.intelligence) m.set(it.eventId, it.intelligence);
  // Failure marks are shared across server instances so every instance shows the same state.
  for (const f of failed) if (f.eventId && f.code && !m.has(f.eventId)) failures().set(f.eventId, { code: f.code, at: f.at });
  hydratedSet().add(sub);
  console.info({ event: "dynamodb_hydrated", kind: "analyses", count: items.length, failed: failed.length });
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

/**
 * In-flight guard + processing stage so a double click never triggers two Bedrock
 * invocations and the UI can show capturing → analyzing. Failures are remembered
 * (per event) until the next successful analysis so the dashboard can show "failed".
 */
export type AnalysisStage = "capturing" | "analyzing";
interface InFlight {
  stage: AnalysisStage;
  startedAt: string;
}
declare global {
  // eslint-disable-next-line no-var
  var __matanInFlight: Map<string, InFlight> | undefined;
  // eslint-disable-next-line no-var
  var __matanAnalysisFailures: Map<string, { code: string; at: string }> | undefined;
}
const inFlight = () => (globalThis.__matanInFlight ??= new Map());
const failures = () => (globalThis.__matanAnalysisFailures ??= new Map());

export function beginAnalysis(eventId: string) {
  if (inFlight().has(eventId)) return false;
  inFlight().set(eventId, { stage: "capturing", startedAt: new Date().toISOString() });
  return true;
}
export function setAnalysisStage(eventId: string, stage: AnalysisStage) {
  const f = inFlight().get(eventId);
  if (f) f.stage = stage;
}
export function endAnalysis(eventId: string) {
  inFlight().delete(eventId);
}
export function isAnalyzing(eventId: string) {
  return inFlight().has(eventId);
}
export function analysisStage(eventId: string): AnalysisStage | null {
  return inFlight().get(eventId)?.stage ?? null;
}
const FAIL_PREFIX = "AIFAIL#";
/** Remember a failure in memory and (best effort) in DynamoDB so a stateless runtime agrees across instances. */
export async function markAnalysisFailed(eventId: string, code: string) {
  const at = new Date().toISOString();
  failures().set(eventId, { code, at });
  const u = currentUser();
  if (u) await putItem({ PK: userPK(u.sub), SK: `${FAIL_PREFIX}${eventId}`, type: "ANALYSIS_FAILED", eventId, code, at }).catch(() => undefined);
}
export async function clearAnalysisFailure(eventId: string) {
  const had = failures().delete(eventId);
  const u = currentUser();
  if (u && had) await deleteItem(userPK(u.sub), `${FAIL_PREFIX}${eventId}`).catch(() => undefined);
}
export function analysisFailure(eventId: string) {
  return failures().get(eventId) ?? null;
}

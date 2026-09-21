import "server-only";
import type { RingEvent } from "@/lib/types";
import { getUserSettings } from "./user-settings";
import { budgetSnapshot } from "./budget";
import { analysisFailure, analysisStage, getIntelligenceSync, isAnalyzing } from "./store";
import { getMediaMetaSync } from "./media-store";
import { getNotificationSync } from "./notifications";
import { currentUserSettings, relatedRecent, shouldAnalyze } from "./analysis";
import { currentUser } from "@/lib/auth/server";
import { getItem, putItem, userPK } from "@/lib/aws/dynamodb";

/**
 * Automatic analysis of NEW Ring events (Real Mode).
 * Guards against the Ring feedback loop (every media request creates an on_demand
 * history entry), a backlog burst on first sync, and runaway cost.
 *
 * Stateless-runtime design (Amplify SSR compute = short-lived Lambda instances that are
 * frozen the moment a response is sent): a sync only RECORDS pending event ids - persisted
 * per user together with the watermark (SK=AUTO_STATE) - and the browser drives execution
 * by calling POST /api/matan/auto/step, which analyzes one event inside its own request.
 */
interface AutoState {
  /** Newest event start (ms) seen at the previous sync; only newer events are auto-analyzed. */
  watermarkMs: number | null;
  /** Event ids already queued/handled (recent, bounded). */
  seen: Set<string>;
  /** Media requests Matan itself made (ms) - the on_demand entry each one creates on Ring is skipped, at most one event per request. */
  ownMediaRequests: { at: number; claimedBy?: string }[];
  /** Sliding-window rate limit (run timestamps, ms). */
  runs: number[];
  /** Event ids waiting to be analyzed by the next step request. */
  pending: string[];
  hydrated: boolean;
}

interface PersistedAutoState {
  watermarkMs: number | null;
  runs: number[];
  pending: string[];
  seen: string[];
}

declare global {
  // eslint-disable-next-line no-var
  var __matanAuto: Map<string, AutoState> | undefined;
}

const AUTO_SK = "AUTO_STATE";
const MAX_PER_HOUR = 30;
const MAX_PER_SYNC = 5;
const MAX_PENDING = 20;
const MAX_SEEN = 200;
/** Ring records Matan's own snapshot/clip request as an on_demand session starting within seconds of the request. */
const OWN_REQUEST_BEFORE_MS = 5_000;
const OWN_REQUEST_AFTER_MS = 20_000;
const OWN_REQUEST_KEEP_MS = 10 * 60 * 1000;
/** Matan's snapshot/clip request opens a session for a moment; Playground scenarios run ~20 s. */
const OWN_MAX_DURATION_S = 6;

/** Auto-analysis bookkeeping is per user (watermark, queue, rate limit). */
function state(): AutoState {
  if (!globalThis.__matanAuto) globalThis.__matanAuto = new Map();
  const key = currentUser()?.sub ?? "anonymous";
  let s = globalThis.__matanAuto.get(key);
  if (!s) {
    s = { watermarkMs: null, seen: new Set(), ownMediaRequests: [], runs: [], pending: [], hydrated: false };
    globalThis.__matanAuto.set(key, s);
  }
  return s;
}

/** Load the user's persisted scheduler state once per process (watermark, pending ids, rate window). */
export async function hydrateAutoState(sub: string) {
  const all = (globalThis.__matanAuto ??= new Map());
  let s = all.get(sub);
  if (!s) {
    s = { watermarkMs: null, seen: new Set(), ownMediaRequests: [], runs: [], pending: [], hydrated: false };
    all.set(sub, s);
  }
  if (s.hydrated) return;
  const item = await getItem<{ state?: PersistedAutoState }>(userPK(sub), AUTO_SK).catch(() => null);
  if (item?.state) {
    s.watermarkMs = item.state.watermarkMs ?? null;
    s.runs = Array.isArray(item.state.runs) ? item.state.runs : [];
    s.pending = Array.isArray(item.state.pending) ? item.state.pending : [];
    s.seen = new Set(Array.isArray(item.state.seen) ? item.state.seen : []);
  }
  s.hydrated = true;
  console.info({ event: "dynamodb_hydrated", kind: "auto", pending: s.pending.length, watermark: s.watermarkMs ? new Date(s.watermarkMs).toISOString() : null });
}

async function persistAutoState(s: AutoState) {
  const u = currentUser();
  if (!u) return;
  const state: PersistedAutoState = { watermarkMs: s.watermarkMs, runs: s.runs, pending: s.pending, seen: [...s.seen].slice(-MAX_SEEN) };
  await putItem({ PK: userPK(u.sub), SK: AUTO_SK, type: "AUTO_STATE", state, updatedAt: new Date().toISOString() }).catch((e) => console.warn({ event: "auto_state_persist_failed", reason: (e as Error)?.message }));
}

/** Number of events waiting for an auto-analysis step (drives the browser's step loop). */
export function autoPendingCount() {
  return state().pending.length;
}
export function autoPendingIds() {
  return state().pending.slice(0, 5);
}

/** Call whenever Matan requests media from Ring (snapshot/clip) so the resulting on_demand entry is ignored. */
export function noteOwnMediaRequest() {
  const s = state();
  const now = Date.now();
  s.ownMediaRequests = [...s.ownMediaRequests.filter((r) => now - r.at < OWN_REQUEST_KEEP_MS), { at: now }];
}

/**
 * An on_demand event is Matan's own footprint only if it starts within a few seconds of a
 * media request Matan made, and that request hasn't already been matched to another event.
 * A user-triggered Playground scenario minutes later is therefore never swallowed.
 */
function isOwnOnDemand(e: RingEvent) {
  if (e.ringEventType !== "on_demand") return false;
  if ((e.clipDuration ?? 0) > OWN_MAX_DURATION_S) return false; // a real (user/Playground) session, not our footprint
  const start = new Date(e.timestamp).getTime();
  const reqs = state().ownMediaRequests;
  if (reqs.some((r) => r.claimedBy === e.id)) return true;
  const match = reqs.find((r) => !r.claimedBy && start >= r.at - OWN_REQUEST_BEFORE_MS && start <= r.at + OWN_REQUEST_AFTER_MS);
  if (!match) return false;
  match.claimedBy = e.id;
  return true;
}

export function autoSettings() {
  const ai = getUserSettings().ai;
  return { mode: ai.autoAnalyze ?? "off", includeLiveView: ai.autoIncludeLiveView ?? false, padSeconds: ai.mediaPadSeconds ?? 5 };
}

export type Analyzer = (event: RingEvent, opts: { media: "auto" | "snapshot" | "video"; auto: true }) => Promise<unknown>;

/**
 * Decide which freshly synced events should be analyzed and record them as pending.
 * Nothing runs here: the browser calls POST /api/matan/auto/step to analyze them one by one,
 * each inside its own request (works on stateless hosting; never blocks the sync request).
 */
export async function scheduleAutoAnalysis(events: RingEvent[]) {
  const s = state();
  const cfg = autoSettings();
  const newest = events.reduce((m, e) => Math.max(m, new Date(e.timestamp).getTime()), 0);

  if (s.watermarkMs === null) {
    // First sync ever for this user: don't analyze the whole backlog - only events from now on.
    s.watermarkMs = newest;
    await persistAutoState(s);
    console.info({ event: "matan_auto_watermark", watermark: new Date(newest).toISOString(), mode: cfg.mode });
    return { queued: 0, reason: "initial sync - watermark set" };
  }
  if (cfg.mode === "off") return { queued: 0, reason: "auto-analysis off" };
  if (budgetSnapshot().exhausted) return { queued: 0, reason: "budget exhausted" };

  const settings = currentUserSettings();
  // Explain why fresh events were not queued (visible in the server log per sync).
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
    return false;
  };
  const fresh = events.filter((e) => new Date(e.timestamp).getTime() > (s.watermarkMs ?? 0));
  const candidates = fresh
    .filter((e) => (s.seen.has(e.id) || s.pending.includes(e.id) ? skip("already queued") : getIntelligenceSync(e.id) ? skip("already analyzed") : analysisFailure(e.id) ? skip("failed earlier - retry manually") : isAnalyzing(e.id) ? skip("in progress") : true))
    .filter((e) => (isOwnOnDemand(e) ? skip("own media request (on_demand)") : true))
    .filter((e) => {
      if (e.ringEventType === "on_demand") return cfg.includeLiveView ? true : skip("live view sessions excluded by settings");
      const gate = shouldAnalyze(e, relatedRecent(e, events), settings);
      return gate.ok ? true : skip(`gate: ${gate.reason}`);
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, MAX_PER_SYNC);

  const moved = s.watermarkMs !== Math.max(s.watermarkMs, newest);
  s.watermarkMs = Math.max(s.watermarkMs, newest);
  if (fresh.length && Object.keys(skipped).length) console.info({ event: "matan_auto_skipped", fresh: fresh.map((e) => `${e.id}:${e.ringEventType ?? e.type}:${e.clipDuration ?? 0}s`), skipped });
  if (!candidates.length) {
    if (moved) await persistAutoState(s);
    return { queued: 0, reason: "no new candidates" };
  }

  const now = Date.now();
  s.runs = s.runs.filter((t) => now - t < 3_600_000);
  const room = Math.max(0, MAX_PER_HOUR - s.runs.length - s.pending.length);
  const toQueue = candidates.slice(0, Math.max(0, Math.min(room, MAX_PENDING - s.pending.length)));
  toQueue.forEach((e) => {
    s.seen.add(e.id);
    s.pending.push(e.id);
  });
  if (candidates.length > toQueue.length) console.warn({ event: "matan_auto_rate_limited", skipped: candidates.length - toQueue.length });
  console.info({ event: "matan_auto_queued", count: toQueue.length, pending: s.pending.length, mode: cfg.mode });
  await persistAutoState(s);
  return { queued: toQueue.length, reason: "queued" };
}

/**
 * Run ONE pending auto-analysis inside the current request (called by the browser via
 * POST /api/matan/auto/step). Awaits the whole pipeline - analysis, storage and the alert
 * email - so nothing is left running after the response.
 */
export async function runAutoStep(events: RingEvent[], analyze: Analyzer): Promise<{ eventId: string | null; ok: boolean; code?: string; pending: number; nextId?: string | null }> {
  const s = state();
  const cfg = autoSettings();
  if (cfg.mode === "off") {
    if (s.pending.length) {
      s.pending = [];
      await persistAutoState(s);
    }
    return { eventId: null, ok: true, pending: 0 };
  }
  // Drop ids that no longer need work (analyzed elsewhere, failed, or gone from history).
  while (s.pending.length) {
    const id = s.pending[0];
    const ev = events.find((e) => e.id === id);
    if (ev && !getIntelligenceSync(id) && !analysisFailure(id) && !isAnalyzing(id)) break;
    s.pending.shift();
  }
  const id = s.pending[0];
  if (!id) {
    await persistAutoState(s);
    return { eventId: null, ok: true, pending: 0 };
  }
  const ev = events.find((e) => e.id === id)!;
  s.runs = [...s.runs.filter((t) => Date.now() - t < 3_600_000), Date.now()];
  try {
    await analyze(ev, { media: cfg.mode === "video" ? "auto" : "snapshot", auto: true });
    console.info({ event: "matan_auto_analyzed", eventId: id });
    s.pending = s.pending.filter((x) => x !== id);
    await persistAutoState(s);
    return { eventId: id, ok: true, pending: s.pending.length, nextId: s.pending[0] ?? null };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "error";
    console.error({ event: "matan_auto_failed", eventId: id, code });
    s.pending = s.pending.filter((x) => x !== id);
    await persistAutoState(s);
    return { eventId: id, ok: false, code, pending: s.pending.length, nextId: s.pending[0] ?? null };
  }
}

/**
 * Overlay live processing state onto events for the UI: stage (capturing/analyzing),
 * last failure, notification outcome and real timeline timestamps.
 */
export function overlayProcessingState(events: RingEvent[]) {
  return events.map((e) => {
    const stage = analysisStage(e.id);
    const failure = analysisFailure(e.id);
    const notification = getNotificationSync(e.id) ?? undefined;
    const snapshot = getMediaMetaSync(e.id, "snapshot");
    const processing: NonNullable<RingEvent["processing"]> = { receivedAt: e.timestamp };
    if (snapshot?.createdAt) processing.capturedAt = snapshot.capturedAt ?? snapshot.createdAt;
    if (e.intelligence?.analyzedAt) processing.analyzedAt = e.intelligence.analyzedAt;
    if (notification?.sentAt) processing.notifiedAt = notification.sentAt;
    const analysis: RingEvent["analysis"] = stage ? stage : e.analysis === "done" ? "done" : failure ? "failed" : (e.analysis ?? "pending");
    return { ...e, analysis, analysisError: !stage && analysis === "failed" && failure ? failure : undefined, notification, processing };
  });
}

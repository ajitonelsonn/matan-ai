import "server-only";
import type { RingEvent } from "@/lib/types";
import { getUserSettings } from "./user-settings";
import { budgetSnapshot } from "./budget";
import { analysisFailure, analysisStage, getIntelligenceSync, isAnalyzing } from "./store";
import { getMediaMetaSync } from "./media-store";
import { getNotificationSync } from "./notifications";
import { currentUserSettings, relatedRecent, shouldAnalyze } from "./analysis";
import { currentUser } from "@/lib/auth/server";

/**
 * Automatic analysis of NEW Ring events (Real Mode).
 * Guards against the Ring feedback loop (every media request creates an on_demand
 * history entry), a backlog burst on first sync, and runaway cost.
 */
interface AutoState {
  /** Newest event start (ms) seen at the previous sync; only newer events are auto-analyzed. */
  watermarkMs: number | null;
  /** Event ids already queued/handled. */
  seen: Set<string>;
  /** Timestamps (ms) of media requests Matan itself made - the on_demand entries they create are skipped. */
  ownMediaRequests: number[];
  /** Sliding-window rate limit. */
  runs: number[];
  running: number;
  queue: RingEvent[];
}

declare global {
  // eslint-disable-next-line no-var
  var __matanAuto: Map<string, AutoState> | undefined;
}

const MAX_PER_HOUR = 30;
const MAX_PER_SYNC = 5;
const CONCURRENCY = 2;
const OWN_REQUEST_WINDOW_MS = 3 * 60 * 1000;

/** Auto-analysis bookkeeping is per user (watermark, queue, rate limit). */
function state(): AutoState {
  if (!globalThis.__matanAuto) globalThis.__matanAuto = new Map();
  const key = currentUser()?.sub ?? "anonymous";
  let s = globalThis.__matanAuto.get(key);
  if (!s) {
    s = { watermarkMs: null, seen: new Set(), ownMediaRequests: [], runs: [], running: 0, queue: [] };
    globalThis.__matanAuto.set(key, s);
  }
  return s;
}

/** Call whenever Matan requests media from Ring (snapshot/clip) so the resulting on_demand entry is ignored. */
export function noteOwnMediaRequest() {
  const s = state();
  const now = Date.now();
  s.ownMediaRequests = [...s.ownMediaRequests.filter((t) => now - t < OWN_REQUEST_WINDOW_MS * 2), now];
}

function isOwnOnDemand(e: RingEvent) {
  if (e.ringEventType !== "on_demand") return false;
  const start = new Date(e.timestamp).getTime();
  return state().ownMediaRequests.some((t) => start >= t - 5_000 && start <= t + OWN_REQUEST_WINDOW_MS);
}

export function autoSettings() {
  const ai = getUserSettings().ai;
  return { mode: ai.autoAnalyze ?? "off", includeLiveView: ai.autoIncludeLiveView ?? false, padSeconds: ai.mediaPadSeconds ?? 5 };
}

export type Analyzer = (event: RingEvent, opts: { media: "auto" | "snapshot" | "video"; auto: true }) => Promise<unknown>;

/**
 * Decide which freshly synced events to analyze and run them in the background.
 * Never blocks the request that synced the events.
 */
export function scheduleAutoAnalysis(events: RingEvent[], analyze: Analyzer) {
  const s = state();
  const cfg = autoSettings();
  const newest = events.reduce((m, e) => Math.max(m, new Date(e.timestamp).getTime()), 0);

  if (s.watermarkMs === null) {
    // First sync: don't analyze the whole backlog - only events from now on.
    s.watermarkMs = newest;
    console.info({ event: "matan_auto_watermark", watermark: new Date(newest).toISOString(), mode: cfg.mode });
    return { queued: 0, reason: "initial sync - watermark set" };
  }
  if (cfg.mode === "off") return { queued: 0, reason: "auto-analysis off" };
  if (budgetSnapshot().exhausted) return { queued: 0, reason: "budget exhausted" };

  const settings = currentUserSettings();
  const candidates = events
    .filter((e) => new Date(e.timestamp).getTime() > (s.watermarkMs ?? 0))
    .filter((e) => !s.seen.has(e.id) && !getIntelligenceSync(e.id) && !isAnalyzing(e.id))
    .filter((e) => !isOwnOnDemand(e))
    .filter((e) => (e.ringEventType === "on_demand" ? cfg.includeLiveView : shouldAnalyze(e, relatedRecent(e, events), settings).ok))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(0, MAX_PER_SYNC);

  s.watermarkMs = Math.max(s.watermarkMs, newest);
  if (!candidates.length) return { queued: 0, reason: "no new candidates" };

  const now = Date.now();
  s.runs = s.runs.filter((t) => now - t < 3_600_000);
  const room = Math.max(0, MAX_PER_HOUR - s.runs.length);
  const toRun = candidates.slice(0, room);
  toRun.forEach((e) => {
    s.seen.add(e.id);
    s.runs.push(now);
    s.queue.push(e);
  });
  if (candidates.length > room) console.warn({ event: "matan_auto_rate_limited", skipped: candidates.length - room });
  console.info({ event: "matan_auto_queued", count: toRun.length, mode: cfg.mode });
  void pump(analyze, cfg.mode === "video" ? "auto" : "snapshot");
  return { queued: toRun.length, reason: "queued" };
}

async function pump(analyze: Analyzer, media: "auto" | "snapshot") {
  const s = state();
  while (s.running < CONCURRENCY && s.queue.length) {
    const ev = s.queue.shift()!;
    s.running += 1;
    analyze(ev, { media, auto: true })
      .then(() => console.info({ event: "matan_auto_analyzed", eventId: ev.id }))
      .catch((e) => console.error({ event: "matan_auto_failed", eventId: ev.id, code: (e as { code?: string })?.code ?? "error" }))
      .finally(() => {
        s.running -= 1;
        void pump(analyze, media);
      });
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

import "server-only";
import type { RingEvent } from "@/lib/types";
import { getRingSnapshot, getRingClip, MAX_CLIP_MS } from "@/lib/ring/client";
import { getRingSession, listConnected, usableToken } from "@/lib/ring/session";
import type { NovaMedia } from "@/lib/bedrock/nova";
import { analyzeEvent, buildMatanContext, type UserSettingsForAnalysis } from "./analysis";
import { shouldEscalateToVideo } from "./escalation";
import { budgetSnapshot } from "./budget";
import { beginAnalysis, endAnalysis, memoryIntelligenceStore, saveMedia } from "./store";
import { MatanAiError } from "./errors";
import { autoSettings, noteOwnMediaRequest } from "./auto";
import type { MatanEventIntelligence } from "./schema";

export interface PipelineResult {
  intelligence: MatanEventIntelligence;
  escalation: { attempted: boolean; reason: string; applied: boolean };
}

/** Media window = event start−pad … end+pad (pad from settings, 5 or 10 s). */
function mediaWindow(event: RingEvent, padSeconds: number) {
  const now = Date.now() - 1500; // Ring rejects timestamps in the future
  const start = Math.min(new Date(event.timestamp).getTime(), now);
  const end = Math.min(start + Math.max(1, event.clipDuration ?? 20) * 1000, now);
  const pad = padSeconds * 1000;
  const from = start - pad;
  const to = Math.min(end + pad, now);
  return { from, to, durationMs: Math.max(1000, Math.min(MAX_CLIP_MS, to - from)) };
}

/** Server-side snapshot inside the padded event window. Never exposes the Ring token. */
async function obtainRingMedia(event: RingEvent, padSeconds: number): Promise<{ media: NovaMedia | null; note?: string }> {
  const device = listConnected().find((d) => d.id === event.cameraId);
  if (!device) return { media: null, note: "No media - event is not linked to a connected Ring device" };
  if (device.details.snapshot === false) return { media: null, note: "No media - this device does not report snapshot capability" };
  const token = usableToken(await getRingSession());
  if (!token) return { media: null, note: "No media - Ring Playground session expired" };
  const w = mediaWindow(event, padSeconds);
  try {
    noteOwnMediaRequest();
    const snap =
      (await getRingSnapshot(token, device.ringDeviceId, { type: "latest_in_range", start_timestamp: w.from, end_timestamp: w.to })) ??
      (await getRingSnapshot(token, device.ringDeviceId, { type: "at_timestamp", timestamp: Math.min(new Date(event.timestamp).getTime() + 3000, Date.now() - 1500) }));
    if (!snap) return { media: null, note: "No media - Ring returned no snapshot for this event window" };
    saveMedia(event.id, { bytes: snap.bytes, contentType: snap.contentType, capturedAt: snap.capturedAt });
    return { media: { kind: "image", image: snap.bytes, format: snap.format } };
  } catch (e) {
    console.error({ event: "matan_ai_media_unavailable", reason: (e as { code?: string })?.code ?? "error" });
    return { media: null, note: "No media - Ring snapshot request failed; analyzed from context only" };
  }
}

/** Server-side clip for the padded window (≤ 60 s). */
async function obtainRingClip(event: RingEvent, padSeconds: number) {
  const device = listConnected().find((d) => d.id === event.cameraId);
  const token = usableToken(await getRingSession());
  if (!device || !token) return null;
  const w = mediaWindow(event, padSeconds);
  try {
    noteOwnMediaRequest();
    const clip = await getRingClip(token, device.ringDeviceId, w.from, w.durationMs);
    if (clip) saveMedia(event.id, { bytes: clip.bytes, contentType: clip.contentType, capturedAt: clip.actualTimestamp, lengthMs: clip.actualLengthMs }, "video");
    return clip;
  } catch (e) {
    console.error({ event: "matan_ai_clip_unavailable", reason: (e as { code?: string })?.code ?? "error" });
    return null;
  }
}

/**
 * Full Matan pipeline for one Ring event:
 * snapshot pass → (escalation gate) → clip pass → decision → store.
 * `media`: "auto" (snapshot, escalate when useful) · "snapshot" · "video" (force clip).
 */
export async function runMatanPipeline(event: RingEvent, recent: RingEvent[], settings: UserSettingsForAnalysis, opts: { media?: "auto" | "snapshot" | "video"; hasRingMedia?: boolean; auto?: boolean } = {}): Promise<PipelineResult> {
  const mode = opts.media ?? "auto";
  const hasRingMedia = opts.hasRingMedia ?? true;
  const budget = budgetSnapshot();
  if (budget.exhausted) throw new MatanAiError("MATAN_AI_BUDGET_EXCEEDED");
  if (!beginAnalysis(event.id)) throw new MatanAiError("MATAN_AI_THROTTLED", "This event is already being analyzed.");
  const pad = autoSettings().padSeconds;
  try {
    let intelligence: MatanEventIntelligence | undefined;
    const w = mediaWindow(event, pad);

    if (mode !== "video") {
      const { media, note } = hasRingMedia ? await obtainRingMedia(event, pad) : { media: null, note: "No media supplied - context-only analysis" };
      intelligence = await analyzeEvent(event, recent, settings, { media, mediaNote: note, store: memoryIntelligenceStore });
    }

    let escalation = { attempted: false, reason: "", applied: false };
    if (hasRingMedia && mode !== "snapshot") {
      const built = buildMatanContext(event, recent, settings);
      const gate = shouldEscalateToVideo(intelligence?.analysis ?? null, {
        securityMode: settings.securityMode,
        quietHours: built.decision.quietHours ?? false,
        relatedRecentCount: built.decision.relatedRecentCount,
        hadSnapshot: intelligence?.mediaAnalyzed ?? false,
        videoAllowed: budget.videoAllowed,
        clipDurationMs: w.durationMs,
        requested: mode === "video",
      });
      escalation = { attempted: gate.ok, reason: gate.reason, applied: false };
      if (gate.ok) {
        const clip = await obtainRingClip(event, pad);
        if (clip) {
          intelligence = await analyzeEvent(event, recent, settings, {
            media: { kind: "video", video: clip.bytes, format: "mp4", durationSeconds: (clip.actualLengthMs ?? w.durationMs) / 1000 },
            escalatedFrom: intelligence ? (intelligence.mediaAnalyzed ? "snapshot" : "context") : undefined,
            store: memoryIntelligenceStore,
          });
          escalation.applied = true;
        } else {
          escalation.reason = `${gate.reason}; Ring returned no clip for this window (live-view sessions are not recordings)`;
          if (!intelligence) {
            const { media, note } = await obtainRingMedia(event, pad);
            intelligence = await analyzeEvent(event, recent, settings, { media, mediaNote: `${note}; no Ring clip available either`, store: memoryIntelligenceStore });
          }
        }
      }
    }
    if (!intelligence) intelligence = await analyzeEvent(event, recent, settings, { media: null, mediaNote: "No media supplied - context-only analysis", store: memoryIntelligenceStore });

    console.info({ event: "matan_ai_escalation", eventId: event.id, auto: Boolean(opts.auto), padSeconds: pad, ...escalation, budgetUsedPct: budget.usedPct });
    return { intelligence, escalation };
  } finally {
    endAnalysis(event.id);
  }
}

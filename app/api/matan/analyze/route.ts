import { NextResponse } from "next/server";
import type { RingEvent } from "@/lib/types";
import { getRingEvents } from "@/lib/ring/overview";
import { analyzeEvent, applyIntelligence, currentUserSettings, relatedRecent, shouldAnalyze } from "@/lib/matan/analysis";
import { beginAnalysis, endAnalysis, memoryIntelligenceStore, saveMedia } from "@/lib/matan/store";
import { MatanAiError } from "@/lib/matan/errors";
import { BEDROCK_MODEL_ID } from "@/lib/bedrock/client";
import { getRingSnapshot, getRingClip, MAX_CLIP_MS } from "@/lib/ring/client";
import { shouldEscalateToVideo } from "@/lib/matan/escalation";
import { budgetSnapshot } from "@/lib/matan/budget";
import { buildMatanContext } from "@/lib/matan/analysis";
import { getRingSession, listConnected, usableToken } from "@/lib/ring/session";
import type { NovaMedia } from "@/lib/bedrock/nova";

/**
 * Server-side media: for Ring history events, ask Ring for a snapshot inside the
 * event window (start..end). Never exposes the Ring token; falls back to
 * context-only analysis with an honest note when Ring has no media.
 */
async function obtainRingMedia(event: RingEvent): Promise<{ media: NovaMedia | null; note?: string }> {
  const device = listConnected().find((d) => d.id === event.cameraId);
  if (!device) return { media: null, note: "No media - event is not linked to a connected Ring device" };
  if (device.details.snapshot === false) return { media: null, note: "No media - this device does not report snapshot capability" };
  const session = await getRingSession();
  const token = usableToken(session);
  if (!token) return { media: null, note: "No media - Ring Playground session expired" };
  const start = new Date(event.timestamp).getTime();
  const end = start + Math.max(1, (event.clipDuration ?? 20)) * 1000;
  try {
    const snap =
      (await getRingSnapshot(token, device.ringDeviceId, { type: "latest_in_range", start_timestamp: start, end_timestamp: end })) ??
      (await getRingSnapshot(token, device.ringDeviceId, { type: "at_timestamp", timestamp: start + Math.min(5000, Math.floor((end - start) / 2)) }));
    if (!snap) return { media: null, note: "No media - Ring returned no snapshot for this event window" };
    saveMedia(event.id, { bytes: snap.bytes, contentType: snap.contentType, capturedAt: snap.capturedAt });
    return { media: { kind: "image", image: snap.bytes, format: snap.format } };
  } catch (e) {
    console.error({ event: "matan_ai_media_unavailable", reason: (e as { code?: string })?.code ?? "error" });
    return { media: null, note: "No media - Ring snapshot request failed; analyzed from context only" };
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface AnalyzeBody {
  /** Preferred: id of a Ring event in the current Real Mode history. */
  eventId?: string;
  /** Alternative (spec example shape): a minimal event object. */
  event?: { id: string; type: string; timestamp: string; deviceName: string; deviceType?: string; source?: string; detections?: string[] };
  context?: { securityMode?: string; recentEvents?: { type: string; timestamp: string; deviceName: string }[] };
  /** Manual request - bypasses shouldAnalyze() cost gating. */
  force?: boolean;
  /** "auto" (default): snapshot first, escalate to the clip only when useful · "snapshot": never video · "video": force the clip. */
  media?: "auto" | "snapshot" | "video" | null;
}

function fail(e: unknown) {
  const err = e instanceof MatanAiError ? e : new MatanAiError("MATAN_AI_UNAVAILABLE");
  return NextResponse.json({ success: false, error: err.toPayload() }, { status: err.http });
}

/** Server-side clip fetch for the event window (capped at MAX_CLIP_MS). Never exposes the Ring token. */
async function obtainRingClip(event: RingEvent, durationMs: number) {
  const device = listConnected().find((d) => d.id === event.cameraId);
  const session = await getRingSession();
  const token = usableToken(session);
  if (!device || !token) return null;
  try {
    const clip = await getRingClip(token, device.ringDeviceId, new Date(event.timestamp).getTime(), durationMs);
    if (clip) saveMedia(event.id, { bytes: clip.bytes, contentType: clip.contentType, capturedAt: clip.actualTimestamp, lengthMs: clip.actualLengthMs }, "video");
    return clip;
  } catch (e) {
    console.error({ event: "matan_ai_clip_unavailable", reason: (e as { code?: string })?.code ?? "error" });
    return null;
  }
}

/**
 * POST /api/matan/analyze
 * Browser → this route → Bedrock (Nova Pro) → Matan Decision → stored → returned.
 * No AWS credentials or Ring tokens ever leave the server.
 */
export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return fail(new MatanAiError("MATAN_AI_BAD_REQUEST"));
  }

  // Resolve the event + recent history (Real Mode Ring history is the source of truth).
  let event: RingEvent | undefined;
  let recent: RingEvent[] = [];
  const settings = currentUserSettings();

  if (body.eventId) {
    const { events } = await getRingEvents();
    event = events.find((e) => e.id === body.eventId);
    recent = events;
    if (!event) return fail(new MatanAiError("MATAN_AI_EVENT_NOT_FOUND"));
  } else if (body.event?.id && body.event.timestamp) {
    const b = body.event;
    event = {
      id: String(b.id).slice(0, 80),
      type: b.type === "ding" ? "doorbell" : "other",
      title: b.type === "ding" ? "Doorbell pressed" : "Motion detected",
      location: String(b.deviceName ?? "Unknown device").slice(0, 60),
      cameraId: "external",
      timestamp: b.timestamp,
      priority: "normal",
      summary: `Ring reported a ${b.type} event.`,
      tags: [String(b.type), ...(Array.isArray(b.detections) ? b.detections.slice(0, 6).map(String) : [])],
      source: "ring",
      analysis: "pending",
      ringEventType: String(b.type),
    };
    recent = (body.context?.recentEvents ?? []).slice(0, 20).map((r, i) => ({
      id: `ctx-${i}`,
      type: r.type === "ding" ? "doorbell" : "other",
      title: r.type,
      location: r.deviceName,
      cameraId: r.deviceName,
      timestamp: r.timestamp,
      priority: "normal",
      summary: "",
      tags: [],
      source: "ring",
      ringEventType: r.type,
    }));
    if (body.context?.securityMode) settings.securityMode = body.context.securityMode;
  } else {
    return fail(new MatanAiError("MATAN_AI_BAD_REQUEST"));
  }

  // Cost control: skip non-candidates unless explicitly requested.
  if (!body.force) {
    const gate = shouldAnalyze(event, relatedRecent(event, recent), settings);
    if (!gate.ok) return NextResponse.json({ success: false, skipped: true, eventId: event.id, reason: gate.reason }, { status: 200 });
  }

  // Duplicate-click guard: one Bedrock invocation per event at a time.
  if (!beginAnalysis(event.id)) return NextResponse.json({ success: false, error: { code: "MATAN_AI_THROTTLED", title: "Already analyzing", message: "This event is already being analyzed." } }, { status: 409 });

  try {
    const budget = budgetSnapshot();
    if (budget.exhausted) return fail(new MatanAiError("MATAN_AI_BUDGET_EXCEEDED"));
    const mode = body.media ?? "auto";

    // Pass 1: server-obtained Ring snapshot (or context-only when Ring has none).
    let intelligence;
    const clipMs = Math.min(MAX_CLIP_MS, Math.max(2000, (event.clipDuration ?? 20) * 1000));
    if (mode !== "video") {
      const { media, note } = body.eventId ? await obtainRingMedia(event) : { media: null, note: "No media supplied - context-only analysis" };
      intelligence = await analyzeEvent(event, recent, settings, { media, mediaNote: note, store: memoryIntelligenceStore });
    }

    // Pass 2 (escalation): the full Ring clip when it adds value and the budget allows.
    let escalation: { attempted: boolean; reason: string; applied: boolean } = { attempted: false, reason: "", applied: false };
    if (body.eventId && mode !== "snapshot") {
      const built = buildMatanContext(event, recent, settings);
      const gate = shouldEscalateToVideo(intelligence?.analysis ?? null, {
        securityMode: settings.securityMode,
        quietHours: built.decision.quietHours ?? false,
        relatedRecentCount: built.decision.relatedRecentCount,
        hadSnapshot: intelligence?.mediaAnalyzed ?? false,
        videoAllowed: budget.videoAllowed,
        clipDurationMs: clipMs,
        requested: mode === "video",
      });
      escalation = { attempted: gate.ok, reason: gate.reason, applied: false };
      if (gate.ok) {
        const clip = await obtainRingClip(event, clipMs);
        if (clip) {
          const video = await analyzeEvent(event, recent, settings, {
            media: { kind: "video", video: clip.bytes, format: "mp4", durationSeconds: (clip.actualLengthMs ?? clipMs) / 1000 },
            escalatedFrom: intelligence ? (intelligence.mediaAnalyzed ? "snapshot" : "context") : undefined,
            store: memoryIntelligenceStore,
          });
          intelligence = video;
          escalation.applied = true;
        } else {
          escalation.reason = `${gate.reason}; Ring returned no clip for this window (live-view sessions are not recordings)`;
        }
        if (!clip && !intelligence) {
          // video requested but Ring has no clip -> fall back to snapshot/context pass
          const { media, note } = await obtainRingMedia(event);
          intelligence = await analyzeEvent(event, recent, settings, { media, mediaNote: `${note}; no Ring clip available either`, store: memoryIntelligenceStore });
        }
      }
    }
    if (!intelligence) intelligence = await analyzeEvent(event, recent, settings, { media: null, mediaNote: "No media supplied - context-only analysis", store: memoryIntelligenceStore });

    console.info({ event: "matan_ai_escalation", eventId: event.id, ...escalation, budgetUsedPct: budget.usedPct });
    return NextResponse.json({ success: true, eventId: event.id, intelligence, event: applyIntelligence(event, intelligence), model: BEDROCK_MODEL_ID, escalation, budget: budgetSnapshot() });
  } catch (e) {
    return fail(e);
  } finally {
    endAnalysis(event.id);
  }
}

/** GET /api/matan/analyze?eventId= → stored intelligence (or null). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("eventId");
  if (!id) return fail(new MatanAiError("MATAN_AI_BAD_REQUEST"));
  return NextResponse.json({ eventId: id, intelligence: await memoryIntelligenceStore.get(id) });
}

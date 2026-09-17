import { NextResponse } from "next/server";
import type { RingEvent } from "@/lib/types";
import { getRingEvents } from "@/lib/ring/overview";
import { applyIntelligence, currentUserSettings, relatedRecent, shouldAnalyze } from "@/lib/matan/analysis";
import { runMatanPipeline } from "@/lib/matan/pipeline";
import { memoryIntelligenceStore } from "@/lib/matan/store";
import { budgetSnapshot } from "@/lib/matan/budget";
import { MatanAiError } from "@/lib/matan/errors";
import { BEDROCK_MODEL_ID } from "@/lib/bedrock/client";

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

/**
 * POST /api/matan/analyze
 * Browser → this route → Ring media (server-side) → Bedrock (Nova Pro) → Matan Decision → stored → returned.
 * No AWS credentials or Ring tokens ever leave the server.
 */
export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return fail(new MatanAiError("MATAN_AI_BAD_REQUEST"));
  }

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

  if (!body.force) {
    const gate = shouldAnalyze(event, relatedRecent(event, recent), settings);
    if (!gate.ok) return NextResponse.json({ success: false, skipped: true, eventId: event.id, reason: gate.reason }, { status: 200 });
  }

  try {
    const { intelligence, escalation } = await runMatanPipeline(event, recent, settings, { media: body.media ?? "auto", hasRingMedia: Boolean(body.eventId) });
    return NextResponse.json({ success: true, eventId: event.id, intelligence, event: applyIntelligence(event, intelligence), model: BEDROCK_MODEL_ID, escalation, budget: budgetSnapshot() });
  } catch (e) {
    if (e instanceof MatanAiError && e.code === "MATAN_AI_THROTTLED") return NextResponse.json({ success: false, error: e.toPayload() }, { status: 409 });
    return fail(e);
  }
}

/** GET /api/matan/analyze?eventId= → stored intelligence (or null). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("eventId");
  if (!id) return fail(new MatanAiError("MATAN_AI_BAD_REQUEST"));
  return NextResponse.json({ eventId: id, intelligence: await memoryIntelligenceStore.get(id) });
}

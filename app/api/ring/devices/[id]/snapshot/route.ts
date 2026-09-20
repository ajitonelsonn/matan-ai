import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getRingSnapshot } from "@/lib/ring/client";
import { getRingSession, listConnected, markInvalid, usableToken } from "@/lib/ring/session";
import { ringCodeError, ringError } from "@/lib/ring/http";
import { isRingApiError } from "@/lib/ring/errors";
import { noteOwnMediaRequest } from "@/lib/matan/auto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ring/devices/:id/snapshot → a fresh snapshot from Ring for a connected device
 * (real `POST /v1/devices/{id}/media/image/download`, latest frame in the last 30 s).
 * Returns the JPEG bytes; the Ring token never leaves the server. Ring records the request
 * as an on_demand history entry, which auto-analysis is told to ignore.
 */
export const POST = userRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const device = listConnected().find((d) => d.id === id);
  if (!device) return ringCodeError("RING_NOT_FOUND", 404);
  if (device.details.snapshot === false) return NextResponse.json({ error: { code: "RING_NO_SNAPSHOT", title: "Snapshot unavailable", message: "Ring reports no snapshot capability for this device." } }, { status: 400 });
  const session = await getRingSession();
  const token = usableToken(session);
  if (!token) return ringCodeError(session ? "RING_TOKEN_EXPIRED" : "RING_NO_SESSION", 401);
  const now = Date.now() - 1500;
  try {
    noteOwnMediaRequest();
    // Freshest frame first; the Playground only holds media for event windows, so fall back to
    // the latest frame of the last 15 minutes (the capture time is returned so the UI shows it).
    const snap =
      (await getRingSnapshot(token, device.ringDeviceId, { type: "latest_in_range", start_timestamp: now - 30_000, end_timestamp: now })) ??
      (await getRingSnapshot(token, device.ringDeviceId, { type: "latest_in_range", start_timestamp: now - 15 * 60_000, end_timestamp: now })) ??
      (await getRingSnapshot(token, device.ringDeviceId, { type: "at_timestamp", timestamp: now }));
    if (!snap) return NextResponse.json({ error: { code: "RING_NO_SNAPSHOT", title: "No snapshot", message: "Ring has no image for this device yet. Start the Ring live view (or trigger a Playground simulation), then try again." } }, { status: 404 });
    return new Response(snap.bytes as unknown as BodyInit, { status: 200, headers: { "Content-Type": snap.contentType || "image/jpeg", "Cache-Control": "private, no-store", ...(snap.capturedAt ? { "X-Media-Captured-At": snap.capturedAt } : {}) } });
  } catch (e) {
    if (isRingApiError(e) && (e.code === "RING_TOKEN_INVALID" || e.code === "RING_TOKEN_EXPIRED") && session) markInvalid(session);
    return ringError(e);
  }
});

import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getRingDeviceEvents } from "@/lib/ring/client";
import { getRingSession, listConnected, markInvalid, usableToken } from "@/lib/ring/session";
import { ringCodeError, ringError } from "@/lib/ring/http";
import { isRingApiError } from "@/lib/ring/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/ring/devices/:id/events -> recent Ring event history for a connected device. */
export const GET = userRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const device = listConnected().find((d) => d.id === id);
  if (!device) return ringCodeError("RING_NOT_FOUND", 404);
  const session = await getRingSession();
  const token = usableToken(session);
  if (!token) return ringCodeError(session ? "RING_TOKEN_EXPIRED" : "RING_NO_SESSION", 401);
  try {
    const events = await getRingDeviceEvents(token, device.ringDeviceId);
    return NextResponse.json({ events: events.slice(0, 20) });
  } catch (e) {
    if (isRingApiError(e) && (e.code === "RING_TOKEN_INVALID" || e.code === "RING_TOKEN_EXPIRED") && session) markInvalid(session);
    return ringError(e);
  }
});

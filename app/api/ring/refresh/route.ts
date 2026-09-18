import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { discoverRingDevices } from "@/lib/ring/client";
import { getRingSession, listConnected, markInvalid, markValidated, sessionInfo, syncConnected, usableToken } from "@/lib/ring/session";
import { ringCodeError, ringError } from "@/lib/ring/http";
import { getRingEvents } from "@/lib/ring/overview";
import { isRingApiError } from "@/lib/ring/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ring/refresh -> re-run Device Discovery with the active session token,
 * update connected devices' status and return the fresh discovery list.
 */
export const POST = userRoute(async (_req: Request) => {
  const session = await getRingSession();
  const token = usableToken(session);
  if (!token) return ringCodeError(session ? "RING_TOKEN_EXPIRED" : "RING_NO_SESSION", 401);
  try {
    const devices = await discoverRingDevices(token);
    markValidated(session!, devices);
    await syncConnected(devices);
    // Also resync Ring event history (bypassing the 60 s cache) so new events + auto-analysis run now.
    const { events } = await getRingEvents(true);
    return NextResponse.json({ devices, connected: listConnected(), session: sessionInfo(session), eventCount: events.length });
  } catch (e) {
    if (isRingApiError(e) && (e.code === "RING_TOKEN_INVALID" || e.code === "RING_TOKEN_EXPIRED") && session) markInvalid(session);
    return ringError(e);
  }
});

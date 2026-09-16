import { NextResponse } from "next/server";
import { startWhepSession, stopWhepSession } from "@/lib/ring/client";
import { getRingSession, listConnected, markInvalid, usableToken } from "@/lib/ring/session";
import { ringCodeError, ringError, readBody } from "@/lib/ring/http";
import { RingApiError, isRingApiError } from "@/lib/ring/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/ring/devices/:id/stream  { sdpOffer }
 * Browser -> Matan backend -> Ring WHEP. Returns { sdpAnswer, sessionUrl }.
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const device = listConnected().find((d) => d.id === id);
  if (!device) return ringCodeError("RING_NOT_FOUND", 404);
  const session = await getRingSession();
  const token = usableToken(session);
  if (!token) return ringCodeError(session ? "RING_TOKEN_EXPIRED" : "RING_NO_SESSION", 401);

  const body = await readBody<{ sdpOffer?: unknown }>(req);
  const offer = typeof body?.sdpOffer === "string" ? body.sdpOffer : "";
  if (!offer || offer.length > 64_000 || !/^v=0/m.test(offer)) return ringError(new RingApiError("RING_BAD_REQUEST", 400, "A valid SDP offer is required."));

  try {
    const result = await startWhepSession(token, device.ringDeviceId, offer);
    return NextResponse.json(result);
  } catch (e) {
    if (isRingApiError(e) && (e.code === "RING_TOKEN_INVALID" || e.code === "RING_TOKEN_EXPIRED") && session) markInvalid(session);
    return ringError(e);
  }
}

/** DELETE /api/ring/devices/:id/stream  { sessionUrl } -> ends the WHEP session. */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  if (!listConnected().some((d) => d.id === id)) return ringCodeError("RING_NOT_FOUND", 404);
  const session = await getRingSession();
  const token = usableToken(session);
  if (!token) return NextResponse.json({ ended: false });
  const body = await readBody<{ sessionUrl?: unknown }>(req);
  const url = typeof body?.sessionUrl === "string" ? body.sessionUrl : "";
  if (!url) return NextResponse.json({ ended: false });
  try {
    await stopWhepSession(token, url);
    return NextResponse.json({ ended: true });
  } catch (e) {
    return ringError(e);
  }
}

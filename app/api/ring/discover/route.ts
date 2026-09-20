import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { discoverRingDevices, getRingAccount } from "@/lib/ring/client";
import { createRingSession, sessionInfo } from "@/lib/ring/session";
import { RingApiError } from "@/lib/ring/errors";
import { ringError, readBody } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ring/discover  { token }
 * Validates the Playground token by calling Ring's Device Discovery server-side,
 * stores the token in a server session (HttpOnly cookie id) and returns
 * normalized device metadata. The token is never echoed or logged.
 */
export const POST = userRoute(async (req: Request) => {
  const body = await readBody<{ token?: unknown }>(req);
  const raw = typeof body?.token === "string" ? body.token.trim() : "";
  if (!raw) return ringError(new RingApiError("RING_TOKEN_MISSING", 400));
  if (raw.length > 8192 || /\s/.test(raw)) return ringError(new RingApiError("RING_TOKEN_INVALID", 400, "That doesn't look like a Ring Playground token."));

  try {
    const devices = await discoverRingDevices(raw);
    // Account identity is best-effort: a users/me failure must not block device discovery.
    const account = await getRingAccount(raw).catch(() => null);
    const session = await createRingSession(raw, devices, account);
    console.info({ event: "ring_account", ok: Boolean(account) });
    return NextResponse.json({ devices, count: devices.length, session: sessionInfo(session) });
  } catch (e) {
    return ringError(e);
  }
});

import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getRingDeviceStatus } from "@/lib/ring/client";
import { getRingSession, listConnected, markInvalid, usableToken } from "@/lib/ring/session";
import { ringCodeError, ringError } from "@/lib/ring/http";
import { isRingApiError } from "@/lib/ring/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/ring/devices/:id/status -> live status from Ring for a connected device. */
export const GET = userRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const device = listConnected().find((d) => d.id === id);
  if (!device) return ringCodeError("RING_NOT_FOUND", 404);
  const session = await getRingSession();
  const token = usableToken(session);
  if (!token) return ringCodeError(session ? "RING_TOKEN_EXPIRED" : "RING_NO_SESSION", 401);
  try {
    const status = await getRingDeviceStatus(token, device.ringDeviceId);
    device.status = status.online === null ? "unknown" : status.online ? "online" : "offline";
    device.statusReportedAt = status.reportedAt;
    device.lastSyncedAt = new Date().toISOString();
    return NextResponse.json({ device, status: { online: status.online, reportedAt: status.reportedAt } });
  } catch (e) {
    if (isRingApiError(e) && (e.code === "RING_TOKEN_INVALID" || e.code === "RING_TOKEN_EXPIRED") && session) markInvalid(session);
    return ringError(e);
  }
});

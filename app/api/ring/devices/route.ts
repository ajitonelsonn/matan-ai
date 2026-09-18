import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getRingSession, listConnected, sessionInfo, toConnected, upsertConnected } from "@/lib/ring/session";
import { capabilityLabels } from "@/lib/ring/normalize";
import { ringCodeError, readBody } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/ring/devices -> connected Ring devices + session state. Does not call Ring. */
export const GET = userRoute(async (_req: Request) => {
  const session = await getRingSession();
  return NextResponse.json({ connected: listConnected(), session: sessionInfo(session) });
});

interface SaveBody {
  devices?: { ringDeviceId: string; displayName?: string; locationLabel?: string; aiEnabled?: boolean; favorite?: boolean }[];
}

/**
 * POST /api/ring/devices -> save selected discovered devices with local metadata.
 * Device facts come from the server-side discovery result of the active session,
 * never from the browser, so nothing can be fabricated client-side.
 */
export const POST = userRoute(async (req: Request) => {
  const session = await getRingSession();
  if (!session) return ringCodeError("RING_NO_SESSION", 401);
  const body = await readBody<SaveBody>(req);
  const picks = Array.isArray(body?.devices) ? body.devices : [];
  if (!picks.length) return NextResponse.json({ error: { code: "RING_BAD_REQUEST", title: "Nothing selected", message: "Select at least one device." } }, { status: 400 });

  const saved = [];
  const missing: string[] = [];
  for (const pick of picks.slice(0, 50)) {
    const dev = session.discovered.find((d) => d.id === pick.ringDeviceId);
    if (!dev) {
      missing.push(pick.ringDeviceId);
      continue;
    }
    saved.push(await upsertConnected(toConnected(dev, pick, capabilityLabels(dev.capabilities))));
  }
  console.log({ event: "ring_devices_saved", count: saved.length, skipped: missing.length });
  return NextResponse.json({ saved, skipped: missing.length, connected: listConnected(), session: sessionInfo(session) }, { status: 201 });
});

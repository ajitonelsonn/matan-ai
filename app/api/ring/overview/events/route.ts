import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { buildRingEventList, findRingEvent } from "@/lib/ring/overview";
import { ringError, ringCodeError } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/ring/overview/events?…  (same query params as /api/events) · ?id=<eventId> for one event */
export const GET = userRoute(async (req: Request) => {
  const url = new URL(req.url);
  try {
    const id = url.searchParams.get("id");
    if (id) {
      const ev = await findRingEvent(id);
      return ev ? NextResponse.json(ev) : ringCodeError("RING_NOT_FOUND", 404);
    }
    return NextResponse.json(await buildRingEventList(url.searchParams));
  } catch (e) {
    return ringError(e);
  }
});

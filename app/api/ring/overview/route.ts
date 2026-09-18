import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { buildRingDashboard } from "@/lib/ring/overview";
import { ringError } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/ring/overview -> Real-mode dashboard built only from Ring-backed data. */
export const GET = userRoute(async (_req: Request) => {
  try {
    return NextResponse.json(await buildRingDashboard());
  } catch (e) {
    return ringError(e);
  }
});

import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { buildRingInsights } from "@/lib/ring/overview";
import { ringError } from "@/lib/ring/http";
import type { InsightRange } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = userRoute(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const range = (params.get("range") ?? "7d") as InsightRange;
  const from = params.get("from");
  const to = params.get("to");
  try {
    return NextResponse.json(await buildRingInsights(range, from && to ? { from, to } : null));
  } catch (e) {
    return ringError(e);
  }
});

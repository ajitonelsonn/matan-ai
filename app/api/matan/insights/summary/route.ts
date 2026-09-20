import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { generatePeriodSummary } from "@/lib/matan/insights-generate";
import { MatanAiError } from "@/lib/matan/errors";
import { ringError } from "@/lib/ring/http";
import type { InsightRange } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/matan/insights/summary { range, from?, to? } → Nova-written summary of the user's real events in that period. */
export const POST = userRoute(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { range?: InsightRange; from?: string; to?: string };
  const range: InsightRange = body.range === "today" || body.range === "30d" || body.range === "custom" ? body.range : "7d";
  try {
    return NextResponse.json(await generatePeriodSummary(range, body.from && body.to ? { from: String(body.from), to: String(body.to) } : null));
  } catch (e) {
    if (e instanceof MatanAiError) return NextResponse.json({ error: e.toPayload() }, { status: e.http });
    return ringError(e);
  }
});

import { NextResponse } from "next/server";
import { buildRingInsights } from "@/lib/ring/overview";
import { ringError } from "@/lib/ring/http";
import type { InsightRange } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const range = (new URL(req.url).searchParams.get("range") ?? "7d") as InsightRange;
  try {
    return NextResponse.json(await buildRingInsights(range));
  } catch (e) {
    return ringError(e);
  }
}

import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { sendDailyReport } from "@/lib/matan/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/matan/report → email today's Ring/Matan summary to the signed-in user's alert address (real data, rate-limited). */
export const POST = userRoute(async () => {
  const r = await sendDailyReport();
  const status = r.status === "sent" ? 200 : r.status === "skipped" ? 400 : r.status === "duplicate" ? 429 : 502;
  return NextResponse.json(r, { status });
});

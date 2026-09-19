import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { sendTestAlert } from "@/lib/matan/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/matan/notifications/test → sends one sample Matan alert to the signed-in user's
 * configured alert address through the normal notification service (same SES sender,
 * configuration set, content builder). Rate-limited per user; never accepts a recipient.
 */
export const POST = userRoute(async () => {
  const outcome = await sendTestAlert();
  const status = outcome.status === "sent" ? 200 : outcome.status === "skipped" ? 400 : outcome.status === "duplicate" ? 429 : 502;
  return NextResponse.json(outcome, { status });
});

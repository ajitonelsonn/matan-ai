import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getRingEvents } from "@/lib/ring/overview";
import { runAutoStep } from "@/lib/matan/auto";
import { runMatanPipeline } from "@/lib/matan/pipeline";
import { currentUserSettings } from "@/lib/matan/analysis";
import { ringError } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/matan/auto/step → analyze ONE pending event for the signed-in user, fully
 * inside this request (Ring media → Nova → decision → storage → alert email). The browser
 * calls it while the overview reports `autoPending > 0`. This replaces fire-and-forget
 * background work, which a stateless runtime freezes as soon as the response is sent.
 */
export const POST = userRoute(async () => {
  try {
    const { events } = await getRingEvents();
    const result = await runAutoStep(events, (ev, o) => runMatanPipeline(ev, events, currentUserSettings(), { media: o.media, auto: true }));
    return NextResponse.json(result);
  } catch (e) {
    return ringError(e);
  }
});

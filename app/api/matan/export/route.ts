import { userRoute } from "@/lib/auth/scope";
import { getRingEvents } from "@/lib/ring/overview";
import { listConnected, sessionInfo, getRingSession } from "@/lib/ring/session";
import { getUserSettings } from "@/lib/matan/user-settings";
import { getCareContext, listRules } from "@/lib/matan/rules/store";
import { listChats } from "@/lib/ring/assistant-store";
import { ringError } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/matan/export → a JSON file with everything Matan stores for the signed-in user:
 * settings, Care Context, Smart Rules, connected devices (no tokens), Ring events with
 * Matan analyses/decisions/notification outcomes, and assistant conversations.
 * Media stays in S3 (download it per event); the Ring token is never included.
 */
export const GET = userRoute(async () => {
  try {
    const [{ events }, session] = await Promise.all([getRingEvents(), getRingSession()]);
    const settings = getUserSettings();
    const body = {
      exportedAt: new Date().toISOString(),
      app: "MATAN AI",
      mode: "real",
      settings: { ...settings, notifications: { ...settings.notifications } },
      careContext: getCareContext(),
      rules: listRules(),
      devices: listConnected().map(({ id, ringDeviceId, ringName, displayName, deviceType, model, locationLabel, status, statusReportedAt, capabilities, details, configuration, region, aiEnabled, favorite, connectedAt, lastSyncedAt }) => ({ id, ringDeviceId, ringName, displayName, deviceType, model, locationLabel, status, statusReportedAt, capabilities, details, configuration, region, aiEnabled, favorite, connectedAt, lastSyncedAt })),
      ringSession: session ? sessionInfo(session) : null,
      events: events.map((e) => ({ ...e, imageUrl: undefined, videoUrl: undefined, thumbnailUrl: undefined })),
      conversations: listChats(),
    };
    const json = JSON.stringify(body, null, 2);
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="matan-ai-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return ringError(e);
  }
});

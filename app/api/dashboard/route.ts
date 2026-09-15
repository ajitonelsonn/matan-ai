import { getStore, delay } from "@/lib/mock/store";
import { countEvents, eventsInRange } from "@/lib/mock/insights";
import { user, weather, quickQuestions } from "@/lib/mock/users";
import { ok, readJson } from "@/lib/api/http";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await delay();
  const s = getStore();
  const today = eventsInRange(s.events, "today");
  const yesterday = eventsInRange(s.events, "today", 1);
  const todayCounts = countEvents(today);
  const pct = yesterday.length ? Math.round(((today.length - yesterday.length) / yesterday.length) * 100) : 0;

  // "Latest intelligence": the most relevant recent events, not raw motion spam.
  const showcase = ["EVT-1041", "EVT-1042", "EVT-1039", "EVT-1040"];
  const latestEvents = showcase
    .map((id) => s.events.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const active = s.securityModes.find((m) => m.id === s.activeModeId)!;
  const data: DashboardData = {
    user,
    weather,
    notifications: s.notifications,
    unreadNotifications: s.notifications.filter((n) => !n.read).length,
    todayCounts,
    todayVsYesterdayPct: pct,
    latestEvents,
    devices: s.devices,
    activeModeId: s.activeModeId,
    activeModeName: active.name,
    quickQuestions,
    featuredCameraId: "cam-front",
  };
  return ok(data);
}

export async function PATCH(req: Request) {
  const body = await readJson<{ markAllRead?: boolean; readId?: string }>(req);
  const s = getStore();
  if (body.markAllRead) s.notifications.forEach((n) => (n.read = true));
  if (body.readId) {
    const n = s.notifications.find((x) => x.id === body.readId);
    if (n) n.read = true;
  }
  return ok({ unread: s.notifications.filter((n) => !n.read).length, notifications: s.notifications });
}

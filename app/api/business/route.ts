import { getStore, delay, nextId } from "@/lib/mock/store";
import { businessEvents, businessInsights, businessTrend } from "@/lib/mock/business";
import { ok, readJson } from "@/lib/api/http";
import type { BusinessLocation, BusinessReport, TeamMember } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";
import { images } from "@/lib/mock/images";

export const dynamic = "force-dynamic";

function payload() {
  const s = getStore();
  return {
    locations: s.locations,
    team: s.team,
    events: businessEvents,
    insights: businessInsights,
    trend: businessTrend,
    reports: s.reports,
    integrations: s.integrations,
    metrics: {
      locations: s.locations.length,
      cameras: s.locations.reduce((a, l) => a + l.cameras, 0),
      team: s.team.length,
      securityEvents: businessEvents.filter((e) => e.priority !== "normal").length,
    },
  };
}

export async function GET() {
  await delay();
  return ok(payload());
}

export async function PATCH(req: Request) {
  const body = await readJson<{ integrationId?: string; connected?: boolean; memberId?: string; role?: TeamMember["role"]; locationId?: string; status?: "online" | "offline" }>(req);
  const s = getStore();
  if (body.integrationId && typeof body.connected === "boolean") {
    const i = s.integrations.find((x) => x.id === body.integrationId);
    if (i) i.connected = body.connected;
  }
  if (body.memberId && body.role) {
    const m = s.team.find((x) => x.id === body.memberId);
    if (m) m.role = body.role;
  }
  if (body.locationId && body.status) {
    const l = s.locations.find((x) => x.id === body.locationId);
    if (l) l.status = body.status;
  }
  return ok(payload());
}

export async function POST(req: Request) {
  const body = await readJson<{ action: "report" | "location" | "member"; name?: string; city?: string; role?: TeamMember["role"]; period?: string }>(req);
  const s = getStore();
  if (body.action === "report") {
    await delay(1200);
    const report: BusinessReport = {
      id: nextId("rep"),
      name: body.name || "Business Activity Report",
      period: body.period || "Sep 4 - Sep 11, 2026",
      createdAt: MOCK_NOW,
      size: "980 KB",
      status: "ready",
    };
    s.reports.unshift(report);
    return ok(report, { status: 201 });
  }
  if (body.action === "location") {
    await delay(400);
    const loc: BusinessLocation = {
      id: nextId("loc"),
      slug: (body.name || "new-location").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: body.name || "New Location",
      city: body.city || "Dili, Timor-Leste",
      cameras: 0,
      status: "offline",
      imageUrl: images.storefront,
      manager: "Unassigned",
      openHours: "09:00 - 18:00",
      eventsToday: 0,
    };
    s.locations.push(loc);
    return ok(loc, { status: 201 });
  }
  if (body.action === "member") {
    await delay(400);
    const m: TeamMember = {
      id: nextId("tm"),
      name: body.name || "New member",
      role: body.role || "Viewer",
      locationIds: [],
      lastActive: MOCK_NOW,
      status: "invited",
    };
    s.team.push(m);
    return ok(m, { status: 201 });
  }
  return ok(payload());
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  const reportId = url.searchParams.get("reportId");
  const s = getStore();
  if (memberId) {
    const idx = s.team.findIndex((m) => m.id === memberId);
    if (idx >= 0) s.team.splice(idx, 1);
  }
  if (reportId) {
    const idx = s.reports.findIndex((r) => r.id === reportId);
    if (idx >= 0) s.reports.splice(idx, 1);
  }
  return ok(payload());
}

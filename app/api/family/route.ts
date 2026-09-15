import { getStore, delay, nextId } from "@/lib/mock/store";
import { familyActivity, careInsights, liveFamilyViews } from "@/lib/mock/family";
import { ok, readJson } from "@/lib/api/http";
import type { FamilyMember, FamilyPresence } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";

export const dynamic = "force-dynamic";

function payload() {
  const s = getStore();
  const counts: Record<FamilyPresence, number> = { home: 0, away: 0, unknown: 0, attention: 0 };
  s.familyMembers.forEach((m) => (counts[m.presence] += 1));
  return {
    members: s.familyMembers,
    counts,
    activity: familyActivity,
    insights: careInsights,
    features: s.careFeatures,
    liveViews: liveFamilyViews,
    status: counts.attention > 0 ? "attention" : counts.unknown > 0 ? "unknown" : "safe",
  };
}

export async function GET() {
  await delay();
  return ok(payload());
}

export async function PATCH(req: Request) {
  const body = await readJson<{ featureId?: string; enabled?: boolean; memberId?: string; presence?: FamilyPresence }>(req);
  const s = getStore();
  if (body.featureId && typeof body.enabled === "boolean") {
    const f = s.careFeatures.find((x) => x.id === body.featureId);
    if (f) f.enabled = body.enabled;
  }
  if (body.memberId && body.presence) {
    const m = s.familyMembers.find((x) => x.id === body.memberId);
    if (m) {
      m.presence = body.presence;
      m.lastSeenAt = MOCK_NOW;
    }
  }
  return ok(payload());
}

export async function POST(req: Request) {
  await delay(400);
  const body = await readJson<{ name: string; role: string }>(req);
  const s = getStore();
  const member: FamilyMember = {
    id: nextId("fam"),
    name: body.name || "New member",
    role: body.role || "Family",
    presence: "unknown",
    lastSeenAt: MOCK_NOW,
    lastSeenLocation: "Not yet detected",
  };
  s.familyMembers.push(member);
  return ok(member, { status: 201 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const s = getStore();
  const idx = s.familyMembers.findIndex((m) => m.id === id);
  if (idx >= 0) s.familyMembers.splice(idx, 1);
  return ok(payload());
}

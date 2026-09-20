import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { getRingEvents } from "@/lib/ring/overview";
import { markInboxRead } from "@/lib/ring/inbox";
import { readBody } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/ring/notifications  { id } | { all: true } → mark Real Mode inbox items read (per user, in memory). */
export const POST = userRoute(async (req) => {
  const body = await readBody<{ id?: string; all?: boolean }>(req);
  const { events } = await getRingEvents();
  markInboxRead(body?.all ? "all" : body?.id ? [String(body.id).slice(0, 120)] : [], events);
  return NextResponse.json({ ok: true });
});

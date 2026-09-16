import { NextResponse } from "next/server";
import { destroyRingSession, getRingSession, sessionInfo } from "@/lib/ring/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/ring/session -> current Playground session state (never the token). */
export async function GET() {
  const session = await getRingSession();
  return NextResponse.json({ session: sessionInfo(session), discovered: session?.discovered ?? [] });
}

/** DELETE /api/ring/session -> forget the token. Connected devices are kept. */
export async function DELETE() {
  await destroyRingSession();
  return NextResponse.json({ session: null });
}

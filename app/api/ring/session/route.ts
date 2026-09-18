import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { destroyRingSession, getRingSession, sessionInfo } from "@/lib/ring/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/ring/session -> current Playground session state (never the token). */
export const GET = userRoute(async (_req: Request) => {
  const session = await getRingSession();
  return NextResponse.json({ session: sessionInfo(session), discovered: session?.discovered ?? [] });
});

/** DELETE /api/ring/session -> forget the token. Connected devices are kept. */
export const DELETE = userRoute(async (_req: Request) => {
  await destroyRingSession();
  return NextResponse.json({ session: null });
});

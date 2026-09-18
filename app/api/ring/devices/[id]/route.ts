import { NextResponse } from "next/server";
import { userRoute } from "@/lib/auth/scope";
import { listConnected, removeConnected, updateConnected } from "@/lib/ring/session";
import { readBody } from "@/lib/ring/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = userRoute(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const d = listConnected().find((x) => x.id === id);
  return d ? NextResponse.json(d) : NextResponse.json({ error: { code: "RING_NOT_FOUND", title: "Not found", message: "Device not found." } }, { status: 404 });
});

/** PATCH local metadata only (display name, location label, AI, favorite). */
export const PATCH = userRoute(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const body = await readBody<{ displayName?: string; locationLabel?: string; aiEnabled?: boolean; favorite?: boolean }>(req);
  const d = await updateConnected(id, body ?? {});
  return d ? NextResponse.json(d) : NextResponse.json({ error: { code: "RING_NOT_FOUND", title: "Not found", message: "Device not found." } }, { status: 404 });
});

/** DELETE removes the device from Matan AI only - it does not touch the Ring account. */
export const DELETE = userRoute(async (_req: Request, { params }: Params) => {
  const { id } = await params;
  const ok = await removeConnected(id);
  return ok ? NextResponse.json({ deleted: id, connected: listConnected() }) : NextResponse.json({ error: { code: "RING_NOT_FOUND", title: "Not found", message: "Device not found." } }, { status: 404 });
});

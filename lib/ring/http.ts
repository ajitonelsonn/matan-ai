import "server-only";
import { NextResponse } from "next/server";
import { RingApiError, copy, isRingApiError } from "./errors";
import type { RingErrorCode } from "./types";

/** Uniform error response for all /api/ring routes. The token is never part of any response. */
export function ringError(e: unknown) {
  if (isRingApiError(e)) {
    const res = NextResponse.json({ error: e.toPayload() }, { status: e.httpStatus });
    if (e.retryAfterSeconds) res.headers.set("Retry-After", String(e.retryAfterSeconds));
    return res;
  }
  console.error({ event: "ring_route_error", reason: e instanceof Error ? e.name : "unknown" });
  const fallback = new RingApiError("RING_UNKNOWN", 500);
  return NextResponse.json({ error: fallback.toPayload() }, { status: 500 });
}

export function ringCodeError(code: RingErrorCode, status: number) {
  return NextResponse.json({ error: { code, title: copy[code].title, message: copy[code].message } }, { status });
}

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

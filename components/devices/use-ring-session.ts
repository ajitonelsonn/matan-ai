"use client";

import * as React from "react";
import type { RingSessionInfo, TokenStatus } from "@/lib/ring/types";
import { RING_TOKEN_EXPIRING_THRESHOLD_MS } from "@/lib/ring/constants";

/** Live countdown + derived status for the Playground session. Ticks every second. */
export function useRingCountdown(session: RingSessionInfo | null | undefined) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  if (!session) return { status: "missing" as TokenStatus, remainingMs: 0, label: "", pct: 0 };
  if (session.status === "invalid") return { status: "invalid" as TokenStatus, remainingMs: 0, label: "Invalid", pct: 0 };
  const remainingMs = Math.max(0, new Date(session.expiresAt).getTime() - now);
  const status: TokenStatus = remainingMs <= 0 ? "expired" : remainingMs <= RING_TOKEN_EXPIRING_THRESHOLD_MS ? "expiring" : "valid";
  const m = Math.floor(remainingMs / 60000);
  const s = Math.floor((remainingMs % 60000) / 1000);
  const total = new Date(session.expiresAt).getTime() - new Date(session.connectedAt).getTime();
  return { status, remainingMs, label: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, pct: total > 0 ? Math.max(0, Math.min(100, (remainingMs / total) * 100)) : 0 };
}

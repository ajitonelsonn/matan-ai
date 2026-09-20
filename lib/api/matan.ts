import { request, ApiError } from "./client";
import type { InsightRange, RingEvent } from "@/lib/types";
import type { MatanEventIntelligence } from "@/lib/matan/schema";
import type { MatanAiErrorCode } from "@/lib/matan/errors";

export interface AnalyzeResponse {
  success: true;
  eventId: string;
  intelligence: MatanEventIntelligence;
  event: RingEvent;
  model: string;
  escalation?: { attempted: boolean; reason: string; applied: boolean };
  budget?: { usedTokens: number; budgetTokens: number; usedPct: number; estimatedUsd: number; videoAllowed: boolean; calls: number; videoCalls: number };
}

export interface MatanAiErrorPayload {
  code: MatanAiErrorCode | string;
  title: string;
  message: string;
}

/** Browser → Matan backend only. Never talks to Bedrock directly. */
export const matanApi = {
  analyze: (eventId: string, force = true, media: "auto" | "snapshot" | "video" = "auto") =>
    request<AnalyzeResponse | { success: false; skipped: true; reason: string }>("/api/matan/analyze", { method: "POST", json: { eventId, force, media } }),
  get: (eventId: string) => request<{ eventId: string; intelligence: MatanEventIntelligence | null }>(`/api/matan/analyze?eventId=${encodeURIComponent(eventId)}`),
  /** Emails today's real Ring/Matan summary to the configured alert address (Home → Send Report). */
  insightsSummary: (range: InsightRange, window?: { from: string; to: string }) => request<{ summary: string; model: string | null; generatedAt: string; eventCount: number; analyzedCount: number; rangeLabel: string; cached: boolean }>("/api/matan/insights/summary", { method: "POST", json: { range, ...window } }),
  sendReport: () => request<{ status: "sent"; messageId: string; provider?: string; total?: number } | { status: "skipped"; reason: string } | { status: "duplicate"; total?: number } | { status: "failed"; code: string }>("/api/matan/report", { method: "POST", json: {} }),
  /** Sends a sample alert email to the signed-in user's configured address (Settings → Notifications). */
  sendTestAlert: () => request<{ status: "sent"; messageId: string; provider?: string } | { status: "skipped"; reason: string } | { status: "duplicate" } | { status: "failed"; code: string }>("/api/matan/notifications/test", { method: "POST", json: {} }),
};

export function matanErrorFrom(e: unknown): MatanAiErrorPayload | null {
  if (e instanceof ApiError && e.payload && typeof e.payload === "object" && "error" in e.payload) {
    const err = (e.payload as { error?: Partial<MatanAiErrorPayload> }).error;
    if (err?.code) return { code: err.code, title: err.title ?? "AI analysis unavailable", message: err.message ?? "" };
  }
  return null;
}

import { request, ApiError } from "./client";
import type { RingEvent } from "@/lib/types";
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
};

export function matanErrorFrom(e: unknown): MatanAiErrorPayload | null {
  if (e instanceof ApiError && e.payload && typeof e.payload === "object" && "error" in e.payload) {
    const err = (e.payload as { error?: Partial<MatanAiErrorPayload> }).error;
    if (err?.code) return { code: err.code, title: err.title ?? "AI analysis unavailable", message: err.message ?? "" };
  }
  return null;
}

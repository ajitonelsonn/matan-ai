import type { MatanAIAnalysis } from "./schema";
import { LOW_CONFIDENCE } from "./decision";

/**
 * Pure decision: is a full Ring video clip worth its ~2-4x token cost after the
 * snapshot (or context-only) pass? Kept side-effect free for unit tests.
 */
export interface EscalationContext {
  securityMode: string;
  quietHours: boolean;
  relatedRecentCount: number;
  hadSnapshot: boolean;
  /** Budget guard result (video disabled at >= 80% of the monthly token budget). */
  videoAllowed: boolean;
  /** Clip length the request would use; skip trivial clips. */
  clipDurationMs: number;
  /** User explicitly asked for video. */
  requested?: boolean;
}

export function shouldEscalateToVideo(first: MatanAIAnalysis | null, ctx: EscalationContext): { ok: boolean; reason: string } {
  if (!ctx.videoAllowed) return { ok: false, reason: "video disabled by token budget guard" };
  if (ctx.clipDurationMs < 2000) return { ok: false, reason: "clip too short to add value" };
  if (ctx.requested) return { ok: true, reason: "requested by user" };
  if (!first) return { ok: true, reason: "no snapshot available - video is the only media" };
  if (first.category === "unknown") return { ok: true, reason: "snapshot analysis was inconclusive" };
  if (first.confidence < LOW_CONFIDENCE) return { ok: true, reason: `snapshot confidence low (${Math.round(first.confidence * 100)}%)` };
  const night = ctx.securityMode === "night" || ctx.quietHours;
  const personLike = first.category === "person" || first.category === "motion" || first.category === "unusual_activity";
  if (night && personLike) return { ok: true, reason: "person-like activity during night monitoring" };
  if (ctx.relatedRecentCount >= 2 && personLike) return { ok: true, reason: `repeated activity (${ctx.relatedRecentCount} related events)` };
  return { ok: false, reason: "snapshot analysis sufficient" };
}

/* ---------------------------------------------------------------------------
   Matan AI intelligence schema + runtime validation.
   The model's output is untrusted: it is validated here before anything
   reaches the Decision Engine or the UI.
--------------------------------------------------------------------------- */

export type MatanEventCategory = "delivery" | "person" | "vehicle" | "motion" | "animal" | "doorbell" | "unusual_activity" | "unknown";
export type MatanPriority = "normal" | "low" | "medium" | "high";
export type MatanAction = "none" | "review" | "notify" | "email";
export type AnalysisStatus = "pending" | "analyzing" | "complete" | "failed";

export interface MatanAIAnalysis {
  summary: string;
  category: MatanEventCategory;
  confidence: number; // 0..1
  observations: string[];
  uncertainty?: string;
}

export interface MatanDecision {
  priority: MatanPriority;
  action: MatanAction;
  reasons: string[];
  explanation: string;
}

export interface MatanEventIntelligence {
  analysis: MatanAIAnalysis;
  decision: MatanDecision;
  analyzedAt: string;
  model: string;
  /** Whether media (image/video) was supplied to the model. false = context-only analysis. */
  mediaAnalyzed: boolean;
  /** Where the media came from, or why none was available. */
  mediaSource?: "ring-snapshot" | "ring-clip" | "none";
  /** Set when the analysis was escalated from snapshot to video. */
  escalatedFrom?: "snapshot" | "context";
  usage?: { inputTokens?: number; outputTokens?: number };
  mediaNote?: string;
  /** Matan Care Context + Smart Rules outcome (deterministic), or the evaluation failure. */
  careDecision?: import("./rules/types").RuleDecision | import("./rules/types").RuleFailure;
}

export const CATEGORIES: readonly MatanEventCategory[] = ["delivery", "person", "vehicle", "motion", "animal", "doorbell", "unusual_activity", "unknown"];

const MAX_TEXT = 600;
const clampText = (v: unknown, max = MAX_TEXT) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export class MatanSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatanSchemaError";
  }
}

/**
 * Validate and normalize the model's JSON into MatanAIAnalysis.
 * Rejects (throws MatanSchemaError) rather than passing arbitrary data through.
 * Any priority/action fields the model emits are ignored on purpose.
 */
export function validateAnalysis(raw: unknown): MatanAIAnalysis {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new MatanSchemaError("Analysis must be a JSON object");
  const o = raw as Record<string, unknown>;

  const summary = clampText(o.summary);
  if (!summary) throw new MatanSchemaError("Missing summary");

  const category = typeof o.category === "string" ? (o.category.trim().toLowerCase().replace(/[\s-]+/g, "_") as MatanEventCategory) : undefined;
  if (!category || !CATEGORIES.includes(category)) throw new MatanSchemaError(`Invalid category: ${String(o.category)}`);

  let confidence = typeof o.confidence === "number" ? o.confidence : typeof o.confidence === "string" ? Number.parseFloat(o.confidence) : NaN;
  if (Number.isFinite(confidence) && confidence > 1 && confidence <= 100 && Number.isInteger(confidence)) confidence = confidence / 100; // tolerate whole-number percentages (e.g. 85)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new MatanSchemaError("Confidence must be a number between 0 and 1");

  const observations = Array.isArray(o.observations) ? o.observations.map((x) => clampText(x, 300)).filter((x): x is string => Boolean(x)).slice(0, 8) : [];
  if (!observations.length) throw new MatanSchemaError("At least one observation is required");

  const uncertainty = clampText(o.uncertainty, 300);

  return { summary, category, confidence: Math.round(confidence * 1000) / 1000, observations, uncertainty };
}

/** Extract the first complete JSON object from model text (handles code fences / prose around it). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) throw new MatanSchemaError("No JSON object in model output");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch (e) {
          throw new MatanSchemaError(`Model output is not valid JSON: ${e instanceof Error ? e.message : "parse error"}`);
        }
      }
    }
  }
  throw new MatanSchemaError("Unterminated JSON object in model output");
}

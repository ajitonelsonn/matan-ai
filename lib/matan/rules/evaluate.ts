import type { RingEvent } from "@/lib/types";
import type { MatanAIAnalysis, MatanDecision } from "../schema";
import { LOW_CONFIDENCE } from "./defaults";
import { inWindow, quietHoursActive, ruleEventType, sensitivityFor } from "./context";
import type { CareContext, MatanRule, RiskLevel, RuleAction, RuleDecision, RuleEventType } from "./types";

/**
 * Deterministic Smart Rules evaluator - a pure function. No Ring, Bedrock, SES, DynamoDB or S3.
 *
 * Precedence (spec §7), each step may only raise or, for suppression steps, lower the action
 * while an ESCALATE decided earlier is never overridden:
 *   1. safety constraints          → low-confidence analysis → MONITOR (unless user opted in)
 *   2. high-risk escalation         → risk HIGH → ESCALATE
 *   3. explicit user rules          → first enabled match by priority (custom rules, package rule)
 *   4. repeated-event rules         → N same-type events within M minutes → ESCALATE
 *   5. quiet-hours suppression      → non-escalated → MONITOR
 *   6. notification preferences     → sensitivity raises/lowers NOTIFY; email off keeps MONITOR
 *   7. default action               → from the existing Decision Engine
 */
export interface EvaluateInput {
  event: RingEvent;
  analysis: MatanAIAnalysis;
  /** Existing Decision Engine output - stays authoritative for risk/priority. */
  decision: MatanDecision;
  careContext: CareContext;
  rules: MatanRule[];
  /** Persisted history (real events only) used for repeated-event detection. */
  recentEvents: RingEvent[];
  now: Date;
}

const RANK: Record<RuleAction, number> = { IGNORE: 0, MONITOR: 1, NOTIFY: 2, ESCALATE: 3 };

/** Baseline from the existing engine's action/priority. */
export function defaultAction(decision: MatanDecision): RuleAction {
  if (decision.action === "email") return "ESCALATE";
  if (decision.action === "notify") return "NOTIFY";
  if (decision.action === "review") return "MONITOR";
  return decision.priority === "normal" ? "IGNORE" : "MONITOR";
}

/** Category of a persisted event as the rules see it (Nova category when analyzed, else Ring type). */
export function eventTypeOf(e: RingEvent): RuleEventType | "other" {
  return ruleEventType(e.intelligence?.analysis.category, e);
}

/** Count real events of the given types within the window ending at the event, including the event itself. */
export function countRepeated(event: RingEvent, recent: RingEvent[], types: RuleEventType[] | undefined, withinMinutes: number, deviceIds?: string[]): number {
  const t = new Date(event.timestamp).getTime();
  const from = t - withinMinutes * 60_000;
  const matches = (e: RingEvent) => {
    const ts = new Date(e.timestamp).getTime();
    if (!(ts >= from && ts <= t)) return false;
    if (deviceIds?.length && !deviceIds.includes(e.cameraId ?? "")) return false;
    if (e.ringEventType === "on_demand" && !e.intelligence) return false; // unanalyzed live views are not detections
    const ty = eventTypeOf(e);
    return types?.length ? types.includes(ty as RuleEventType) : true;
  };
  const others = recent.filter((e) => e.id !== event.id && matches(e));
  return others.length + 1;
}

function ruleMatches(rule: MatanRule, input: EvaluateInput, facts: { risk: RiskLevel; type: RuleEventType | "other" }): { ok: boolean; repeated?: number } {
  const c = rule.conditions;
  if (c.eventTypes?.length && !c.eventTypes.includes(facts.type as RuleEventType)) return { ok: false };
  if (c.deviceIds?.length && !c.deviceIds.includes(input.event.cameraId ?? "")) return { ok: false };
  if (c.riskLevels?.length && !c.riskLevels.includes(facts.risk)) return { ok: false };
  if (c.timeWindow && !inWindow(input.now, c.timeWindow.start, c.timeWindow.end, input.careContext.timezone)) return { ok: false };
  if (c.minimumConfidence !== undefined && input.analysis.confidence < c.minimumConfidence) return { ok: false };
  if (c.repeatedWithinMinutes && c.minimumOccurrences) {
    const n = countRepeated(input.event, input.recentEvents, c.eventTypes, c.repeatedWithinMinutes, c.deviceIds);
    return n >= c.minimumOccurrences ? { ok: true, repeated: n } : { ok: false, repeated: n };
  }
  return { ok: true };
}

export function evaluateMatanRules(input: EvaluateInput): RuleDecision {
  const { analysis, decision, careContext: care, now } = input;
  const risk: RiskLevel = decision.priority;
  const type = ruleEventType(analysis.category, input.event);
  const quiet = quietHoursActive(care, now);
  const evaluatedAt = now.toISOString();
  const matched: string[] = [];
  const base = defaultAction(decision);

  if (!care.enabled) {
    return { action: base, matchedRuleIds: [], reason: `Care context is off - action follows the Matan Decision Engine (${decision.priority} / ${decision.action}).`, confidence: analysis.confidence, evaluatedAt, facts: { quietHoursActive: false, risk, eventType: type, careEnabled: false } };
  }

  const enabled = input.rules.filter((r) => r.enabled);
  const builtin = (k: MatanRule["builtin"]) => enabled.find((r) => r.builtin === k);
  let action: RuleAction = base;
  const reasons: string[] = [];
  let repeatedCount: number | undefined;

  // 1. Safety: low-confidence analyses never notify unless the user opted in.
  const low = builtin("low-confidence");
  const lowThreshold = low?.conditions.minimumConfidence ?? LOW_CONFIDENCE;
  const lowConfidence = analysis.confidence < lowThreshold;
  if (lowConfidence && low && !care.notificationPreferences.lowConfidence && risk !== "high") {
    action = low.action.type;
    matched.push(low.id);
    reasons.push(`Confidence ${Math.round(analysis.confidence * 100)}% is below ${Math.round(lowThreshold * 100)}%; monitoring instead of notifying.`);
    return finish();
  }

  // 2. High-risk escalation (never suppressed by anything later).
  const high = builtin("high-risk");
  if (high && risk === "high") {
    action = high.action.type;
    matched.push(high.id);
    reasons.push(quiet ? "High-risk event requires escalation even during quiet hours." : "High-risk event detected.");
    return finish();
  }

  // 3. Explicit user rules (custom + the package rule), lowest priority number first.
  const explicit = enabled.filter((r) => !r.builtin || r.builtin === "package").sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  let explicitHit: MatanRule | undefined;
  for (const r of explicit) {
    if (r.conditions.repeatedWithinMinutes) continue; // repeated rules are step 4
    if (ruleMatches(r, input, { risk, type }).ok) {
      explicitHit = r;
      break;
    }
  }
  if (explicitHit) {
    action = explicitHit.action.type;
    matched.push(explicitHit.id);
    reasons.push(`Rule "${explicitHit.name}" matched (${describeConditions(explicitHit)}).`);
    if (action === "ESCALATE") return finish();
  }

  // 4. Repeated-event rules (built-in + any custom rule with a repetition window).
  if (care.notificationPreferences.repeatedEvents) {
    const repeatedRules = enabled.filter((r) => r.conditions.repeatedWithinMinutes && r.conditions.minimumOccurrences).sort((a, b) => a.priority - b.priority);
    for (const r of repeatedRules) {
      const m = ruleMatches(r, input, { risk, type });
      if (m.repeated !== undefined) repeatedCount = Math.max(repeatedCount ?? 0, m.repeated);
      if (m.ok) {
        if (RANK[r.action.type] >= RANK[action]) action = r.action.type;
        matched.push(r.id);
        reasons.push(`${m.repeated} ${type} events within ${r.conditions.repeatedWithinMinutes} minutes (rule "${r.name}").`);
        if (action === "ESCALATE") return finish();
        break;
      }
    }
  }

  // 5. Quiet hours suppress everything that is not an escalation.
  const qh = builtin("quiet-hours");
  if (quiet && qh && action !== "ESCALATE") {
    if (RANK[action] > RANK[qh.action.type]) {
      action = qh.action.type;
      matched.push(qh.id);
      reasons.push(`Event occurred during quiet hours (${care.quietHours.start}–${care.quietHours.end} ${care.timezone}) and did not meet escalation criteria.`);
    }
    return finish();
  }

  // 6. Notification preferences / sensitivity (never touch ESCALATE; never bypass an explicit IGNORE rule).
  const sens = sensitivityFor(care, type);
  if (!explicitHit && sens && action !== "ESCALATE") {
    if (sens === "high" && action !== "NOTIFY" && !lowConfidence) {
      action = "NOTIFY";
      reasons.push(`${cap(type)} sensitivity is high - notifying on this event.`);
    } else if (sens === "low" && action === "NOTIFY") {
      action = "MONITOR";
      reasons.push(`${cap(type)} sensitivity is low - monitoring instead of notifying.`);
    }
  }

  // 7. Default.
  if (!reasons.length) reasons.push(`No rule matched - default action from the Matan Decision Engine (${decision.priority} / ${decision.action}).`);
  return finish();

  function finish(): RuleDecision {
    return { action, matchedRuleIds: matched, reason: reasons.join(" "), confidence: analysis.confidence, evaluatedAt, facts: { quietHoursActive: quiet, risk, eventType: type, repeatedCount, careEnabled: true } };
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Human summary of a rule's conditions for cards and explanations. */
export function describeConditions(rule: MatanRule): string {
  const c = rule.conditions;
  const parts: string[] = [];
  if (c.eventTypes?.length) parts.push(`event ${c.eventTypes.join("/")}`);
  if (c.riskLevels?.length) parts.push(`risk ${c.riskLevels.join("/")}`);
  if (c.minimumConfidence !== undefined) parts.push(rule.builtin === "low-confidence" ? `confidence < ${Math.round(c.minimumConfidence * 100)}%` : `confidence ≥ ${Math.round(c.minimumConfidence * 100)}%`);
  if (c.repeatedWithinMinutes && c.minimumOccurrences) parts.push(`${c.minimumOccurrences} events within ${c.repeatedWithinMinutes} min`);
  if (c.timeWindow) parts.push(`${c.timeWindow.start}–${c.timeWindow.end}`);
  if (c.deviceIds?.length) parts.push(`${c.deviceIds.length} device${c.deviceIds.length > 1 ? "s" : ""}`);
  if (rule.builtin === "quiet-hours") parts.push("quiet hours active, not high risk");
  return parts.length ? parts.join(", ") : "any event";
}

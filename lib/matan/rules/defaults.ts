import type { CareContext, MatanRule } from "./types";

export const DEFAULT_TIMEZONE = "Asia/Dili";

export function defaultCareContext(now = new Date().toISOString()): CareContext {
  return {
    enabled: true,
    timezone: DEFAULT_TIMEZONE,
    quietHours: { enabled: true, start: "22:00", end: "06:00" },
    notificationPreferences: { email: true, lowConfidence: false, repeatedEvents: true },
    sensitivity: { motion: "medium", person: "high", package: "medium", vehicle: "low" },
    updatedAt: now,
  };
}

/** Low-confidence threshold shared with the existing Decision Engine (decision.ts). */
export const LOW_CONFIDENCE = 0.55;

/** Seeded, editable, non-deletable rules. Their `builtin` kind fixes where they run in the precedence order. */
export function defaultRules(now = "2026-01-01T00:00:00.000Z"): MatanRule[] {
  return [
    { id: "rule-high-risk", name: "High Risk Escalation", enabled: true, priority: 0, builtin: "high-risk", conditions: { riskLevels: ["high"] }, action: { type: "ESCALATE" }, createdAt: now, updatedAt: now },
    { id: "rule-low-confidence", name: "Low Confidence", enabled: true, priority: 0, builtin: "low-confidence", conditions: { minimumConfidence: LOW_CONFIDENCE }, action: { type: "MONITOR" }, createdAt: now, updatedAt: now },
    { id: "rule-package", name: "Normal Package Event", enabled: true, priority: 100, builtin: "package", conditions: { eventTypes: ["package"], riskLevels: ["low", "normal"] }, action: { type: "NOTIFY" }, createdAt: now, updatedAt: now },
    { id: "rule-repeated", name: "Repeated Activity", enabled: true, priority: 0, builtin: "repeated", conditions: { eventTypes: ["motion", "person", "unusual"], repeatedWithinMinutes: 10, minimumOccurrences: 3 }, action: { type: "ESCALATE" }, createdAt: now, updatedAt: now },
    { id: "rule-quiet-hours", name: "Quiet Hours", enabled: true, priority: 0, builtin: "quiet-hours", conditions: {}, action: { type: "MONITOR" }, createdAt: now, updatedAt: now },
  ];
}

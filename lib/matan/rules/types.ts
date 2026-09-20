/**
 * Matan Care Context & Smart Rules - application-level (Matan-owned) configuration
 * layered on top of real Ring data. Nothing here is a Ring API capability.
 */
export type Sensitivity = "low" | "medium" | "high";
export type RuleAction = "IGNORE" | "MONITOR" | "NOTIFY" | "ESCALATE";
export type RuleEventType = "motion" | "person" | "package" | "vehicle" | "doorbell" | "animal" | "unusual";
export type RiskLevel = "normal" | "low" | "medium" | "high";

export interface CareContext {
  enabled: boolean;
  /** IANA timezone, e.g. "Asia/Dili". Quiet hours are evaluated in this zone. */
  timezone: string;
  quietHours: { enabled: boolean; start: string; end: string }; // HH:mm, overnight windows allowed
  notificationPreferences: { email: boolean; lowConfidence: boolean; repeatedEvents: boolean };
  sensitivity: { motion: Sensitivity; person: Sensitivity; package: Sensitivity; vehicle: Sensitivity };
  updatedAt: string;
}

export type BuiltinRuleKind = "high-risk" | "low-confidence" | "quiet-hours" | "repeated" | "package";

export interface RuleConditions {
  eventTypes?: RuleEventType[];
  deviceIds?: string[];
  /** HH:mm window in the care-context timezone; overnight allowed. */
  timeWindow?: { start: string; end: string };
  minimumConfidence?: number; // 0..1
  riskLevels?: RiskLevel[];
  repeatedWithinMinutes?: number; // > 0
  minimumOccurrences?: number; // > 0
}

export interface MatanRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Lower runs first among explicit user rules. */
  priority: number;
  conditions: RuleConditions;
  action: { type: RuleAction };
  /** Present on the seeded defaults: fixed position in the precedence order, cannot be deleted. */
  builtin?: BuiltinRuleKind;
  createdAt: string;
  updatedAt: string;
}

export interface RuleDecision {
  action: RuleAction;
  matchedRuleIds: string[];
  reason: string;
  confidence?: number;
  evaluatedAt: string;
  /** Facts the evaluation used, for the explanation UI. */
  facts: { quietHoursActive: boolean; risk: RiskLevel; eventType: RuleEventType | "other"; repeatedCount?: number; careEnabled: boolean };
}

/** Stored on the intelligence record when evaluation itself failed (distinct from a decision). */
export interface RuleFailure {
  failed: true;
  error: string;
  evaluatedAt: string;
}

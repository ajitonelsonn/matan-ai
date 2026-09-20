import type { RingEvent } from "@/lib/types";
import type { MatanEventCategory } from "../schema";
import type { CareContext, MatanRule, RuleAction, RuleConditions, RuleEventType, Sensitivity } from "./types";

/* ---- Time helpers (timezone-aware, overnight-safe) ---------------------------- */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidHHmm(v: unknown): v is string {
  return typeof v === "string" && HHMM.test(v);
}

export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Minutes since local midnight for `at` in `timezone`. */
export function localMinutes(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Is `at` inside [start, end) in `timezone`? Overnight windows (22:00 → 06:00) wrap past midnight. */
export function inWindow(at: Date, start: string, end: string, timezone: string): boolean {
  const cur = localMinutes(at, timezone);
  const s = toMin(start);
  const e = toMin(end);
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function quietHoursActive(care: CareContext, at: Date): boolean {
  if (!care.enabled || !care.quietHours.enabled) return false;
  return inWindow(at, care.quietHours.start, care.quietHours.end, care.timezone);
}

/* ---- Event classification (from real data only) ------------------------------ */

/** Nova's validated category → rule event type. Falls back to the normalized Ring event type. */
export function ruleEventType(category: MatanEventCategory | undefined, event: Pick<RingEvent, "type" | "ringEventType">): RuleEventType | "other" {
  switch (category) {
    case "delivery":
      return "package";
    case "person":
      return "person";
    case "vehicle":
      return "vehicle";
    case "motion":
      return "motion";
    case "animal":
      return "animal";
    case "doorbell":
      return "doorbell";
    case "unusual_activity":
      return "unusual";
    default:
      break;
  }
  if (event.ringEventType === "ding") return "doorbell";
  if (event.ringEventType === "motion") return "motion";
  switch (event.type) {
    case "person":
    case "package":
    case "vehicle":
    case "doorbell":
    case "animal":
      return event.type;
    case "unusual":
      return "unusual";
    default:
      return "other";
  }
}

export function sensitivityFor(care: CareContext, type: RuleEventType | "other"): Sensitivity | undefined {
  if (type === "motion" || type === "person" || type === "package" || type === "vehicle") return care.sensitivity[type];
  return undefined;
}

/* ---- Validation (reject malformed input; never silently accept) -------------- */

export const RULE_ACTIONS: readonly RuleAction[] = ["IGNORE", "MONITOR", "NOTIFY", "ESCALATE"];
export const RULE_EVENT_TYPES: readonly RuleEventType[] = ["motion", "person", "package", "vehicle", "doorbell", "animal", "unusual"];
const SENSITIVITIES: readonly Sensitivity[] = ["low", "medium", "high"];
const RISKS = ["normal", "low", "medium", "high"] as const;
const RULE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

export class ValidationError extends Error {
  status = 400 as const;
  constructor(message: string) {
    super(message);
  }
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Validate a full/partial care context patch and merge over `base`. Throws ValidationError. */
export function validateCareContext(input: unknown, base: CareContext, now = new Date().toISOString()): CareContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Care context must be an object.");
  const p = input as DeepPartial<CareContext>;
  const out: CareContext = JSON.parse(JSON.stringify(base));
  if (p.enabled !== undefined) {
    if (typeof p.enabled !== "boolean") throw new ValidationError("enabled must be a boolean.");
    out.enabled = p.enabled;
  }
  if (p.timezone !== undefined) {
    if (!isValidTimezone(p.timezone)) throw new ValidationError("timezone must be a valid IANA timezone (e.g. Asia/Dili).");
    out.timezone = p.timezone;
  }
  if (p.quietHours !== undefined) {
    const q = p.quietHours;
    if (!q || typeof q !== "object") throw new ValidationError("quietHours must be an object.");
    if (q.enabled !== undefined) {
      if (typeof q.enabled !== "boolean") throw new ValidationError("quietHours.enabled must be a boolean.");
      out.quietHours.enabled = q.enabled;
    }
    for (const k of ["start", "end"] as const) {
      if (q[k] !== undefined) {
        if (!isValidHHmm(q[k])) throw new ValidationError(`quietHours.${k} must be HH:mm.`);
        out.quietHours[k] = q[k]!;
      }
    }
  }
  if (p.notificationPreferences !== undefined) {
    const n = p.notificationPreferences;
    if (!n || typeof n !== "object") throw new ValidationError("notificationPreferences must be an object.");
    for (const k of ["email", "lowConfidence", "repeatedEvents"] as const) {
      if (n[k] !== undefined) {
        if (typeof n[k] !== "boolean") throw new ValidationError(`notificationPreferences.${k} must be a boolean.`);
        out.notificationPreferences[k] = n[k]!;
      }
    }
  }
  if (p.sensitivity !== undefined) {
    const s = p.sensitivity;
    if (!s || typeof s !== "object") throw new ValidationError("sensitivity must be an object.");
    for (const k of ["motion", "person", "package", "vehicle"] as const) {
      if (s[k] !== undefined) {
        if (!SENSITIVITIES.includes(s[k] as Sensitivity)) throw new ValidationError(`sensitivity.${k} must be low, medium or high.`);
        out.sensitivity[k] = s[k] as Sensitivity;
      }
    }
  }
  out.updatedAt = now;
  return out;
}

export function validateRuleId(id: unknown): string {
  if (typeof id !== "string" || !RULE_ID.test(id)) throw new ValidationError("Rule id must be 3-64 characters: letters, digits, '-' or '_'.");
  return id;
}

/** Validate a create/patch payload. For patches, `base` supplies the untouched fields. */
export function validateRule(input: unknown, base: MatanRule | null, now = new Date().toISOString()): MatanRule {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Rule must be an object.");
  const p = input as DeepPartial<MatanRule> & { conditions?: Partial<RuleConditions> };
  const out: MatanRule = base ? JSON.parse(JSON.stringify(base)) : { id: "", name: "", enabled: true, priority: 100, conditions: {}, action: { type: "NOTIFY" }, createdAt: now, updatedAt: now };
  if (!base) {
    out.id = p.id !== undefined ? validateRuleId(p.id) : `rule-${Math.random().toString(36).slice(2, 10)}`;
    if (out.id.startsWith("rule-") && ["rule-high-risk", "rule-low-confidence", "rule-package", "rule-repeated", "rule-quiet-hours"].includes(out.id)) throw new ValidationError("That id is reserved for a built-in rule.");
  } else if (p.id !== undefined && p.id !== base.id) throw new ValidationError("Rule id cannot be changed.");
  if (p.name !== undefined) {
    if (typeof p.name !== "string" || !p.name.trim() || p.name.trim().length > 60) throw new ValidationError("name must be 1-60 characters.");
    out.name = p.name.trim();
  }
  if (!out.name) throw new ValidationError("name is required.");
  if (p.enabled !== undefined) {
    if (typeof p.enabled !== "boolean") throw new ValidationError("enabled must be a boolean.");
    out.enabled = p.enabled;
  }
  if (p.priority !== undefined) {
    if (typeof p.priority !== "number" || !Number.isInteger(p.priority) || p.priority < 0 || p.priority > 1000) throw new ValidationError("priority must be an integer 0-1000.");
    out.priority = p.priority;
  }
  if (p.action !== undefined) {
    const t = (p.action as { type?: unknown })?.type;
    if (!RULE_ACTIONS.includes(t as RuleAction)) throw new ValidationError("action.type must be IGNORE, MONITOR, NOTIFY or ESCALATE.");
    out.action = { type: t as RuleAction };
  }
  if (p.conditions !== undefined) {
    const c = p.conditions as Record<string, unknown>;
    if (!c || typeof c !== "object" || Array.isArray(c)) throw new ValidationError("conditions must be an object.");
    const next: RuleConditions = { ...out.conditions };
    if ("eventTypes" in c) {
      if (c.eventTypes === null || c.eventTypes === undefined) delete next.eventTypes;
      else {
        if (!Array.isArray(c.eventTypes) || !c.eventTypes.every((t) => RULE_EVENT_TYPES.includes(t as RuleEventType))) throw new ValidationError(`conditions.eventTypes must be a list of: ${RULE_EVENT_TYPES.join(", ")}.`);
        next.eventTypes = c.eventTypes as RuleEventType[];
      }
    }
    if ("deviceIds" in c) {
      if (c.deviceIds === null || c.deviceIds === undefined) delete next.deviceIds;
      else {
        if (!Array.isArray(c.deviceIds) || !c.deviceIds.every((d) => typeof d === "string" && d.length > 0 && d.length <= 200)) throw new ValidationError("conditions.deviceIds must be a list of device ids.");
        next.deviceIds = c.deviceIds as string[];
      }
    }
    if ("timeWindow" in c) {
      if (c.timeWindow === null || c.timeWindow === undefined) delete next.timeWindow;
      else {
        const w = c.timeWindow as { start?: unknown; end?: unknown };
        if (!isValidHHmm(w?.start) || !isValidHHmm(w?.end)) throw new ValidationError("conditions.timeWindow.start/end must be HH:mm.");
        next.timeWindow = { start: w.start, end: w.end };
      }
    }
    if ("minimumConfidence" in c) {
      if (c.minimumConfidence === null || c.minimumConfidence === undefined) delete next.minimumConfidence;
      else {
        if (typeof c.minimumConfidence !== "number" || c.minimumConfidence < 0 || c.minimumConfidence > 1) throw new ValidationError("conditions.minimumConfidence must be between 0 and 1.");
        next.minimumConfidence = c.minimumConfidence;
      }
    }
    if ("riskLevels" in c) {
      if (c.riskLevels === null || c.riskLevels === undefined) delete next.riskLevels;
      else {
        if (!Array.isArray(c.riskLevels) || !c.riskLevels.every((r) => (RISKS as readonly string[]).includes(r as string))) throw new ValidationError("conditions.riskLevels must be a list of: normal, low, medium, high.");
        next.riskLevels = c.riskLevels as RuleConditions["riskLevels"];
      }
    }
    for (const k of ["repeatedWithinMinutes", "minimumOccurrences"] as const) {
      if (k in c) {
        if (c[k] === null || c[k] === undefined) delete next[k];
        else {
          if (typeof c[k] !== "number" || !Number.isInteger(c[k]) || (c[k] as number) <= 0 || (c[k] as number) > 100000) throw new ValidationError(`conditions.${k} must be a positive integer.`);
          next[k] = c[k] as number;
        }
      }
    }
    if ((next.repeatedWithinMinutes && !next.minimumOccurrences) || (!next.repeatedWithinMinutes && next.minimumOccurrences)) throw new ValidationError("repeatedWithinMinutes and minimumOccurrences must be set together.");
    out.conditions = next;
  }
  out.updatedAt = now;
  return out;
}

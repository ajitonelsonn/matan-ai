import { test } from "node:test";
import assert from "node:assert/strict";
import type { RingEvent } from "../lib/types";
import type { MatanAIAnalysis, MatanDecision } from "../lib/matan/schema";
import { defaultCareContext, defaultRules } from "../lib/matan/rules/defaults";
import { inWindow, quietHoursActive, validateCareContext, validateRule, ValidationError, ruleEventType } from "../lib/matan/rules/context";
import { countRepeated, evaluateMatanRules, defaultAction } from "../lib/matan/rules/evaluate";
import type { CareContext } from "../lib/matan/rules/types";

// TEST FIXTURES ONLY - synthetic events for the pure evaluator; nothing here reaches Real Mode.
const TZ = "Asia/Dili"; // UTC+9
const dili = (hhmm: string, day = "2026-09-21") => new Date(`${day}T${hhmm}:00+09:00`);
const ev = (over: Partial<RingEvent> = {}): RingEvent => ({ id: "ring-1", type: "person", title: "Motion detected", location: "Front Door", cameraId: "cam-1", timestamp: dili("13:00").toISOString(), priority: "normal", summary: "", tags: [], source: "ring", analysis: "done", ringEventType: "motion", ...over });
const analysis = (over: Partial<MatanAIAnalysis> = {}): MatanAIAnalysis => ({ summary: "s", category: "person", confidence: 0.9, observations: [], ...over });
const decision = (priority: MatanDecision["priority"], action: MatanDecision["action"] = "none"): MatanDecision => ({ priority, action, reasons: [], explanation: "" });
const care = (over: Partial<CareContext> = {}): CareContext => ({ ...defaultCareContext("2026-01-01T00:00:00.000Z"), ...over });
const run = (o: { event?: RingEvent; analysis?: MatanAIAnalysis; decision?: MatanDecision; care?: CareContext; rules?: ReturnType<typeof defaultRules>; recent?: RingEvent[]; now?: Date }) =>
  evaluateMatanRules({ event: o.event ?? ev(), analysis: o.analysis ?? analysis(), decision: o.decision ?? decision("normal"), careContext: o.care ?? care(), rules: o.rules ?? defaultRules(), recentEvents: o.recent ?? [], now: o.now ?? dili("13:00") });

test("quiet hours 22:00 → 06:00 across midnight in the user's timezone", () => {
  const c = care();
  const cases: [string, boolean][] = [["21:59", false], ["22:00", true], ["23:59", true], ["00:00", true], ["05:59", true], ["06:00", false], ["12:00", false]];
  for (const [t, expected] of cases) assert.equal(quietHoursActive(c, dili(t)), expected, t);
  assert.equal(inWindow(dili("10:00"), "09:00", "17:00", TZ), true, "same-day window");
  assert.equal(inWindow(dili("18:00"), "09:00", "17:00", TZ), false);
  assert.equal(inWindow(dili("22:30"), "22:30", "22:30", TZ), false, "empty window");
  // Not UTC: 23:30 Dili is 14:30 UTC - must still count as quiet
  assert.equal(quietHoursActive(c, new Date("2026-09-21T14:30:00Z")), true);
  assert.equal(quietHoursActive(care({ enabled: false }), dili("23:00")), false, "care off → no quiet hours");
});

test("high risk → ESCALATE, even during quiet hours", () => {
  const d = run({ decision: decision("high", "email"), now: dili("23:00") });
  assert.equal(d.action, "ESCALATE");
  assert.deepEqual(d.matchedRuleIds, ["rule-high-risk"]);
  assert.match(d.reason, /even during quiet hours/);
  assert.equal(d.facts.quietHoursActive, true);
  assert.equal(d.confidence, 0.9);
});

test("low confidence: 0.54 → MONITOR, 0.55 → normal evaluation; opt-in disables the guard", () => {
  assert.equal(run({ analysis: analysis({ confidence: 0.54 }), decision: decision("medium", "notify") }).action, "MONITOR");
  assert.deepEqual(run({ analysis: analysis({ confidence: 0.54 }), decision: decision("medium", "notify") }).matchedRuleIds, ["rule-low-confidence"]);
  assert.equal(run({ analysis: analysis({ confidence: 0.55 }), decision: decision("medium", "notify") }).action, "NOTIFY");
  assert.equal(run({ analysis: analysis({ confidence: 0.54 }), decision: decision("medium", "notify"), care: care({ notificationPreferences: { email: true, lowConfidence: true, repeatedEvents: true } }) }).action, "NOTIFY");
});

test("repeated events: 3 within 10 min → ESCALATE, 2 → no match; unanalyzed live views don't count", () => {
  const at = (m: string) => ev({ id: `ring-${m}`, timestamp: dili(m).toISOString(), intelligence: { analysis: analysis({ category: "motion" }), decision: decision("normal"), analyzedAt: "x", model: "m", mediaAnalyzed: true } });
  const current = ev({ id: "ring-now", timestamp: dili("10:09").toISOString() });
  const three = [at("10:01"), at("10:04"), at("10:07")];
  assert.equal(countRepeated(current, three, ["motion", "person"], 10), 4);
  assert.equal(countRepeated(current, three.slice(0, 1), ["motion", "person"], 10), 2);
  const d = run({ event: current, analysis: analysis({ category: "motion" }), recent: three, now: dili("10:09") });
  assert.equal(d.action, "ESCALATE");
  assert.ok(d.matchedRuleIds.includes("rule-repeated"));
  assert.equal(d.facts.repeatedCount, 4);
  assert.match(d.reason, /within 10 minutes/);
  const two = run({ event: current, analysis: analysis({ category: "motion" }), recent: [at("10:01")], now: dili("10:09") });
  assert.notEqual(two.action, "ESCALATE");
  const liveViews = [ev({ id: "lv1", ringEventType: "on_demand", timestamp: dili("10:02").toISOString() }), ev({ id: "lv2", ringEventType: "on_demand", timestamp: dili("10:05").toISOString() })];
  assert.equal(countRepeated(current, liveViews, ["motion", "person"], 10), 1, "on_demand without analysis is not a detection");
  const off = run({ event: current, analysis: analysis({ category: "motion" }), recent: three, now: dili("10:09"), care: care({ notificationPreferences: { email: true, lowConfidence: false, repeatedEvents: false } }) });
  assert.notEqual(off.action, "ESCALATE", "repeatedEvents preference off disables the rule");
});

test("quiet hours suppress non-escalations to MONITOR with an explicit reason", () => {
  const d = run({ decision: decision("medium", "notify"), now: dili("23:30") });
  assert.equal(d.action, "MONITOR");
  assert.deepEqual(d.matchedRuleIds, ["rule-quiet-hours"]);
  assert.match(d.reason, /quiet hours/);
});

test("package rule: low-risk delivery → NOTIFY; Nova cannot override a user rule", () => {
  const d = run({ analysis: analysis({ category: "delivery", summary: "Likely normal package delivery." }), decision: decision("low", "none") });
  assert.equal(d.action, "NOTIFY");
  assert.deepEqual(d.matchedRuleIds, ["rule-package"]);
  const custom = [...defaultRules(), { id: "rule-custom-1", name: "Packages while away", enabled: true, priority: 10, conditions: { eventTypes: ["package" as const], timeWindow: { start: "09:00", end: "17:00" } }, action: { type: "NOTIFY" as const }, createdAt: "x", updatedAt: "x" }];
  const c = run({ analysis: analysis({ category: "delivery" }), decision: decision("low", "none"), rules: custom, now: dili("11:00") });
  assert.deepEqual(c.matchedRuleIds, ["rule-custom-1"], "lower priority number runs first");
  const ign = [...defaultRules(), { id: "rule-ign", name: "Ignore animals", enabled: true, priority: 1, conditions: { eventTypes: ["animal" as const] }, action: { type: "IGNORE" as const }, createdAt: "x", updatedAt: "x" }];
  assert.equal(run({ analysis: analysis({ category: "animal" }), decision: decision("normal"), rules: ign }).action, "IGNORE");
});

test("sensitivity: high raises to NOTIFY, low lowers NOTIFY to MONITOR, never touches ESCALATE", () => {
  assert.equal(run({ analysis: analysis({ category: "person" }), decision: decision("normal") }).action, "NOTIFY", "person sensitivity high by default");
  assert.equal(run({ analysis: analysis({ category: "vehicle" }), decision: decision("medium", "notify") }).action, "MONITOR", "vehicle sensitivity low by default");
  assert.equal(run({ analysis: analysis({ category: "vehicle" }), decision: decision("high", "email") }).action, "ESCALATE");
  assert.equal(run({ analysis: analysis({ category: "animal" }), decision: decision("normal") }).action, "IGNORE", "no sensitivity for animals → default");
});

test("care context disabled → default action from the existing engine, no rules matched", () => {
  const d = run({ decision: decision("medium", "notify"), care: care({ enabled: false }), now: dili("23:00") });
  assert.equal(d.action, "NOTIFY");
  assert.deepEqual(d.matchedRuleIds, []);
  assert.equal(d.facts.careEnabled, false);
  assert.equal(defaultAction(decision("normal", "none")), "IGNORE");
  assert.equal(defaultAction(decision("low", "none")), "MONITOR");
  assert.equal(defaultAction(decision("medium", "review")), "MONITOR");
});

test("evaluation is deterministic for identical input", () => {
  const a = run({ decision: decision("medium", "notify"), now: dili("23:30") });
  const b = run({ decision: decision("medium", "notify"), now: dili("23:30") });
  assert.deepEqual(a, b);
});

test("event type mapping prefers Nova's category, then Ring type", () => {
  assert.equal(ruleEventType("delivery", ev()), "package");
  assert.equal(ruleEventType("unusual_activity", ev()), "unusual");
  assert.equal(ruleEventType(undefined, ev({ ringEventType: "ding", type: "other" })), "doorbell");
  assert.equal(ruleEventType("unknown", ev({ ringEventType: "on_demand", type: "other" })), "other");
});

test("validation rejects malformed care context and rules", () => {
  const base = care();
  assert.throws(() => validateCareContext({ timezone: "Mars/Olympus" }, base), ValidationError);
  assert.throws(() => validateCareContext({ quietHours: { start: "25:00" } }, base), ValidationError);
  assert.throws(() => validateCareContext({ sensitivity: { person: "extreme" } }, base), ValidationError);
  assert.throws(() => validateCareContext({ enabled: "yes" }, base), ValidationError);
  const ok = validateCareContext({ timezone: "Europe/Lisbon", quietHours: { start: "23:00", end: "07:00" }, sensitivity: { vehicle: "high" } }, base);
  assert.equal(ok.timezone, "Europe/Lisbon");
  assert.equal(ok.quietHours.end, "07:00");
  assert.equal(ok.sensitivity.vehicle, "high");
  assert.equal(ok.sensitivity.person, "high", "untouched fields kept");
  assert.throws(() => validateRule({ name: "" }, null), ValidationError);
  assert.throws(() => validateRule({ name: "x", action: { type: "DELETE_ALL" } }, null), ValidationError);
  assert.throws(() => validateRule({ name: "x", conditions: { minimumConfidence: 1.5 } }, null), ValidationError);
  assert.throws(() => validateRule({ name: "x", conditions: { repeatedWithinMinutes: -5, minimumOccurrences: 3 } }, null), ValidationError);
  assert.throws(() => validateRule({ name: "x", conditions: { repeatedWithinMinutes: 5 } }, null), ValidationError, "window without occurrences");
  assert.throws(() => validateRule({ name: "x", conditions: { eventTypes: ["laser"] } }, null), ValidationError);
  assert.throws(() => validateRule({ id: "bad id!", name: "x" }, null), ValidationError);
  assert.throws(() => validateRule({ id: "rule-high-risk", name: "x" }, null), ValidationError, "reserved id");
  const r = validateRule({ name: "  Night packages ", priority: 5, conditions: { eventTypes: ["package"], timeWindow: { start: "22:00", end: "06:00" } }, action: { type: "NOTIFY" } }, null);
  assert.equal(r.name, "Night packages");
  assert.match(r.id, /^rule-/);
  const patched = validateRule({ enabled: false }, r);
  assert.equal(patched.enabled, false);
  assert.equal(patched.name, "Night packages");
  assert.throws(() => validateRule({ id: "other" }, r), ValidationError, "id cannot change");
});

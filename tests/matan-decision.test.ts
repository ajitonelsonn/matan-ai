import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../lib/matan/decision";
import { validateAnalysis, extractJson, MatanSchemaError } from "../lib/matan/schema";
import type { MatanAIAnalysis } from "../lib/matan/schema";

const base = { deviceName: "Front Door", multipleDevices: false, relatedRecentCount: 0, securityMode: "home", quietHours: false };
const a = (over: Partial<MatanAIAnalysis>): MatanAIAnalysis => ({ summary: "Person observed near the entrance.", category: "person", confidence: 0.9, observations: ["Person detected"], ...over });

test("delivery → low / none (spec example)", () => {
  const d = decide(a({ category: "delivery", confidence: 0.94 }), base);
  assert.equal(d.priority, "low");
  assert.equal(d.action, "none");
  assert.match(d.explanation, /Likely delivery/);
  assert.ok(d.reasons.some((r) => /likely delivery/i.test(r)));
});

test("ordinary person in Home Mode → normal / none", () => {
  const d = decide(a({ confidence: 0.88 }), { ...base, relatedRecentCount: 1 });
  assert.equal(d.priority, "normal");
  assert.equal(d.action, "none");
});

test("repeated night activity across devices → high / review", () => {
  const d = decide(a({ confidence: 0.91 }), { ...base, securityMode: "night", relatedRecentCount: 3, multipleDevices: true });
  assert.equal(d.priority, "high");
  assert.equal(d.action, "review");
  assert.match(d.explanation, /Repeated activity during night monitoring across multiple monitored locations/);
  assert.doesNotMatch(d.explanation, /intruder|thief/i);
});

test("high + email automation rule → email", () => {
  const d = decide(a({}), { ...base, securityMode: "night", relatedRecentCount: 2, highPriorityEmailRule: true });
  assert.equal(d.priority, "high");
  assert.equal(d.action, "email");
});

test("low confidence never escalates automatically (Test 4)", () => {
  const d = decide(a({ confidence: 0.4 }), { ...base, securityMode: "night", relatedRecentCount: 3, multipleDevices: true });
  assert.notEqual(d.priority, "high");
  assert.equal(d.action, "review");
  assert.ok(d.reasons.some((r) => /low/i.test(r)));
});

test("model priority/action fields are ignored", () => {
  const raw = { summary: "Likely delivery", category: "delivery", confidence: 0.9, observations: ["box"], priority: "high", action: "email" };
  const analysis = validateAnalysis(raw);
  assert.equal((analysis as unknown as { priority?: string }).priority, undefined);
  const d = decide(analysis, base);
  assert.equal(d.priority, "low");
  assert.equal(d.action, "none");
});

test("schema: confidence clamped to 0..1, percentages tolerated, bad values rejected (Test 5)", () => {
  assert.equal(validateAnalysis({ summary: "x", category: "motion", confidence: 85, observations: ["y"] }).confidence, 0.85);
  assert.throws(() => validateAnalysis({ summary: "x", category: "motion", confidence: 1.7, observations: ["y"] }), MatanSchemaError);
  assert.throws(() => validateAnalysis({ summary: "x", category: "spaceship", confidence: 0.5, observations: ["y"] }), MatanSchemaError);
  assert.throws(() => validateAnalysis({ category: "motion", confidence: 0.5, observations: ["y"] }), MatanSchemaError);
  assert.throws(() => validateAnalysis("not json"), MatanSchemaError);
});

test("extractJson handles fences and prose; rejects garbage", () => {
  const obj = extractJson('Sure! ```json\n{"summary":"s","category":"motion","confidence":0.7,"observations":["o"]}\n``` done');
  assert.equal((obj as { category: string }).category, "motion");
  assert.throws(() => extractJson("no braces here"), MatanSchemaError);
  assert.throws(() => extractJson('{"summary": "unterminated'), MatanSchemaError);
});

test("on_demand live view session without detections → normal / none (user action, not a detection)", () => {
  const d = decide(a({ category: "unknown", confidence: 0.9 }), { ...base, securityMode: "night", relatedRecentCount: 3, ringEventType: "on_demand", detections: [] });
  assert.equal(d.priority, "normal");
  assert.equal(d.action, "none");
  assert.match(d.explanation, /user action/);
});

import { shouldEscalateToVideo } from "../lib/matan/escalation";
const esc = { securityMode: "home", quietHours: false, relatedRecentCount: 0, hadSnapshot: true, videoAllowed: true, clipDurationMs: 20000 };

test("escalation: confident daytime snapshot → no video", () => {
  assert.equal(shouldEscalateToVideo(a({ category: "delivery", confidence: 0.9 }), esc).ok, false);
});
test("escalation: inconclusive or low-confidence snapshot → video", () => {
  assert.equal(shouldEscalateToVideo(a({ category: "unknown" }), esc).ok, true);
  assert.equal(shouldEscalateToVideo(a({ confidence: 0.4 }), esc).ok, true);
});
test("escalation: night person-like or repeated activity → video", () => {
  assert.equal(shouldEscalateToVideo(a({ category: "person" }), { ...esc, securityMode: "night" }).ok, true);
  assert.equal(shouldEscalateToVideo(a({ category: "motion" }), { ...esc, relatedRecentCount: 3 }).ok, true);
});
test("escalation: budget guard and tiny clips block video even when requested", () => {
  assert.equal(shouldEscalateToVideo(a({ category: "unknown" }), { ...esc, videoAllowed: false, requested: true }).ok, false);
  assert.equal(shouldEscalateToVideo(a({ category: "unknown" }), { ...esc, clipDurationMs: 500 }).ok, false);
});
test("escalation: no snapshot available → video is the only media", () => {
  assert.equal(shouldEscalateToVideo(null, { ...esc, hadSnapshot: false }).ok, true);
});

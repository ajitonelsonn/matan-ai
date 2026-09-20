import { test } from "node:test";
import assert from "node:assert/strict";
import type { RingEvent } from "../lib/types";
import { eventStage, isProcessing, notificationText, stageView, timelineSteps } from "../lib/matan/event-state";

const base: RingEvent = { id: "ring-1", type: "person", title: "Motion detected", location: "Playground Device", cameraId: "ring-1", timestamp: "2026-09-20T04:00:00.000Z", priority: "normal", summary: "s", tags: [], source: "ring", analysis: "pending", ringEventType: "motion" };
const intel = { analysis: { summary: "Person near the entrance.", category: "person", confidence: 0.9, observations: ["o"] }, decision: { priority: "high", action: "email", reasons: [], explanation: "An email alert will be sent." }, analyzedAt: "2026-09-20T04:00:20.000Z", model: "amazon.nova-pro-v1:0", mediaAnalyzed: true, mediaSource: "ring-snapshot" } as RingEvent["intelligence"];

test("state machine: new → capturing → analyzing → complete / failed maps from the server fields", () => {
  assert.equal(eventStage(base), "new");
  assert.equal(eventStage({ ...base, analysis: "capturing" }), "capturing");
  assert.equal(eventStage({ ...base, analysis: "analyzing" }), "analyzing");
  assert.equal(eventStage({ ...base, analysis: "done", intelligence: intel }), "complete");
  assert.equal(eventStage({ ...base, analysis: "failed", analysisError: { code: "MATAN_AI_UNAVAILABLE", at: "x" } }), "failed");
  assert.equal(eventStage({ ...base, source: "demo", analysis: undefined }), "complete", "demo events are never 'processing'");
  assert.ok(isProcessing({ analysis: "capturing" }) && isProcessing({ analysis: "analyzing" }) && !isProcessing({ analysis: "done" }));
});

test("stage copy follows the spec's status language and marks active stages", () => {
  assert.deepEqual(stageView({ ...base, analysis: "capturing" }).label, "Capturing evidence");
  assert.equal(stageView({ ...base, analysis: "analyzing" }).active, true);
  assert.equal(stageView({ ...base, analysis: "done", intelligence: intel }).label, "Decision ready");
  assert.equal(stageView({ ...base, analysis: "failed" }).stage, "failed");
});

test("timeline uses only real timestamps and transitions pending → active → complete", () => {
  const capturing = timelineSteps({ ...base, analysis: "capturing", processing: { receivedAt: base.timestamp } });
  assert.deepEqual(capturing.map((s) => s.state), ["complete", "active", "pending", "pending", "pending", "pending", "pending"]);
  assert.equal(capturing[1].at, undefined, "no invented capture timestamp");
  const analyzing = timelineSteps({ ...base, analysis: "analyzing", processing: { receivedAt: base.timestamp, capturedAt: "2026-09-20T04:00:05.000Z" } });
  assert.deepEqual(analyzing.map((s) => s.state), ["complete", "complete", "active", "pending", "pending", "pending", "pending"]);
  const done = timelineSteps({ ...base, analysis: "done", intelligence: intel, processing: { receivedAt: base.timestamp, capturedAt: "2026-09-20T04:00:05.000Z", analyzedAt: intel!.analyzedAt, notifiedAt: "2026-09-20T04:00:25.000Z" }, notification: { status: "sent", sentAt: "2026-09-20T04:00:25.000Z", provider: "ses" } });
  assert.deepEqual(done.map((s) => s.state), ["complete", "complete", "complete", "skipped", "skipped", "complete", "complete"], "older analyses without a care decision show the rule steps as skipped");
  assert.equal(done[6].at, "2026-09-20T04:00:25.000Z");
  assert.ok(done[5].note?.startsWith("HIGH"));
  const withRules = timelineSteps({ ...base, analysis: "done", intelligence: { ...intel!, careDecision: { action: "ESCALATE", matchedRuleIds: ["rule-high-risk"], reason: "High-risk event detected.", confidence: 0.9, evaluatedAt: "2026-09-20T04:00:21.000Z", facts: { quietHoursActive: false, risk: "high", eventType: "person", careEnabled: true } } } });
  assert.deepEqual(withRules.slice(3, 6).map((s) => s.state), ["complete", "complete", "complete"]);
  assert.equal(withRules[4].note, "matched rule-high-risk");
  assert.ok(withRules[5].note?.startsWith("ESCALATE"));
  const failedRules = timelineSteps({ ...base, analysis: "done", intelligence: { ...intel!, careDecision: { failed: true, error: "boom", evaluatedAt: "x" } } });
  assert.equal(failedRules[4].state, "failed");
  assert.match(failedRules[4].note ?? "", /Rule evaluation failed/);
});

test("failed analysis and context-only analysis render distinctly", () => {
  const failed = timelineSteps({ ...base, analysis: "failed", analysisError: { code: "MATAN_AI_UNAVAILABLE", at: "x" } });
  assert.deepEqual(failed.map((s) => s.state), ["complete", "failed", "failed", "failed", "failed", "failed", "pending"]);
  assert.equal(failed[2].note, "MATAN_AI_UNAVAILABLE");
  const contextOnly = timelineSteps({ ...base, analysis: "done", intelligence: { ...intel!, mediaAnalyzed: false, mediaSource: "none", mediaNote: "No media - Ring returned no snapshot" } });
  assert.equal(contextOnly[1].state, "skipped");
  assert.match(contextOnly[1].note ?? "", /no snapshot/i);
});

test("notification status text: sent / not required / failed / off", () => {
  const done = { ...base, analysis: "done" as const, intelligence: intel };
  assert.equal(notificationText({ ...done, notification: { status: "sent", provider: "smtp" } }), "Notification sent via email (SMTP)");
  assert.equal(notificationText({ ...done, notification: { status: "skipped", reason: 'decision (normal/none) is below alert level "high"' } }), "Notification not required");
  assert.equal(notificationText({ ...done, notification: { status: "skipped", reason: "email channel disabled in user settings" } }), "Notifications off in Settings");
  assert.equal(notificationText({ ...done, notification: { status: "failed", code: "SES_ERROR" } }), "Notification could not be sent");
  assert.equal(notificationText({ ...base, analysis: "analyzing", notification: { status: "sent" } }), undefined, "nothing claimed before completion");
});

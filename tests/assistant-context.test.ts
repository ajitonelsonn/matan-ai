import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAssistantContext, buildAssistantPrompt, parseAssistantReply } from "../lib/matan/assistant-context";
import type { RingEvent } from "../lib/types";

const now = "2026-09-21T02:00:00.000Z"; // 11:00 Asia/Dili
const ev = (over: Partial<RingEvent>): RingEvent =>
  ({ id: "e", type: "package", title: "Likely delivery", summary: "", location: "Playground Device", timestamp: "2026-09-21T01:00:00.000Z", priority: "normal", tags: [], source: "ring", analysis: "done", ...over }) as RingEvent;

test("assistant context is grounded in the user's data only (today vs 7d, decisions, notifications, awaiting analysis)", () => {
  const ctx = buildAssistantContext({
    now,
    timezone: "Asia/Dili",
    devices: [{ name: "Playground Device", model: "Doorbell Pro", status: "online", capabilities: ["video"] }],
    events: [
      ev({ id: "a", intelligence: { analysis: { summary: "A courier left a parcel." }, careDecision: { action: "NOTIFY" } } as never, notification: { status: "sent", provider: "smtp" } }),
      ev({ id: "b", type: "animal", timestamp: "2026-09-18T01:00:00.000Z", analysis: "pending" }),
      ev({ id: "c", type: "vehicle", timestamp: "2026-09-01T01:00:00.000Z" }),
    ],
    session: { status: "valid", expiresAt: "2026-09-21T02:20:00.000Z" },
    care: { enabled: true, quietHours: { enabled: true, start: "22:00", end: "06:00" }, sensitivity: { motion: "medium" } },
    rules: [{ name: "Package delivered", enabled: true, action: "NOTIFY" }],
    alerts: { emailConfigured: true, level: "high" },
  });
  assert.equal(ctx.totals.today.events, 1);
  assert.equal(ctx.totals.last7d.events, 2);
  assert.equal(ctx.totals.onRecord, 3);
  assert.equal(ctx.totals.awaitingAnalysis, 1);
  assert.deepEqual(ctx.decisions7d, { NOTIFY: 1 });
  assert.equal(ctx.notifications7d.sent, 1);
  assert.equal(ctx.session?.minutesLeft, 20);
  assert.equal(ctx.recentEvents[0].id, "a");
  assert.equal(ctx.recentEvents[0].notified, "sent via smtp");
  assert.equal(ctx.recentEvents[1].decision, "awaiting analysis");
  const prompt = buildAssistantPrompt(ctx, [{ id: "1", role: "user", content: "hi", timestamp: now }], "What happened today?");
  assert.match(prompt, /Conversation so far:\nUser: hi/);
  assert.match(prompt, /User question: What happened today\?$/);
});

test("model replies are parsed tolerantly and related ids are validated", () => {
  const known = new Set(["a", "b"]);
  const ok = parseAssistantReply('```json\n{"answer":"One delivery today.","relatedEventIds":["a","zzz"],"highlights":["Parcel at 10:00", ""]}\n```', known);
  assert.deepEqual(ok, { answer: "One delivery today.", relatedEventIds: ["a"], highlights: ["Parcel at 10:00"] });
  const plain = parseAssistantReply("Nothing unusual happened today.", known);
  assert.equal(plain.answer, "Nothing unusual happened today.");
  assert.deepEqual(plain.relatedEventIds, []);
});

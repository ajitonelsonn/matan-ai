import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPeriodContext, buildSummaryPrompt } from "../lib/matan/insights-summary";
import { resolveWindow, rangeLabel } from "../lib/mock/insights";
import { isoDate } from "../lib/mock/clock";
import type { RingEvent } from "../lib/types";

const ev = (over: Partial<RingEvent>): RingEvent =>
  ({
    id: "e",
    type: "package",
    title: "Likely delivery",
    summary: "",
    location: "Playground Device",
    timestamp: "2026-09-21T01:00:00.000Z",
    priority: "normal",
    tags: [],
    source: "ring",
    analysis: "done",
    ...over,
  }) as RingEvent;

test("period context aggregates real events, decisions and notifications without inventing anything", () => {
  const events = [
    ev({ id: "1", intelligence: { careDecision: { action: "NOTIFY", matchedRuleIds: ["rule-package"], reason: "", evaluatedAt: "", facts: {} } } as never, notification: { status: "sent" } }),
    ev({ id: "2", type: "animal", title: "Animal detected", priority: "important", intelligence: { careDecision: { action: "ESCALATE", matchedRuleIds: [], reason: "", evaluatedAt: "", facts: {} } } as never }),
    ev({ id: "3", type: "vehicle", analysis: "pending", notification: { status: "failed" } }),
  ];
  const ctx = buildPeriodContext(events, "7d", "Sep 15 – Sep 21, 2026", "Asia/Dili");
  assert.equal(ctx.totals.events, 3);
  assert.equal(ctx.totals.analyzed, 2);
  assert.deepEqual(ctx.totals.byType, { package: 1, animal: 1, vehicle: 1 });
  assert.deepEqual(ctx.decisions, { NOTIFY: 1, ESCALATE: 1 });
  assert.deepEqual(ctx.notifications, { sent: 1, failed: 1, skipped: 0 });
  assert.equal(ctx.highlights.length, 2, "only analyzed events become highlights");
  assert.equal(ctx.highlights[0].priority, "important", "important events are listed first");
  assert.match(buildSummaryPrompt(ctx), /Sep 15 – Sep 21, 2026/);
});

test("custom windows are clamped to today and 1..90 days; presets are unchanged", () => {
  assert.deepEqual(resolveWindow("7d"), { days: 7, endOffset: 0 });
  assert.deepEqual(resolveWindow("custom", null), { days: 14, endOffset: 0 });
  const w = resolveWindow("custom", { from: isoDate(-9), to: isoDate(-2) });
  assert.deepEqual(w, { days: 8, endOffset: -2 });
  assert.deepEqual(resolveWindow("custom", { from: isoDate(-3), to: isoDate(5) }), { days: 4, endOffset: 0 }, "future end date clamps to today");
  assert.equal(resolveWindow("custom", { from: isoDate(-200), to: isoDate(0) }).days, 90);
  assert.equal(resolveWindow("custom", { from: "nope", to: isoDate(0) }).days, 14, "invalid dates fall back to the default window");
  assert.match(rangeLabel("custom", { from: isoDate(-9), to: isoDate(-2) }), /–/);
});

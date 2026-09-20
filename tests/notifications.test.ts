import { test } from "node:test";
import assert from "node:assert/strict";
import type { RingEvent, SettingsData } from "../lib/types";
import type { MatanEventIntelligence } from "../lib/matan/schema";
import { defaultSettings } from "../lib/mock/settings";
import { buildEventEmail, emailPrefs, notifyByEmail, shouldEmail, type NotificationDeps, type NotificationRecord } from "../lib/matan/notification-email";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const settingsWith = (address: string | undefined, enabled = true, level?: "high" | "medium" | "low"): SettingsData => {
  const s = clone(defaultSettings);
  s.notifications.emailAddress = address;
  s.notifications.channels.email = enabled;
  s.notifications.alertLevel = level;
  return s;
};
const event: RingEvent = { id: "EVT-1", type: "person", title: "Person detected", location: "Front Door", cameraId: "ring-1", timestamp: "2026-09-18T12:10:00.000Z", priority: "normal", summary: "", tags: ["motion"], source: "ring", analysis: "pending", ringEventType: "motion" };
const intel = (action: MatanEventIntelligence["decision"]["action"]): MatanEventIntelligence => ({
  analysis: { summary: "Unknown person lingering at the door at night.", category: "person", confidence: 0.88, observations: ["Adult near the entrance", "No package visible"] },
  decision: { priority: action === "email" ? "high" : "low", action, reasons: ["r"], explanation: "An email alert will be sent." },
  analyzedAt: "2026-09-18T12:10:05.000Z",
  model: "amazon.nova-pro-v1:0",
  mediaAnalyzed: true,
});

/** In-memory stand-in for DynamoDB NOTIFICATION# records + a fake SES. */
function fakeDeps(settings: SettingsData, opts: { fail?: boolean } = {}) {
  const records = new Map<string, NotificationRecord>();
  const sent: { to: string; subject: string; text: string; html?: string }[] = [];
  const logs: Record<string, unknown>[] = [];
  const deps: NotificationDeps = {
    settings: () => settings,
    appBaseUrl: "http://localhost:3000",
    read: async (id, kind) => records.get(`${id}#${kind}`) ?? null,
    claim: async (id, kind, r) => (records.has(`${id}#${kind}`) ? false : (records.set(`${id}#${kind}`, r), true)),
    write: async (id, kind, r) => void records.set(`${id}#${kind}`, r),
    send: async (n) => {
      if (opts.fail) throw Object.assign(new Error("MessageRejected"), { code: "SES_MESSAGE_REJECTED" });
      sent.push(n);
      return { messageId: `msg-${sent.length}` };
    },
    log: (e) => logs.push(e),
  };
  return { deps, records, sent, logs };
}

test("recipient comes from the user's own settings, validated", () => {
  assert.deepEqual(emailPrefs(settingsWith("Alice@Example.com")), { enabled: true, address: "alice@example.com", level: "high" });
  assert.deepEqual(emailPrefs(settingsWith("not-an-email")), { enabled: true, address: null, level: "high" });
  assert.deepEqual(emailPrefs(settingsWith("a@b.co", false)), { enabled: false, address: "a@b.co", level: "high" });
  assert.equal(emailPrefs(settingsWith("a@b.co", true, "low")).level, "low");
});

test("only the existing decision action 'email' emails; demo data never does", () => {
  const s = settingsWith("a@b.co");
  assert.equal(shouldEmail(event, intel("email"), s).send, true);
  for (const a of ["none", "review", "notify"] as const) assert.equal(shouldEmail(event, intel(a), s).send, false, a);
  assert.equal(shouldEmail({ ...event, source: "demo" }, intel("email"), s).send, false);
  assert.equal(shouldEmail(event, intel("email"), settingsWith("a@b.co", false)).send, false);
  assert.equal(shouldEmail(event, intel("email"), settingsWith(undefined)).send, false);
});

test("alert level is a minimum priority: low ⊇ medium ⊇ high; 'normal' never emails", () => {
  const withPriority = (priority: "normal" | "low" | "medium" | "high") => ({ ...intel("review"), decision: { ...intel("review").decision, priority } });
  const table: Record<"high" | "medium" | "low", Record<string, boolean>> = {
    high: { normal: false, low: false, medium: false, high: true },
    medium: { normal: false, low: false, medium: true, high: true },
    low: { normal: false, low: true, medium: true, high: true },
  };
  for (const level of ["high", "medium", "low"] as const)
    for (const priority of ["normal", "low", "medium", "high"] as const)
      assert.equal(shouldEmail(event, withPriority(priority), settingsWith("a@b.co", true, level)).send, table[level][priority], `${level}/${priority}`);
  assert.equal(shouldEmail({ ...event, source: "demo" }, withPriority("high"), settingsWith("a@b.co", true, "low")).send, false, "demo data still never emails");
  assert.ok(buildEventEmail(event, withPriority("low"), "http://x").subject.startsWith("Matan AI Update —"));
  assert.ok(buildEventEmail(event, intel("email"), "http://x").subject.startsWith("Matan AI Alert —"));
});

test("email content uses existing event/analysis fields and contains no secrets", () => {
  const m = buildEventEmail(event, intel("email"), "http://localhost:3000/");
  assert.equal(m.subject, "Matan AI Alert — Person detected");
  for (const part of ["Event: Person detected", "Device: Front Door", "Priority: High", "Unknown person lingering", "Adult near the entrance", "Open Matan AI: http://localhost:3000/events/EVT-1"]) assert.ok(m.text.includes(part), part);
  assert.ok(m.html.includes("<!doctype html>") && m.html.includes("Front Door") && m.html.includes("http://localhost:3000/events/EVT-1"));
  assert.doesNotMatch(m.text + m.html, /token|Bearer|AKIA|s3:\/\/|amazonaws\.com/i);
});

test("HTML escapes untrusted text", () => {
  const m = buildEventEmail({ ...event, title: "<script>alert(1)</script>" }, intel("email"), "http://localhost:3000");
  assert.ok(!m.html.includes("<script>") && m.html.includes("&lt;script&gt;"));
});

test("decision false → no SES call; decision true → one SES call to the user's address", async () => {
  const no = fakeDeps(settingsWith("a@b.co"));
  assert.equal((await notifyByEmail(event, intel("review"), no.deps)).status, "skipped");
  assert.equal(no.sent.length, 0);
  const yes = fakeDeps(settingsWith("a@b.co"));
  assert.deepEqual(await notifyByEmail(event, intel("email"), yes.deps), { status: "sent", messageId: "msg-1" });
  assert.equal(yes.sent.length, 1);
  assert.equal(yes.sent[0].to, "a@b.co");
  assert.equal(yes.records.get("EVT-1#EMAIL")?.status, "sent");
  assert.ok(yes.logs.some((l) => l.event === "email_notification_sent"));
});

test("duplicate processing of the same event sends one email", async () => {
  const f = fakeDeps(settingsWith("a@b.co"));
  await notifyByEmail(event, intel("email"), f.deps);
  assert.deepEqual(await notifyByEmail(event, intel("email"), f.deps), { status: "duplicate" });
  assert.deepEqual(await notifyByEmail(event, intel("email"), f.deps), { status: "duplicate" });
  assert.equal(f.sent.length, 1);
});

test("user A's flow can only use user A's settings (deps are per-user)", async () => {
  const a = fakeDeps(settingsWith("a@b.co"));
  const b = fakeDeps(settingsWith("b@b.co"));
  await notifyByEmail(event, intel("email"), a.deps);
  await notifyByEmail(event, intel("email"), b.deps);
  assert.deepEqual(a.sent.map((m) => m.to), ["a@b.co"]);
  assert.deepEqual(b.sent.map((m) => m.to), ["b@b.co"]);
});

test("SES failure is recorded, logged safely and never throws; a later attempt retries", async () => {
  const s = settingsWith("a@b.co");
  const failing = fakeDeps(s, { fail: true });
  assert.deepEqual(await notifyByEmail(event, intel("email"), failing.deps), { status: "failed", code: "SES_MESSAGE_REJECTED" });
  assert.equal(failing.records.get("EVT-1#EMAIL")?.status, "failed");
  assert.ok(failing.logs.some((l) => l.event === "email_notification_failed" && l.code === "SES_MESSAGE_REJECTED"));
  // Same records, working SES → retry succeeds exactly once
  const retry = fakeDeps(s);
  retry.records.set("EVT-1#EMAIL", { status: "failed", code: "SES_MESSAGE_REJECTED" });
  assert.equal((await notifyByEmail(event, intel("email"), retry.deps)).status, "sent");
  assert.equal(retry.sent.length, 1);
});

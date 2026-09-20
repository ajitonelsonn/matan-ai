import type { RingEvent, SettingsData } from "@/lib/types";
import type { MatanEventIntelligence } from "./schema";

/**
 * Pure notification logic (no AWS, no server-only imports - unit-testable):
 * should this finalized Matan decision email the user, and what does the email say?
 */
export type NotificationKind = "EMAIL";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export type AlertLevel = "high" | "medium" | "low" | "all";

export interface NotificationPrefs {
  enabled: boolean;
  address: string | null;
  level: AlertLevel;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Recipient + enablement from the *user's own* settings (resolved server-side from their partition). */
export function emailPrefs(settings: SettingsData): NotificationPrefs {
  const n = settings.notifications;
  const address = (n.emailAddress ?? "").trim().toLowerCase();
  const level: AlertLevel = n.alertLevel === "low" || n.alertLevel === "medium" || n.alertLevel === "all" ? n.alertLevel : "high";
  return { enabled: Boolean(n.channels?.email), address: EMAIL_RE.test(address) ? address : null, level };
}

export type EmailGate = { send: true } | { send: false; reason: string };

const PRIORITY_RANK: Record<MatanEventIntelligence["decision"]["priority"], number> = { normal: 0, low: 1, medium: 2, high: 3 };
const LEVEL_RANK: Record<AlertLevel, number> = { all: 0, low: 1, medium: 2, high: 3 };

/**
 * Does this finalized decision clear the user's minimum alert level?
 * "low" → low/medium/high are emailed · "medium" → medium/high · "high" → high only ·
 * "all" → every completed analysis, including "normal" (nothing of concern) - for demos/simulator testing.
 * Decision Engine output is reused, never re-derived.
 */
export function meetsAlertLevel(intelligence: MatanEventIntelligence, level: AlertLevel): boolean {
  return PRIORITY_RANK[intelligence.decision.priority] >= LEVEL_RANK[level];
}

/**
 * Reuses the existing Decision Engine output. Default level "high" emails only high-priority
 * decisions; the user can lower the threshold to "medium" or "low" in Settings. Demo/mock events never email.
 */
export function shouldEmail(event: RingEvent, intelligence: MatanEventIntelligence, settings: SettingsData): EmailGate {
  if (event.source !== "ring") return { send: false, reason: "not a Ring event (demo/mock data never emails)" };
  const prefs = emailPrefs(settings);
  if (!prefs.enabled) return { send: false, reason: "email channel disabled in user settings" };
  if (!prefs.address) return { send: false, reason: "no valid notification email address in user settings" };
  if (!meetsAlertLevel(intelligence, prefs.level)) return { send: false, reason: `decision (${intelligence.decision.priority}/${intelligence.decision.action}) is below alert level "${prefs.level}"` };
  return { send: true };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dili" });

/** Concise text + HTML from existing event/analysis fields. Never includes tokens, credentials or storage URLs. */
export function buildEventEmail(event: RingEvent, intelligence: MatanEventIntelligence, appBaseUrl: string): EmailContent {
  const base = appBaseUrl.replace(/\/$/, "");
  const link = `${base}/events/${encodeURIComponent(event.id)}`;
  const time = `${fmt.format(new Date(event.timestamp))} (Asia/Dili)`;
  const priority = cap(intelligence.decision.priority);
  const urgent = intelligence.decision.priority === "high" || intelligence.decision.action === "email";
  const subject = `${urgent ? "Matan AI Alert" : "Matan AI Update"} — ${event.title}`;
  const reason = intelligence.analysis.summary || intelligence.decision.explanation;
  const observations = intelligence.analysis.observations.slice(0, 3);

  const text = [
    "Matan AI detected activity at your Ring device.",
    "",
    `Event: ${event.title}`,
    `Device: ${event.location}`,
    `Time: ${time}`,
    `Priority: ${priority}`,
    "",
    "Reason:",
    reason,
    ...(observations.length ? ["", "What Matan AI saw:", ...observations.map((o) => `- ${o}`)] : []),
    "",
    `Open Matan AI: ${link}`,
    "",
    "You receive this because email alerts are enabled in your Matan AI settings.",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b1a33">
<div style="max-width:560px;margin:0 auto;padding:28px 16px">
  <div style="background:#031326;border-radius:16px 16px 0 0;padding:20px 24px;color:#fff">
    <div style="font-size:12px;letter-spacing:.18em;font-weight:700;opacity:.85">MATAN AI</div>
    <div style="font-size:20px;font-weight:800;margin-top:6px">${esc(event.title)}</div>
  </div>
  <div style="background:#fff;border:1px solid #e3e9f2;border-top:0;border-radius:0 0 16px 16px;padding:22px 24px">
    <p style="margin:0 0 16px;font-size:15px">Matan AI detected activity at your Ring device.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#5b6b82;width:90px">Event</td><td style="padding:6px 0;font-weight:600">${esc(event.title)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6b82">Device</td><td style="padding:6px 0">${esc(event.location)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6b82">Time</td><td style="padding:6px 0">${esc(time)}</td></tr>
      <tr><td style="padding:6px 0;color:#5b6b82">Priority</td><td style="padding:6px 0"><span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${intelligence.decision.priority === "high" ? "#fde8e8;color:#b42318" : "#e6f4ff;color:#0a66c2"};font-weight:700;font-size:12px">${esc(priority)}</span></td></tr>
    </table>
    <p style="margin:18px 0 6px;font-size:13px;color:#5b6b82;font-weight:600">Reason</p>
    <p style="margin:0;font-size:14px;line-height:1.55">${esc(reason)}</p>
    ${observations.length ? `<p style="margin:16px 0 6px;font-size:13px;color:#5b6b82;font-weight:600">What Matan AI saw</p><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6">${observations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    <a href="${esc(link)}" style="display:inline-block;margin-top:22px;background:#12a8ff;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;font-size:14px">Open Matan AI</a>
    <p style="margin:22px 0 0;font-size:12px;color:#7a8799">You receive this because email alerts are enabled in your Matan AI settings.</p>
  </div>
</div></body></html>`;

  return { subject, text, html };
}

/* ---- Orchestration with injected side effects (so the flow is unit-testable) --- */

export interface NotificationRecord {
  status: "pending" | "sent" | "failed";
  messageId?: string;
  sentAt?: string;
  code?: string;
  to?: string;
  /** Which transport delivered it (ses | smtp). */
  provider?: string;
}

export interface NotificationDeps {
  settings: () => SettingsData;
  appBaseUrl: string;
  /** Idempotency store keyed by event + kind (backed by DynamoDB NOTIFICATION#{eventId}#{kind}). */
  read: (eventId: string, kind: NotificationKind) => Promise<NotificationRecord | null>;
  /** Create-if-absent; returns false when a record already exists (another sync got there first). */
  claim: (eventId: string, kind: NotificationKind, record: NotificationRecord) => Promise<boolean>;
  write: (eventId: string, kind: NotificationKind, record: NotificationRecord) => Promise<void>;
  send: (n: { to: string; subject: string; text: string; html?: string }) => Promise<{ messageId: string; provider?: string }>;
  log?: (entry: Record<string, unknown>) => void;
}

export type NotificationOutcome = { status: "sent"; messageId: string; provider?: string } | { status: "skipped"; reason: string } | { status: "duplicate" } | { status: "failed"; code: string };

/**
 * Finalized decision → (gate) → idempotency claim → SES. Never throws: SES/DB failures
 * are logged safely and reported, so Ring sync and analysis are never affected.
 */
export async function notifyByEmail(event: RingEvent, intelligence: MatanEventIntelligence, deps: NotificationDeps): Promise<NotificationOutcome> {
  const log = deps.log ?? (() => {});
  try {
    const gate = shouldEmail(event, intelligence, deps.settings());
    if (!gate.send) return { status: "skipped", reason: gate.reason };
    const to = emailPrefs(deps.settings()).address!;

    const existing = await deps.read(event.id, "EMAIL");
    if (existing?.status === "sent" || existing?.status === "pending") return { status: "duplicate" };
    if (!existing) {
      const claimed = await deps.claim(event.id, "EMAIL", { status: "pending" });
      if (!claimed) return { status: "duplicate" };
    } else {
      await deps.write(event.id, "EMAIL", { status: "pending" }); // previous attempt failed → retry
    }

    const content = buildEventEmail(event, intelligence, deps.appBaseUrl);
    try {
      const { messageId, provider } = await deps.send({ to, ...content });
      await deps.write(event.id, "EMAIL", { status: "sent", messageId, sentAt: new Date().toISOString(), to, provider });
      log({ event: "email_notification_sent", eventId: event.id, messageId, provider });
      return provider ? { status: "sent", messageId, provider } : { status: "sent", messageId };
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "SES_ERROR";
      await deps.write(event.id, "EMAIL", { status: "failed", code, to }).catch(() => undefined);
      log({ event: "email_notification_failed", eventId: event.id, code });
      return { status: "failed", code };
    }
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "NOTIFICATION_ERROR";
    log({ event: "email_notification_failed", eventId: event.id, code });
    return { status: "failed", code };
  }
}

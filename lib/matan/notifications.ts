import "server-only";
import type { RingEvent } from "@/lib/types";
import { emailPrefs } from "./notification-email";
import type { MatanEventIntelligence } from "./schema";
import { getUserSettings } from "./user-settings";
import { currentUser, currentUserSub } from "@/lib/auth/server";
import { getItem, putIfAbsent, putItem, queryPrefix, userPK } from "@/lib/aws/dynamodb";
import { APP_BASE_URL, isSesConfigured } from "@/lib/aws/ses";
import { isSmtpConfigured, sendWithFallback } from "./email-transport";
import { buildReportEmail, emailPrefs as prefsOf, notifyByEmail, summarizeDay, type NotificationDeps, type NotificationKind, type NotificationMedia, type NotificationOutcome, type NotificationRecord } from "./notification-email";
import { getRingEvents } from "@/lib/ring/overview";
import { getCareContext } from "./rules/store";
import { getMediaStream, hasMediaSync } from "./media-store";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Notification service: wires the pure notification flow to the signed-in user's
 * settings (recipient), DynamoDB idempotency records and Amazon SES.
 *
 *   PK = USER#{sub}, SK = NOTIFICATION#{eventId}#EMAIL  { status, messageId?, sentAt?, code? }
 *
 * Called at the single point where a Matan analysis is finalized (runMatanPipeline),
 * so manual and automatic analyses behave identically. The recipient is never taken
 * from the request - only from USER#{sub}/SETTINGS.
 */
const sk = (eventId: string, kind: NotificationKind) => `NOTIFICATION#${eventId}#${kind}`;

/* ---- Per-user notification status (for the event UI) ------------------------ */

export type NotificationStatus = { status: "pending" | "sent" | "failed" | "skipped"; reason?: string; sentAt?: string; provider?: string; code?: string };

declare global {
  // eslint-disable-next-line no-var
  var __matanNotificationStatus: Map<string, Map<string, NotificationStatus>> | undefined;
  // eslint-disable-next-line no-var
  var __matanNotificationHydrated: Set<string> | undefined;
}
const statusCache = (sub: string) => {
  const all = (globalThis.__matanNotificationStatus ??= new Map());
  let m = all.get(sub);
  if (!m) all.set(sub, (m = new Map()));
  return m;
};
const hydratedSet = () => (globalThis.__matanNotificationHydrated ??= new Set());

/** Load the user's NOTIFICATION# records into the cache (once per process). */
export async function hydrateNotifications(sub: string, force = false) {
  if (!force && hydratedSet().has(sub)) return;
  const items = await queryPrefix<NotificationRecord & { eventId?: string; kind?: string }>(userPK(sub), "NOTIFICATION#");
  const m = statusCache(sub);
  for (const it of items) if (it.eventId && it.kind === "EMAIL" && !it.eventId.startsWith("TEST-")) m.set(it.eventId, { status: it.status, sentAt: it.sentAt, provider: it.provider, code: it.code });
  hydratedSet().add(sub);
  console.info({ event: "dynamodb_hydrated", kind: "notifications", count: items.length });
}

/** Notification outcome for an event from the current user's cache (skips are process-local). */
export function getNotificationSync(eventId: string): NotificationStatus | null {
  const u = currentUser();
  return u ? statusCache(u.sub).get(eventId) ?? null : null;
}

function remember(sub: string, eventId: string, record: NotificationRecord) {
  statusCache(sub).set(eventId, { status: record.status, sentAt: record.sentAt, provider: record.provider, code: record.code });
}

const MAX_INLINE_SNAPSHOT_BYTES = 2_500_000;
let logoCache: { bytes: Uint8Array; contentType: string } | null | undefined;

async function logoAsset() {
  if (logoCache !== undefined) return logoCache ?? undefined;
  try {
    const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", "brand", "matan-ai-logo-160.png")));
    logoCache = { bytes, contentType: "image/png" };
  } catch {
    logoCache = null;
  }
  return logoCache ?? undefined;
}

/** Inline assets for the email: brand logo + the snapshot Matan analyzed (read through the user's own media store). */
async function emailMedia(eventId: string): Promise<NotificationMedia> {
  const out: NotificationMedia = { logo: await logoAsset(), hasClip: hasMediaSync(eventId, "clip") };
  if (!hasMediaSync(eventId, "snapshot")) return out;
  try {
    const m = await getMediaStream(eventId, "snapshot");
    const bytes = m.body instanceof Uint8Array ? m.body : new Uint8Array(await new Response(m.body).arrayBuffer());
    if (bytes.byteLength <= MAX_INLINE_SNAPSHOT_BYTES) out.snapshot = { bytes, contentType: m.contentType || "image/jpeg", capturedAt: m.capturedAt };
  } catch (e) {
    console.warn({ event: "email_snapshot_unavailable", eventId, code: (e as { code?: string })?.code ?? "error" });
  }
  return out;
}

function deps(sub: string): NotificationDeps {
  return {
    settings: getUserSettings,
    appBaseUrl: APP_BASE_URL,
    media: emailMedia,
    read: async (eventId, kind) => (await getItem<NotificationRecord & { PK: string; SK: string }>(userPK(sub), sk(eventId, kind))) ?? null,
    claim: async (eventId, kind, record) => {
      const ok = await putIfAbsent({ PK: userPK(sub), SK: sk(eventId, kind), type: "NOTIFICATION", eventId, kind, ...record });
      if (ok) remember(sub, eventId, record);
      return ok;
    },
    write: async (eventId, kind, record) => {
      await putItem({ PK: userPK(sub), SK: sk(eventId, kind), type: "NOTIFICATION", eventId, kind, ...record });
      remember(sub, eventId, record);
    },
    send: (n) => sendWithFallback(n),
    log: (entry) => (entry.event === "email_notification_failed" ? console.error(entry) : console.info(entry)),
  };
}

/** Fire after the decision is final. Never throws; returns what happened for logging/response. */
export async function notifyForIntelligence(event: RingEvent, intelligence: MatanEventIntelligence): Promise<NotificationOutcome> {
  if (!currentUser()) return { status: "skipped", reason: "no authenticated user in scope" };
  if (!isSesConfigured() && !isSmtpConfigured()) return { status: "skipped", reason: "no email provider configured (SES_FROM_EMAIL or SMTP_*)" };
  const sub = currentUserSub();
  const outcome = await notifyByEmail(event, intelligence, deps(sub));
  if (outcome.status === "skipped") {
    console.info({ event: "email_notification_skipped", eventId: event.id, reason: outcome.reason });
    if (!statusCache(sub).has(event.id)) statusCache(sub).set(event.id, { status: "skipped", reason: outcome.reason });
  }
  return outcome;
}

const TEST_COOLDOWN_MS = 60_000;

/**
 * Send a sample alert to the signed-in user's own configured address (Settings → "Send test alert").
 * Uses the same gate/content/SES path with a synthetic high-priority Ring event; one per minute per user.
 */
export async function sendTestAlert(): Promise<NotificationOutcome> {
  if (!currentUser()) return { status: "skipped", reason: "no authenticated user in scope" };
  if (!isSesConfigured() && !isSmtpConfigured()) return { status: "skipped", reason: "No email provider is configured on the server" };
  const prefs = emailPrefs(getUserSettings());
  if (!prefs.enabled || !prefs.address) return { status: "skipped", reason: "Set an alert email address in Settings → Notifications first" };
  const now = Date.now();
  const bucket = Math.floor(now / TEST_COOLDOWN_MS);
  const event: RingEvent = {
    id: `TEST-${bucket}`,
    type: "person",
    title: "Test alert — Person detected",
    location: "Front Door (sample)",
    cameraId: "test",
    timestamp: new Date(now).toISOString(),
    priority: "important",
    summary: "This is a sample Matan AI alert.",
    tags: ["test"],
    source: "ring",
    analysis: "done",
    ringEventType: "motion",
  };
  const intelligence: MatanEventIntelligence = {
    analysis: { summary: "This is a sample alert so you can confirm Matan AI email notifications reach you. No real activity was detected.", category: "person", confidence: 1, observations: ["Sample observation: a person approached the front door", "Sample observation: activity repeated during night monitoring"] },
    decision: { priority: "high", action: "email", reasons: ["Test alert requested from Settings"], explanation: "An email alert will be sent." },
    analyzedAt: new Date(now).toISOString(),
    model: "test",
    mediaAnalyzed: false,
  };
  const outcome = await notifyByEmail(event, intelligence, deps(currentUserSub()));
  if (outcome.status === "duplicate") console.info({ event: "email_notification_skipped", eventId: event.id, reason: "test alert cooldown (1/min)" });
  return outcome;
}

const REPORT_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Home → "Send Report": summarize today's real Ring events + Matan decisions and email them to the
 * user's configured alert address through the normal transport. One per 10 minutes per user.
 */
export async function sendDailyReport(): Promise<NotificationOutcome & { total?: number }> {
  if (!currentUser()) return { status: "skipped", reason: "no authenticated user in scope" };
  if (!isSesConfigured() && !isSmtpConfigured()) return { status: "skipped", reason: "No email provider is configured on the server" };
  const prefs = prefsOf(getUserSettings());
  if (!prefs.address) return { status: "skipped", reason: "Set an alert email address in Settings → Notifications first" };
  const sub = currentUserSub();
  const { events } = await getRingEvents();
  const tz = getCareContext()?.timezone ?? "Asia/Dili";
  const now = new Date();
  const summary = summarizeDay(events, now, tz);
  const key = `REPORT-${Math.floor(now.getTime() / REPORT_COOLDOWN_MS)}`;
  const d = deps(sub);
  const existing = await d.read(key, "EMAIL");
  if (existing?.status === "sent" || existing?.status === "pending") return { status: "duplicate", total: summary.total };
  if (!(await d.claim(key, "EMAIL", { status: "pending" }))) return { status: "duplicate", total: summary.total };
  const logo = await logoAsset();
  const content = buildReportEmail(summary, APP_BASE_URL, { logoCid: logo ? "matan-logo" : undefined });
  try {
    const { messageId, provider } = await d.send({ to: prefs.address, ...content, attachments: logo ? [{ filename: "matan-ai-logo.png", content: logo.bytes, contentType: logo.contentType, cid: "matan-logo" }] : undefined });
    await d.write(key, "EMAIL", { status: "sent", messageId, sentAt: now.toISOString(), to: prefs.address, provider });
    console.info({ event: "daily_report_sent", messageId, provider, total: summary.total });
    return { status: "sent", messageId, provider, total: summary.total };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "SES_ERROR";
    await d.write(key, "EMAIL", { status: "failed", code, to: prefs.address }).catch(() => undefined);
    console.error({ event: "daily_report_failed", code });
    return { status: "failed", code, total: summary.total };
  }
}

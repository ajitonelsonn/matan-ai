import "server-only";
import type { RingEvent } from "@/lib/types";
import { emailPrefs } from "./notification-email";
import type { MatanEventIntelligence } from "./schema";
import { getUserSettings } from "./user-settings";
import { currentUser, currentUserSub } from "@/lib/auth/server";
import { getItem, putIfAbsent, putItem, userPK } from "@/lib/aws/dynamodb";
import { APP_BASE_URL, isSesConfigured } from "@/lib/aws/ses";
import { isSmtpConfigured, sendWithFallback } from "./email-transport";
import { notifyByEmail, type NotificationDeps, type NotificationKind, type NotificationOutcome, type NotificationRecord } from "./notification-email";

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

function deps(sub: string): NotificationDeps {
  return {
    settings: getUserSettings,
    appBaseUrl: APP_BASE_URL,
    read: async (eventId, kind) => (await getItem<NotificationRecord & { PK: string; SK: string }>(userPK(sub), sk(eventId, kind))) ?? null,
    claim: (eventId, kind, record) => putIfAbsent({ PK: userPK(sub), SK: sk(eventId, kind), type: "NOTIFICATION", eventId, kind, ...record }),
    write: (eventId, kind, record) => putItem({ PK: userPK(sub), SK: sk(eventId, kind), type: "NOTIFICATION", eventId, kind, ...record }),
    send: (n) => sendWithFallback(n),
    log: (entry) => (entry.event === "email_notification_failed" ? console.error(entry) : console.info(entry)),
  };
}

/** Fire after the decision is final. Never throws; returns what happened for logging/response. */
export async function notifyForIntelligence(event: RingEvent, intelligence: MatanEventIntelligence): Promise<NotificationOutcome> {
  if (!currentUser()) return { status: "skipped", reason: "no authenticated user in scope" };
  if (!isSesConfigured() && !isSmtpConfigured()) return { status: "skipped", reason: "no email provider configured (SES_FROM_EMAIL or SMTP_*)" };
  const outcome = await notifyByEmail(event, intelligence, deps(currentUserSub()));
  if (outcome.status === "skipped") console.info({ event: "email_notification_skipped", eventId: event.id, reason: outcome.reason });
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

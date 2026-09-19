import "server-only";
import type { RingEvent } from "@/lib/types";
import type { MatanEventIntelligence } from "./schema";
import { getUserSettings } from "./user-settings";
import { currentUser, currentUserSub } from "@/lib/auth/server";
import { getItem, putIfAbsent, putItem, userPK } from "@/lib/aws/dynamodb";
import { APP_BASE_URL, isSesConfigured, sendEmail } from "@/lib/aws/ses";
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
    send: sendEmail,
    log: (entry) => (entry.event === "email_notification_failed" ? console.error(entry) : console.info(entry)),
  };
}

/** Fire after the decision is final. Never throws; returns what happened for logging/response. */
export async function notifyForIntelligence(event: RingEvent, intelligence: MatanEventIntelligence): Promise<NotificationOutcome> {
  if (!currentUser()) return { status: "skipped", reason: "no authenticated user in scope" };
  if (!isSesConfigured()) return { status: "skipped", reason: "SES not configured (SES_FROM_EMAIL missing)" };
  const outcome = await notifyByEmail(event, intelligence, deps(currentUserSub()));
  if (outcome.status === "skipped") console.info({ event: "email_notification_skipped", eventId: event.id, reason: outcome.reason });
  return outcome;
}

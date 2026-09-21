import "server-only";
import { authed, type ServerUser } from "./server";
import { hydrateConnected } from "@/lib/ring/session";
import { hydrateRingEvents } from "@/lib/ring/overview";
import { hydrateIntelligence } from "@/lib/matan/store";
import { hydrateUserSettings } from "@/lib/matan/user-settings";
import { hydrateMedia } from "@/lib/matan/media-store";
import { hydrateNotifications } from "@/lib/matan/notifications";
import { hydrateCare } from "@/lib/matan/rules/store";
import { isS3Configured } from "@/lib/aws/s3";

declare global {
  // eslint-disable-next-line no-var
  var __matanRuntimeLogged: boolean | undefined;
}

/** One safe line per process about which server integrations are configured (names only, never values). */
function logRuntimeConfig() {
  if (globalThis.__matanRuntimeLogged) return;
  globalThis.__matanRuntimeLogged = true;
  console.info({ event: "runtime_config", s3: isS3Configured(), ses: Boolean(process.env.SES_FROM_EMAIL), smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER), smtpPassword: Boolean(process.env.SMTP_PASSWORD), ringSessionSecret: Boolean(process.env.RING_SESSION_SECRET), appBaseUrl: Boolean(process.env.APP_BASE_URL), dynamoTable: process.env.DYNAMODB_TABLE_NAME ?? "MatanAI (default)" });
}

/** Warm every per-user cache from DynamoDB (each is a single Query/GetItem, once per process per user). */
export async function hydrateUserScope(user: ServerUser) {
  logRuntimeConfig();
  await Promise.all([hydrateConnected(user.sub), hydrateRingEvents(user.sub), hydrateIntelligence(user.sub), hydrateUserSettings(user.sub), hydrateMedia(user.sub), hydrateNotifications(user.sub), hydrateCare(user.sub)]);
}

/** Route wrapper for user-scoped API routes (Ring, Matan AI, settings). */
export function userRoute<C = unknown>(handler: Parameters<typeof authed<C>>[0]) {
  return authed<C>(handler, { hydrate: hydrateUserScope });
}

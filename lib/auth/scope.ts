import "server-only";
import { authed, type ServerUser } from "./server";
import { hydrateConnected } from "@/lib/ring/session";
import { hydrateRingEvents } from "@/lib/ring/overview";
import { hydrateIntelligence } from "@/lib/matan/store";
import { hydrateUserSettings } from "@/lib/matan/user-settings";
import { hydrateMedia } from "@/lib/matan/media-store";

/** Warm every per-user cache from DynamoDB (each is a single Query/GetItem, once per process per user). */
export async function hydrateUserScope(user: ServerUser) {
  await Promise.all([hydrateConnected(user.sub), hydrateRingEvents(user.sub), hydrateIntelligence(user.sub), hydrateUserSettings(user.sub), hydrateMedia(user.sub)]);
}

/** Route wrapper for user-scoped API routes (Ring, Matan AI, settings). */
export function userRoute<C = unknown>(handler: Parameters<typeof authed<C>>[0]) {
  return authed<C>(handler, { hydrate: hydrateUserScope });
}

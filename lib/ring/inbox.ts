import "server-only";
import type { Notification, RingEvent } from "@/lib/types";
import { currentUser } from "@/lib/auth/server";

/**
 * Real Mode notification inbox: derived from Matan's own decisions on real Ring events
 * (NOTIFY / ESCALATE, or an email that was actually sent). Read state is per user, in memory.
 */
declare global {
  // eslint-disable-next-line no-var
  var __matanInboxRead: Map<string, Set<string>> | undefined;
}
const readSet = (sub: string) => {
  const all = (globalThis.__matanInboxRead ??= new Map());
  let s = all.get(sub);
  if (!s) all.set(sub, (s = new Set()));
  return s;
};

export const inboxId = (eventId: string) => `ring-ntf-${eventId}`;

export function buildInbox(events: RingEvent[], limit = 12): { notifications: Notification[]; unread: number } {
  const u = currentUser();
  const read = u ? readSet(u.sub) : new Set<string>();
  const items: Notification[] = [];
  for (const e of events) {
    const cd = e.intelligence?.careDecision;
    const action = cd && !("failed" in cd) ? cd.action : undefined;
    const sent = e.notification?.status === "sent";
    if (!(action === "NOTIFY" || action === "ESCALATE" || sent)) continue;
    const escalate = action === "ESCALATE";
    items.push({
      id: inboxId(e.id),
      title: `${escalate ? "Escalation" : "Notification"}: ${e.title}`,
      body: (cd && !("failed" in cd) ? cd.reason : e.intelligence?.analysis.summary) ?? e.summary,
      timestamp: e.intelligence?.analyzedAt ?? e.timestamp,
      read: read.has(e.id),
      tone: escalate ? "danger" : sent ? "warning" : "primary",
      href: `/events/${e.id}`,
    });
    if (items.length >= limit) break;
  }
  return { notifications: items, unread: items.filter((n) => !n.read).length };
}

export function markInboxRead(ids: string[] | "all", all: RingEvent[]) {
  const u = currentUser();
  if (!u) return;
  const set = readSet(u.sub);
  if (ids === "all") for (const e of all) set.add(e.id);
  else for (const id of ids) set.add(id.replace(/^ring-ntf-/, ""));
}

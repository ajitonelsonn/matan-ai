import type { AssistantMessage, RingEvent } from "@/lib/types";
import { extractJson } from "./schema";

/**
 * Pure helpers for the Real Mode assistant: reduce the signed-in user's Ring data
 * (events with Matan analyses/decisions/notifications, devices, Care Context, rules,
 * session) to a compact grounding context, build the Nova prompt, and parse the reply.
 * No AWS or store access here so it is unit-testable.
 */

export interface AssistantDevice {
  name: string;
  model?: string;
  status: string;
  capabilities: string[];
}

export interface AssistantContextInput {
  now: string;
  timezone: string;
  devices: AssistantDevice[];
  events: RingEvent[];
  session: { status: string; expiresAt?: string } | null;
  care: {
    enabled: boolean;
    quietHours: { enabled: boolean; start: string; end: string };
    sensitivity: Record<string, string>;
  } | null;
  rules: { name: string; enabled: boolean; action: string }[];
  alerts: { emailConfigured: boolean; level: string };
}

export interface AssistantContext {
  now: string;
  timezone: string;
  devices: AssistantDevice[];
  session: { status: string; minutesLeft?: number } | null;
  totals: {
    today: {
      events: number;
      byType: Record<string, number>;
      byPriority: Record<string, number>;
      emailsSent: number;
      emailsSentByType: Record<string, number>;
    };
    last7d: {
      events: number;
      byType: Record<string, number>;
      byPriority: Record<string, number>;
      emailsSent: number;
      emailsSentByType: Record<string, number>;
    };
    onRecord: number;
    analyzed: number;
    awaitingAnalysis: number;
  };
  decisions7d: Record<string, number>;
  notifications7d: { sent: number; failed: number; notRequired: number };
  care: AssistantContextInput["care"];
  rules: AssistantContextInput["rules"];
  alerts: AssistantContextInput["alerts"];
  recentEvents: {
    id: string;
    when: string;
    device: string;
    title: string;
    type: string;
    priority: string;
    ai?: string;
    decision?: string;
    notified?: string;
  }[];
}

const MS_DAY = 86_400_000;

function tally(events: RingEvent[]) {
  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const emailsSentByType: Record<string, number> = {};
  let emailsSent = 0;
  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    byPriority[e.priority] = (byPriority[e.priority] ?? 0) + 1;
    if (e.notification?.status === "sent") {
      emailsSent += 1;
      emailsSentByType[e.type] = (emailsSentByType[e.type] ?? 0) + 1;
    }
  }
  return {
    events: events.length,
    byType,
    byPriority,
    emailsSent,
    emailsSentByType,
  };
}

const dayKey = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));

export function buildAssistantContext(
  input: AssistantContextInput,
  recentLimit = 30,
): AssistantContext {
  const nowMs = new Date(input.now).getTime();
  const tz = input.timezone;
  const sorted = [...input.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const todayKey = dayKey(input.now, tz);
  const today = sorted.filter((e) => dayKey(e.timestamp, tz) === todayKey);
  const last7 = sorted.filter(
    (e) => nowMs - new Date(e.timestamp).getTime() < 7 * MS_DAY,
  );
  const decisions7d: Record<string, number> = {};
  const notifications7d = { sent: 0, failed: 0, notRequired: 0 };
  for (const e of last7) {
    const d = e.intelligence?.careDecision;
    if (d && "action" in d)
      decisions7d[d.action] = (decisions7d[d.action] ?? 0) + 1;
    if (e.notification?.status === "sent") notifications7d.sent += 1;
    else if (e.notification?.status === "failed") notifications7d.failed += 1;
    else if (e.notification?.status === "skipped")
      notifications7d.notRequired += 1;
  }
  const whenFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
  const analyzed = sorted.filter((e) => e.analysis === "done").length;
  return {
    now: input.now,
    timezone: tz,
    devices: input.devices,
    session: input.session
      ? {
          status: input.session.status,
          minutesLeft: input.session.expiresAt
            ? Math.max(
                0,
                Math.round(
                  (new Date(input.session.expiresAt).getTime() - nowMs) /
                    60_000,
                ),
              )
            : undefined,
        }
      : null,
    totals: {
      today: tally(today),
      last7d: tally(last7),
      onRecord: sorted.length,
      analyzed,
      awaitingAnalysis: sorted.length - analyzed,
    },
    decisions7d,
    notifications7d,
    care: input.care,
    rules: input.rules,
    alerts: input.alerts,
    recentEvents: sorted.slice(0, recentLimit).map((e) => ({
      id: e.id,
      when: whenFmt.format(new Date(e.timestamp)),
      device: e.location,
      title: e.title,
      type: e.type,
      priority: e.priority,
      ai: e.intelligence?.analysis?.summary?.slice(0, 140),
      decision:
        e.intelligence?.careDecision && "action" in e.intelligence.careDecision
          ? e.intelligence.careDecision.action
          : e.analysis === "done"
            ? undefined
            : "awaiting analysis",
      notified:
        e.notification?.status === "sent"
          ? `sent via ${e.notification.provider ?? "email"}`
          : e.notification?.status === "failed"
            ? "failed"
            : e.notification?.status === "skipped"
              ? "not required"
              : undefined,
    })),
  };
}

export const ASSISTANT_SYSTEM_PROMPT =
  "You are Matan AI, the home-awareness assistant inside the MATAN AI dashboard. You answer questions about the user's own Ring devices and event history using ONLY the JSON context provided (devices, totals, decisions, notifications, Care Context, Smart Rules, recent events with Matan's analyses). " +
  "Be concise (2-5 sentences), warm and factual. Use the user's timezone for times. Never invent events, people, times or device features that are not in the context; if the context cannot answer, say what is missing (for example that events are still awaiting analysis or the Ring session expired). " +
  "You cannot control devices, change settings or send emails. Device controls (siren, lights, door lock, recording on demand) are not available through the Ring API and are a future integration in Matan - say so if asked. For alert emails point to Settings > Notifications, for Smart Rules and quiet hours to Settings > Care & Rules, for the camera stream and snapshots to Live View. " +
  "Counts in totals are exact - use them instead of adding up recentEvents yourself. " +
  'Reply with a single JSON object: {"answer": string, "relatedEventIds": string[] (ids from recentEvents that your answer is about, max 3), "highlights": string[] (0-3 short bullet facts)}.';

export function buildAssistantPrompt(
  ctx: AssistantContext,
  history: AssistantMessage[],
  question: string,
) {
  const past = history
    .slice(-6)
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "Matan"}: ${m.content.slice(0, 400)}`,
    )
    .join("\n");
  return `Context (JSON):\n${JSON.stringify(ctx)}\n\n${past ? `Conversation so far:\n${past}\n\n` : ""}User question: ${question.trim()}`;
}

export interface ParsedAssistantReply {
  answer: string;
  relatedEventIds: string[];
  highlights: string[];
}

/** Tolerant parse: the model should return JSON, but plain text is accepted as the answer. */
export function parseAssistantReply(
  text: string,
  knownIds: Set<string>,
): ParsedAssistantReply {
  let obj: Record<string, unknown> | null = null;
  try {
    const j = extractJson(text);
    if (j && typeof j === "object") obj = j as Record<string, unknown>;
  } catch {
    obj = null;
  }
  const answer =
    typeof obj?.answer === "string" && obj.answer.trim()
      ? obj.answer.trim()
      : text.replace(/```[\s\S]*?```/g, "").trim();
  const ids = Array.isArray(obj?.relatedEventIds)
    ? (obj!.relatedEventIds as unknown[])
        .filter((x): x is string => typeof x === "string" && knownIds.has(x))
        .slice(0, 3)
    : [];
  const highlights = Array.isArray(obj?.highlights)
    ? (obj!.highlights as unknown[])
        .filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
        .map((x) => x.trim().slice(0, 200))
        .slice(0, 3)
    : [];
  return { answer: answer.slice(0, 1500), relatedEventIds: ids, highlights };
}

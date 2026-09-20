import type { InsightRange, RingEvent } from "@/lib/types";

/**
 * Pure helpers for the AI Insights "Generate" summary: reduce a period of real Ring
 * events (with their Matan analyses) to a compact context Nova can write from.
 * No AWS here so it is unit-testable; the server module calls Nova with the result.
 */

export interface PeriodContext {
  rangeLabel: string;
  range: InsightRange;
  totals: { events: number; analyzed: number; byType: Record<string, number>; byPriority: Record<string, number> };
  decisions: Record<string, number>;
  notifications: { sent: number; failed: number; skipped: number };
  devices: string[];
  busiestHours: { hour: string; count: number }[];
  highlights: { time: string; device: string; title: string; summary?: string; decision?: string; priority?: string }[];
}

export function buildPeriodContext(events: RingEvent[], range: InsightRange, rangeLabel: string, timezone: string): PeriodContext {
  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const decisions: Record<string, number> = {};
  const notifications = { sent: 0, failed: 0, skipped: 0 };
  const hours = new Map<string, number>();
  const hourFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true, timeZone: timezone });
  const timeFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const devices = new Set<string>();
  let analyzed = 0;
  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    byPriority[e.priority] = (byPriority[e.priority] ?? 0) + 1;
    devices.add(e.location);
    const h = hourFmt.format(new Date(e.timestamp));
    hours.set(h, (hours.get(h) ?? 0) + 1);
    if (e.analysis === "done") analyzed += 1;
    const d = e.intelligence?.careDecision;
    if (d && "action" in d) decisions[d.action] = (decisions[d.action] ?? 0) + 1;
    if (e.notification?.status === "sent") notifications.sent += 1;
    else if (e.notification?.status === "failed") notifications.failed += 1;
    else if (e.notification?.status === "skipped") notifications.skipped += 1;
  }
  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const rank = (e: RingEvent) => (e.priority === "important" ? 2 : e.priority === "attention" ? 1 : 0);
  const highlights = sorted
    .filter((e) => e.analysis === "done")
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 8)
    .map((e) => ({
      time: timeFmt.format(new Date(e.timestamp)),
      device: e.location,
      title: e.title,
      summary: e.intelligence?.analysis?.summary?.slice(0, 160),
      decision: e.intelligence?.careDecision && "action" in e.intelligence.careDecision ? e.intelligence.careDecision.action : undefined,
      priority: e.priority,
    }));
  return {
    rangeLabel,
    range,
    totals: { events: events.length, analyzed, byType, byPriority },
    decisions,
    notifications,
    devices: [...devices],
    busiestHours: [...hours.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 3),
    highlights,
  };
}

export const SUMMARY_SYSTEM_PROMPT =
  "You are Matan AI, a calm home-awareness assistant. Write a short summary (3-5 sentences, plain text, no headings or bullet points, no markdown) of a period of Ring camera activity for the homeowner. " +
  "Use only the facts in the JSON you are given: counts, decisions, notifications, busiest hours and highlights. Mention how many events were analyzed, what kinds dominated, anything escalated or notified, and end with one practical observation. " +
  "Never invent events, people or times that are not in the data. If nothing needed attention, say so plainly.";

export function buildSummaryPrompt(ctx: PeriodContext) {
  return `Period: ${ctx.rangeLabel}\nData (JSON):\n${JSON.stringify(ctx)}`;
}

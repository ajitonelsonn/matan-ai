import type {
  ActivityRow,
  CameraActivity,
  DailyTrendPoint,
  EventCounts,
  EventType,
  HeatCell,
  InsightRange,
  InsightsData,
  RingEvent,
} from "@/lib/types";
import { MOCK_NOW, TIME_ZONE, isoDate, lastDaysLabel } from "./clock";

const emptyByType = (): Record<EventType, number> => ({
  person: 0,
  package: 0,
  vehicle: 0,
  animal: 0,
  doorbell: 0,
  unusual: 0,
  other: 0,
});

export function countEvents(events: RingEvent[]): EventCounts {
  const c: EventCounts = { total: events.length, normal: 0, attention: 0, important: 0, byType: emptyByType() };
  for (const e of events) {
    c[e.priority] += 1;
    c.byType[e.type] += 1;
  }
  return c;
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE });
const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
const hourFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TIME_ZONE });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE });
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TIME_ZONE });

/** Explicit day window ("YYYY-MM-DD" inclusive) for `range === "custom"`. */
export interface InsightWindow {
  from: string;
  to: string;
}

const MS_DAY = 86_400_000;
const utcDay = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));

/**
 * Resolve a range to `{ days, endOffset }`: the window covers `days` days ending on
 * `isoDate(endOffset)` (0 = today). A custom window is clamped to today and 1..90 days.
 */
export function resolveWindow(range: InsightRange, window?: InsightWindow | null): { days: number; endOffset: number } {
  if (range === "custom" && window && /^\d{4}-\d{2}-\d{2}$/.test(window.from) && /^\d{4}-\d{2}-\d{2}$/.test(window.to)) {
    const today = utcDay(isoDate(0));
    const to = Math.min(utcDay(window.to), today);
    const from = Math.min(utcDay(window.from), to);
    const days = Math.min(90, Math.max(1, Math.round((to - from) / MS_DAY) + 1));
    return { days, endOffset: Math.round((to - today) / MS_DAY) };
  }
  return { days: rangeDays(range), endOffset: 0 };
}

function rangeDays(range: InsightRange) {
  return range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 14;
}

export function eventsInRange(events: RingEvent[], range: InsightRange, offsetDays = 0, window?: InsightWindow | null) {
  const { days, endOffset } = resolveWindow(range, window);
  const keys = new Set<string>();
  for (let i = 0; i < days; i++) keys.add(isoDate(endOffset - i - offsetDays));
  return events.filter((e) => keys.has(dayKey(e.timestamp)));
}

export function rangeLabel(range: InsightRange, window?: InsightWindow | null) {
  const { days, endOffset } = resolveWindow(range, window);
  if (endOffset !== 0) {
    const from = shortFmt.format(new Date(isoDate(endOffset - days + 1) + "T12:00:00+09:00"));
    const to = shortFmt.format(new Date(isoDate(endOffset) + "T12:00:00+09:00"));
    return days === 1 ? `${to}, ${isoDate(endOffset).slice(0, 4)}` : `${from} – ${to}, ${isoDate(endOffset).slice(0, 4)}`;
  }
  if (days === 1) return shortFmt.format(new Date(MOCK_NOW));
  return lastDaysLabel(days);
}

const cameraNames: Record<string, string> = {
  "cam-front": "Front Door",
  "cam-back": "Backyard",
  "cam-driveway": "Driveway",
  "cam-side": "Side Door",
  "cam-indoor": "Living Room",
};

export function buildInsights(allEvents: RingEvent[], range: InsightRange, cameraNameOverride?: Record<string, string>, window?: InsightWindow | null): InsightsData {
  const { days, endOffset } = resolveWindow(range, window);
  const current = eventsInRange(allEvents, range, 0, window);
  const previous = eventsInRange(allEvents, range, days, window);
  const counts = countEvents(current);
  const prev = countEvents(previous);

  const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / b) * 100));
  const deltas: Record<string, number> = {
    total: pct(counts.total, prev.total),
    person: pct(counts.byType.person, prev.byType.person),
    package: pct(counts.byType.package, prev.byType.package),
    vehicle: pct(counts.byType.vehicle, prev.byType.vehicle),
    animal: pct(counts.byType.animal, prev.byType.animal),
    attention: pct(counts.attention, prev.attention),
    important: pct(counts.important, prev.important),
  };

  // Trends per day (oldest first)
  const trendDays = Math.min(days, 30);
  const trends: DailyTrendPoint[] = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const key = isoDate(endOffset - i);
    const dayEvents = current.filter((e) => dayKey(e.timestamp) === key);
    const c = countEvents(dayEvents);
    trends.push({
      day: shortFmt.format(new Date(key + "T12:00:00+09:00")),
      date: key,
      people: c.byType.person,
      packages: c.byType.package,
      vehicles: c.byType.vehicle,
      animals: c.byType.animal,
      others: c.byType.other + c.byType.doorbell + c.byType.unusual,
      total: c.total,
    });
  }

  // Per camera
  const camCounts = new Map<string, number>();
  for (const e of current) {
    const id = e.cameraId ?? "other";
    camCounts.set(id, (camCounts.get(id) ?? 0) + 1);
  }
  const byCamera: CameraActivity[] = [...camCounts.entries()]
    .map(([cameraId, count]) => ({
      cameraId,
      name: cameraNameOverride?.[cameraId] ?? cameraNames[cameraId] ?? "Others",
      count,
      pct: counts.total ? Math.round((count / counts.total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const activities: ActivityRow[] = [
    { key: "person", label: "People", count: counts.byType.person, icon: "User", tone: "primary" },
    { key: "package", label: "Packages", count: counts.byType.package, icon: "Package", tone: "success" },
    { key: "vehicle", label: "Vehicles", count: counts.byType.vehicle, icon: "Car", tone: "purple" },
    { key: "other", label: "Motion", count: counts.byType.other, icon: "Activity", tone: "warning" },
    { key: "animal", label: "Animals", count: counts.byType.animal, icon: "PawPrint", tone: "warning" },
    { key: "doorbell", label: "Doorbell Press", count: counts.byType.doorbell, icon: "Bell", tone: "neutral" },
    { key: "unusual", label: "Unusual", count: counts.byType.unusual, icon: "TriangleAlert", tone: "danger" },
  ].sort((a, b) => b.count - a.count);

  // Heatmap: weekday x 4h bucket
  const grid = new Map<string, number>();
  let max = 1;
  const weekdayIndex: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  for (const e of current) {
    const d = new Date(e.timestamp);
    const wd = weekdayIndex[weekdayFmt.format(d)] ?? 0;
    const hour = Number(hourFmt.format(d)) % 24;
    const bucket = Math.floor(hour / 4);
    const k = `${wd}-${bucket}`;
    const v = (grid.get(k) ?? 0) + 1;
    grid.set(k, v);
    if (v > max) max = v;
  }
  const heatmap: HeatCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let bucket = 0; bucket < 6; bucket++) {
      heatmap.push({ day, hourBucket: bucket, value: (grid.get(`${day}-${bucket}`) ?? 0) / max });
    }
  }

  const normalPct = counts.total ? Math.round((counts.normal / counts.total) * 100) : 100;
  const importantPct = counts.total ? Math.round((counts.important / counts.total) * 100) : 0;
  const attentionPct = Math.max(0, 100 - normalPct - importantPct);

  const deliveries = counts.byType.package;
  const unattended = current.filter((e) => e.type === "package" && e.priority === "attention").length;
  const unusual = counts.byType.unusual;
  const dir = deltas.total < 0 ? "decreased" : "increased";

  const summary =
    `Your home had mostly normal activity ${range === "today" ? "today" : "this period"}. ` +
    `We detected ${deliveries} ${deliveries === 1 ? "delivery" : "deliveries"}` +
    (unattended ? `, with ${unattended} ${unattended === 1 ? "package" : "packages"} left for more than 2 hours` : "") +
    `. ` +
    (unusual
      ? `There ${unusual === 1 ? "was" : "were"} ${unusual} unusual access ${unusual === 1 ? "event" : "events"} during quiet hours at the back entrance. `
      : "No unusual access events were detected. ") +
    (previous.length ? `Overall activity ${dir} by ${Math.abs(deltas.total)}% compared to the previous period.` : "");

  const recommendations: InsightsData["recommendations"] = [
    {
      id: "rec-1",
      title: "No immediate action required",
      description: "Everything looks good.",
      tone: "success",
      icon: "CircleCheck",
    },
    {
      id: "rec-2",
      title: "Consider enabling package alerts",
      description: unattended ? `${unattended} ${unattended === 1 ? "package" : "packages"} stayed for more than 2 hours.` : "Get reminded when a package is left behind.",
      tone: "warning",
      icon: "Package",
    },
    {
      id: "rec-3",
      title: "Review quiet hours settings",
      description: unusual ? "Unusual activity detected at 2:17 AM." : "Your quiet hours are 10 PM - 6 AM.",
      tone: "primary",
      icon: "Moon",
    },
  ];

  return {
    range,
    rangeLabel: rangeLabel(range, window),
    counts,
    deltas,
    trends,
    byCamera,
    activities,
    heatmap,
    findings: { normalPct, attentionPct, importantPct },
    findingNote:
      deltas.total < 0
        ? `Activity decreased by ${Math.abs(deltas.total)}% this period. Your home is quieter than before.`
        : `Activity increased by ${Math.abs(deltas.total)}% this period. Mostly routine family movement.`,
    summary,
    recommendations,
  };
}

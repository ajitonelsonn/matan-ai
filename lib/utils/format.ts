import { MOCK_NOW, TIME_ZONE } from "@/lib/mock/clock";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});
const timeSecFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});
const dateParts = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dateShortFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});
const weekdayParts = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const parts = (f: Intl.DateTimeFormat, d: Date) => Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));

export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso));
}
export function formatTimeWithSeconds(iso: string) {
  return timeSecFmt.format(new Date(iso));
}
/** "11 Sep 2026" */
export function formatDate(iso: string) {
  const p = parts(dateParts, new Date(iso));
  return `${p.day} ${p.month} ${p.year}`;
}
export function formatDateShort(iso: string) {
  return dateShortFmt.format(new Date(iso));
}
/** "Fri, 11 Sep 2026" */
export function formatWeekdayDate(iso: string) {
  const p = parts(weekdayParts, new Date(iso));
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).format(d);
}

/** "Today", "Yesterday", or a short date - relative to the demo clock. */
export function relativeDay(iso: string, now: string = MOCK_NOW) {
  const d = new Date(iso);
  const n = new Date(now);
  const key = dayKey(d);
  if (key === dayKey(n)) return "Today";
  const y = new Date(n.getTime() - 86400000);
  if (key === dayKey(y)) return "Yesterday";
  return formatDateShort(iso);
}

export function relativeDayTime(iso: string, now: string = MOCK_NOW) {
  return `${relativeDay(iso, now)}, ${formatTime(iso)}`;
}

/** "2 min ago", "1 hour ago", "2 days ago" - relative to the demo clock. */
export function timeAgo(iso: string, now: string = MOCK_NOW) {
  const diff = Math.max(0, new Date(now).getTime() - new Date(iso).getTime());
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatPct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

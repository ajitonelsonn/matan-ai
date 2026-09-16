/**
 * The demo dataset is anchored to "today at 09:24:18 (Asia/Dili)" so every page
 * tells the same story ("Today", "Yesterday", "2 min ago") on any day it is
 * opened, and the topbar's real clock agrees with the data's date.
 */
export const TIME_ZONE = "Asia/Dili";

const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const [Y, M, D] = todayKey.split("-").map(Number);

export const MOCK_NOW = `${todayKey}T09:24:18+09:00`;

const base = new Date(MOCK_NOW).getTime();

/** ISO timestamp offset from the demo "now" by whole minutes (negative = past). */
export function minutesAgo(min: number) {
  return new Date(base - min * 60000).toISOString();
}

/** ISO timestamp at a specific local (Asia/Dili) time on a day offset from today. */
export function at(dayOffset: number, hh: number, mm: number, ss = 0) {
  return new Date(Date.UTC(Y, M - 1, D + dayOffset, hh - 9, mm, ss)).toISOString();
}

/** "YYYY-MM-DD" for a day offset from today (Asia/Dili). */
export function isoDate(dayOffset: number) {
  return new Date(Date.UTC(Y, M - 1, D + dayOffset, 3, 0, 0)).toISOString().slice(0, 10);
}

const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TIME_ZONE });
/** "Sep 10 - Sep 16, 2026" style label for the last N days ending today. */
export function lastDaysLabel(days: number) {
  const from = shortFmt.format(new Date(isoDate(-(days - 1)) + "T12:00:00+09:00"));
  const to = shortFmt.format(new Date(MOCK_NOW));
  return `${from} – ${to}, ${Y}`;
}

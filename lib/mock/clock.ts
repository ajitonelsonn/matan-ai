/**
 * The demo dataset is anchored to a fixed moment so every page tells the same
 * story ("Today", "Yesterday", "2 min ago") regardless of when it is opened.
 * The topbar clock still shows real local time.
 */
export const TIME_ZONE = "Asia/Dili";
export const MOCK_NOW = "2026-09-11T09:24:18+09:00";

const base = new Date(MOCK_NOW).getTime();

/** ISO timestamp offset from the demo "now" by whole minutes (negative = past). */
export function minutesAgo(min: number) {
  return new Date(base - min * 60000).toISOString();
}

/** ISO timestamp at a specific local (Asia/Dili) time on a day offset from today. */
export function at(dayOffset: number, hh: number, mm: number, ss = 0) {
  // 2026-09-11 in Asia/Dili (+09:00)
  const y = 2026;
  const m = 9;
  const d = 11 + dayOffset;
  const date = new Date(Date.UTC(y, m - 1, d, hh - 9, mm, ss));
  return date.toISOString();
}

export function isoDate(dayOffset: number) {
  const date = new Date(Date.UTC(2026, 8, 11 + dayOffset, 3, 0, 0));
  return date.toISOString().slice(0, 10);
}

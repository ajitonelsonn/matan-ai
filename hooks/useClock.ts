"use client";

import { useEffect, useState } from "react";
import { TIME_ZONE } from "@/lib/mock/clock";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: TIME_ZONE });
const dateParts = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
/** "Fri 11 Sep 2026" */
function formatDay(d: Date) {
  const p = Object.fromEntries(dateParts.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** Live local clock for the topbar (Asia/Dili). Returns null until mounted to avoid hydration mismatch. */
export function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return { time: "", date: "", hour: 9 };
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(now)) % 24;
  return { time: timeFmt.format(now), date: formatDay(now), hour };
}

export function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

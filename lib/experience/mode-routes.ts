/**
 * Which experience a URL belongs to.
 *
 * Real Mode owns Ring-backed ids (`ring-…` events and devices, `rule-…` Smart Rules);
 * Demo Mode owns everything from the sample dataset (`EVT-…`, `cam-…`, `aut-…`, …).
 * Opening the other mode's detail URL - by switching mode, following an old link or a
 * bookmark - must never show a half-empty page: it is replaced with the relevant list
 * page for the current mode. Pure, so it is unit-tested without a browser.
 */
export type ExperienceMode = "demo" | "ring";

const isRingId = (id: string) => id.startsWith("ring-");
const isRuleId = (id: string) => id.startsWith("rule-");

/** Sections with per-item URLs, and who owns an id in each. */
const SECTIONS: { list: string; owns: (id: string, mode: ExperienceMode) => boolean }[] = [
  { list: "/events", owns: (id, mode) => (mode === "ring" ? isRingId(id) : !isRingId(id)) },
  { list: "/devices", owns: (id, mode) => (mode === "ring" ? isRingId(id) : !isRingId(id)) },
  // Real Mode automations are Smart Rules; Demo Mode has its own sample automations.
  { list: "/automations", owns: (id, mode) => (mode === "ring" ? isRuleId(id) : !isRuleId(id)) },
];

/** The list/overview page a path belongs to ("/" when it has none) - used for 404s too. */
export function sectionOf(pathname: string): string {
  const match = SECTIONS.find((s) => pathname === s.list || pathname.startsWith(`${s.list}/`));
  if (match) return match.list;
  const first = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  const known = ["/live", "/insights", "/assistant", "/security-modes", "/care", "/business", "/settings"];
  return known.includes(first) ? first : "/";
}

/**
 * The URL to show instead of `pathname + search` in `mode`, or null when it is already fine.
 * `search` is the query string (with or without the leading "?").
 */
export function routeForMode(pathname: string, search: string, mode: ExperienceMode): string | null {
  for (const s of SECTIONS) {
    if (!pathname.startsWith(`${s.list}/`)) continue;
    const id = decodeURIComponent(pathname.slice(s.list.length + 1).split("/")[0] ?? "");
    if (!id) return s.list;
    return s.owns(id, mode) ? null : s.list;
  }
  // Live View keeps the selected camera in the query string: `ring:<id>` in Real Mode,
  // a demo camera id otherwise.
  if (pathname === "/live") {
    const camera = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("camera");
    if (!camera) return null;
    const ringCam = camera.startsWith("ring:");
    return (mode === "ring") === ringCam ? null : "/live";
  }
  return null;
}

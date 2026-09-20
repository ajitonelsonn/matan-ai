import type { ConnectedRingDevice, RingDiscoveredDevice } from "./types";

/**
 * Pure helpers that turn Ring's read-only capability/configuration facts into UI rows,
 * and classify features Matan cannot (yet) offer. Nothing here infers a capability:
 * `yes` only when Ring reported it, `no` when Ring reported null/false, `unknown` when
 * the resource wasn't returned at all.
 */
export type CapState = "yes" | "no" | "unknown";

export interface CapabilityRow {
  key: string;
  label: string;
  state: CapState;
  /** Extra facts from Ring, e.g. "1080p · AVC · 16:9". */
  detail?: string;
}

const st = (v: boolean | null | undefined): CapState => (v === undefined ? "unknown" : v ? "yes" : "no");

export function capabilityRows(c: RingDiscoveredDevice["capabilities"] | undefined): CapabilityRow[] {
  if (!c) return [];
  const videoDetail = [c.maxResolution ? `${c.maxResolution}p` : null, c.codecs?.length ? c.codecs.join(", ") : null, c.ratio ?? null].filter(Boolean).join(" · ") || undefined;
  return [
    { key: "video", label: "Video", state: st(c.video), detail: videoDetail },
    { key: "motion", label: "Motion detection", state: st(c.motionDetection), detail: c.configurable?.motion?.length ? `configurable: ${c.configurable.motion.join(", ")}` : undefined },
    { key: "snapshot", label: "Snapshot", state: st(c.snapshot) },
    { key: "nightVision", label: "Color night vision", state: st(c.nightVision) },
    { key: "privacyZones", label: "Privacy zones", state: st(c.privacyZones) },
    { key: "audio", label: "Chime audio", state: st(c.audio), detail: c.audioActions?.length ? c.audioActions.join(", ") : undefined },
    { key: "battery", label: "Battery", state: st(c.battery) },
    { key: "co", label: "CO detection", state: st(c.sensors?.co) },
    { key: "smoke", label: "Smoke detection", state: st(c.sensors?.smoke) },
    { key: "glassBreak", label: "Glass break", state: st(c.sensors?.glassBreak) },
    { key: "tamper", label: "Tamper detection", state: st(c.sensors?.tamper) },
    { key: "flood", label: "Flood detection", state: st(c.sensors?.flood) },
    { key: "freeze", label: "Freeze detection", state: st(c.sensors?.freeze) },
    { key: "contact", label: "Contact sensor", state: st(c.sensors?.contact) },
  ];
}

export interface ConfigRow {
  key: string;
  label: string;
  value: string;
}

const onOff = (v: string | boolean | undefined) => (v === undefined ? undefined : v === true || v === "on" ? "On" : v === false || v === "off" ? "Off" : String(v));

/** Read-only configuration summary from GET /configurations; only fields Ring returned. */
export function configurationRows(conf: RingDiscoveredDevice["configuration"] | undefined): ConfigRow[] {
  if (!conf) return [];
  const rows: ConfigRow[] = [];
  if (conf.motionEnabled !== undefined) rows.push({ key: "motion", label: "Motion detection", value: onOff(conf.motionEnabled)! });
  if (conf.motionZonesCount !== undefined) rows.push({ key: "motionZones", label: "Motion zones", value: String(conf.motionZonesCount) });
  if (conf.privacyZonesCount !== undefined) rows.push({ key: "privacyZones", label: "Privacy zones", value: String(conf.privacyZonesCount) });
  for (const [k, v] of Object.entries(conf.imageEnhancements ?? {})) rows.push({ key: `enh:${k}`, label: k.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase()), value: onOff(v) ?? v });
  if (conf.audioVolume !== undefined) rows.push({ key: "volume", label: "Audio volume", value: String(conf.audioVolume) });
  return rows;
}

/** Coarse Ring region ("US / CA"); never an address. */
export function regionLabel(loc: RingDiscoveredDevice["location"] | undefined): string | undefined {
  const parts = [loc?.country, loc?.state].filter(Boolean);
  return parts.length ? parts.join(" / ") : undefined;
}

/* ---- Features Matan must not fake ------------------------------------------ */

export type FeatureClassification = "Not documented by Ring" | "Documented by Ring but not exposed by Playground" | "Documented and exposed but not yet implemented" | "Not tested";

export interface FutureFeature {
  key: "deviceControls" | "chimeControls" | "family" | "lifecycle" | "subscriptions";
  title: string;
  headline: string;
  message: string;
  classification: FeatureClassification;
}

/**
 * Classification follows the spec's four exact categories, based on the docs
 * (api-documentation, developer-faq) and the live Playground inspection.
 * Chime controls depend on whether any connected device actually exposes chime audio.
 */
export function futureFeatures(devices: Pick<ConnectedRingDevice, "details">[]): FutureFeature[] {
  const chimeExposed = devices.some((d) => (d.details.audioActions?.length ?? 0) > 0 || (d.details.audioSlots ?? 0) > 0);
  return [
    {
      key: "deviceControls",
      title: "Device controls",
      headline: "🔒 Future Ring capability",
      message: "Device control (siren, lights, lock, recording, PTZ) is not currently available in the Ring Developer Playground. Ring's capability values are read-only and do not indicate control functionality.",
      classification: "Not documented by Ring",
    },
    {
      key: "chimeControls",
      title: "Chime controls",
      headline: chimeExposed ? "Documented · not yet implemented" : "Future feature",
      message: chimeExposed ? "This Ring account exposes chime audio; playback (POST …/media/audio/playback) is documented but not implemented in Matan AI yet." : "The Ring API supports chime audio playback, but the current Playground device reports no chime audio capability, so there is no testable control.",
      classification: chimeExposed ? "Documented and exposed but not yet implemented" : "Documented by Ring but not exposed by Playground",
    },
    {
      key: "family",
      title: "Family / Household",
      headline: "Coming in a future integration",
      message: "The current Ring API/Playground does not provide household-member mapping. People Matan shows here are your own configuration, never Ring family members.",
      classification: "Not documented by Ring",
    },
    {
      key: "lifecycle",
      title: "Device lifecycle events",
      headline: "Future / unavailable in Playground",
      message: "Ring delivers device added/removed and online/offline as webhook events; the Playground offers no way to simulate them. Matan polls device status instead.",
      classification: "Documented by Ring but not exposed by Playground",
    },
    {
      key: "subscriptions",
      title: "Ring subscription status",
      headline: "Future / unavailable in Playground",
      message: "GET /v1/accounts/me/subscriptions is documented, but the Playground account answers 422 (“Unable to process subscription request for this user”).",
      classification: "Documented by Ring but not exposed by Playground",
    },
  ];
}

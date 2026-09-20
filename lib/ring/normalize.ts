import type {
  JsonApiDocument,
  JsonApiResource,
  RingDeviceAttributes,
  RingAccount,
  RingDeviceKind,
  RingDiscoveredDevice,
  RingHistoryEvent,
} from "./types";

type Attrs = Record<string, unknown>;
const obj = (v: unknown): Attrs | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Attrs) : undefined);
const arr = (v: unknown): unknown[] | undefined => (Array.isArray(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** Index `included` resources by type:id, accepting both documented and observed type names. */
function indexIncluded(included: JsonApiResource[] = []) {
  const map = new Map<string, JsonApiResource>();
  for (const r of included) map.set(`${r.type}:${r.id}`, r);
  return (rel: { type: string; id: string } | undefined) => (rel ? map.get(`${rel.type}:${rel.id}`) : undefined);
}

function relId(res: JsonApiResource<unknown>, key: string) {
  const d = res.relationships?.[key]?.data;
  if (!d || Array.isArray(d)) return undefined;
  return d;
}

/**
 * Product hint from Ring's own product image path, e.g.
 * ".../square_device_images/DoorbellPro/rvdp_3x.png" -> "Doorbell Pro".
 * Not a Ring API field; surfaced as a hint only and never invented.
 */
export function productHintFromImage(imageUrl?: string): string | undefined {
  if (!imageUrl) return undefined;
  const m = imageUrl.match(/square_device_images\/([^/]+)\//i) ?? imageUrl.match(/devices\/([^/]+)\/[^/]+\.(png|jpg|webp)$/i);
  const raw = m?.[1];
  if (!raw) return undefined;
  const spaced = raw.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])(\d)/g, "$1 $2").trim();
  return spaced.length > 1 && spaced.length < 40 ? spaced : undefined;
}

function deriveKind(attrs: RingDeviceAttributes, caps: Attrs | undefined, hint?: string): RingDeviceKind {
  const kind = (attrs.device_kind ?? "").toLowerCase();
  const text = `${attrs.name ?? ""} ${hint ?? ""} ${kind}`.toLowerCase();
  const audioActions = arr(obj(caps?.audio)?.supported_actions) as string[] | undefined;
  if (kind.includes("doorbell") || /doorbell/.test(text)) return "doorbell";
  if (kind.includes("chime") || audioActions?.some((a) => /chime/i.test(a)) || /chime/.test(text)) return "chime";
  const video = obj(caps?.video);
  if (video && (arr(video.codecs)?.length || num(video.max_resolution))) return "camera";
  if (kind.includes("cam")) return "camera";
  return "device";
}

export function normalizeDevice(res: JsonApiResource<RingDeviceAttributes>, lookup: ReturnType<typeof indexIncluded>): RingDiscoveredDevice {
  const attrs = res.attributes ?? {};
  const status = lookup(relId(res, "status"))?.attributes as Attrs | undefined;
  const caps = lookup(relId(res, "capabilities"))?.attributes as Attrs | undefined;
  const loc = lookup(relId(res, "location"))?.attributes as Attrs | undefined;
  const conf = lookup(relId(res, "configurations"))?.attributes as Attrs | undefined;

  const imageUrl = str(attrs.image_url);
  const model = productHintFromImage(imageUrl);
  const online = bool(status?.online);

  const video = obj(caps?.video);
  const motion = obj(caps?.motion_detection);
  const enhancements = arr(obj(caps?.image_enhancements)?.configurations) as string[] | undefined;
  const audio = obj(caps?.audio);
  const battery = obj(status?.battery_status) ?? obj(caps?.battery_status);
  const batteryPct = num(battery?.percentage);
  const signal = num(obj(status?.signal_strength)?.value);

  const confMotion = obj(conf?.motion_detection);
  const confEnh = obj(conf?.image_enhancements);
  const confAudio = obj(conf?.audio);
  const motionConfigurable = arr(motion?.configurations) as string[] | undefined;
  const videoConfigurable = arr(video?.configurations) as string[] | undefined;
  const sensor = (k: string): boolean | undefined => (caps ? caps[k] !== null && caps[k] !== undefined : undefined);
  const snooze = obj(obj(status?.audio)?.snooze);
  const enhValues = confEnh ? Object.fromEntries(Object.entries(confEnh).filter(([, v]) => typeof v === "string") as [string, string][]) : undefined;

  return {
    id: res.id,
    name: str(attrs.name) ?? "Ring device",
    type: deriveKind(attrs, caps, model),
    manufacturer: "Ring",
    model,
    imageUrl,
    status: {
      online,
      label: online === null ? "Unknown" : online ? "Online" : "Offline",
      reportedAt: str(status?.reported_at),
      batteryPercentage: batteryPct !== undefined && batteryPct >= 0 && batteryPct <= 100 ? batteryPct : undefined,
      signalStrength: signal,
      snoozeActive: snooze ? bool(snooze.active) : undefined,
      state: status ? (str(status.state) ?? null) : undefined,
    },
    location: loc ? { country: str(loc.country), state: str(loc.state) } : undefined,
    capabilities: {
      video: video ? Boolean(arr(video.codecs)?.length || num(video.max_resolution)) : undefined,
      motionDetection: caps ? Boolean(motion) : undefined,
      snapshot: enhancements ? enhancements.includes("snapshot") : undefined,
      privacyZones: enhancements ? enhancements.includes("privacy_zones") : undefined,
      nightVision: enhancements ? enhancements.some((c) => /night_vision/.test(c)) : undefined,
      audio: audio ? Boolean(arr(audio.supported_actions)?.length || num(audio.customizable_slots)) : undefined,
      battery: caps ? Boolean(caps.battery_status) : undefined,
      maxResolution: num(video?.max_resolution),
      codecs: arr(video?.codecs) as string[] | undefined,
      ratio: str(video?.ratio),
      supportedResolutions: (arr(video?.supported_resolutions) as number[] | undefined)?.filter((n) => typeof n === "number"),
      configurable: caps ? { video: videoConfigurable, motion: motionConfigurable, imageEnhancements: enhancements } : undefined,
      sensors: caps ? { co: sensor("co_detection_listener"), smoke: sensor("smoke_detection"), glassBreak: sensor("glass_break_detection"), tamper: sensor("tamper_detection"), flood: sensor("flood_detection"), freeze: sensor("freeze_detection"), contact: sensor("contact_detection") } : undefined,
      audioSlots: audio ? (num(audio.customizable_slots) ?? null) : undefined,
      audioActions: audio ? ((arr(audio.supported_actions) as string[] | undefined) ?? null) : undefined,
    },
    configuration: conf
      ? {
          motionEnabled: confMotion ? confMotion.enabled === "on" || confMotion.enabled === true : undefined,
          hasMotionZones: confMotion ? (arr(confMotion.motion_zones)?.length ?? 0) > 0 : undefined,
          hasPrivacyZones: confEnh ? (arr(confEnh.privacy_zones)?.length ?? 0) > 0 : undefined,
          motionZonesCount: confMotion ? (arr(confMotion.motion_zones)?.length ?? 0) : undefined,
          privacyZonesCount: confEnh ? (arr(confEnh.privacy_zones)?.length ?? 0) : undefined,
          imageEnhancements: enhValues,
          audioVolume: num(confAudio?.volume),
        }
      : undefined,
    source: "ring-playground",
  };
}

export function normalizeDevices(doc: JsonApiDocument<RingDeviceAttributes>): RingDiscoveredDevice[] {
  const lookup = indexIncluded(doc.included);
  const list = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : [];
  return list.filter((r) => r && r.type === "devices" && r.id).map((r) => normalizeDevice(r, lookup));
}

/** Human labels for capability chips - only shown when known from the API. */
export function capabilityLabels(c: RingDiscoveredDevice["capabilities"]): string[] {
  const out: string[] = [];
  if (c.video) out.push(c.maxResolution ? `Video ${c.maxResolution}p` : "Video");
  if (c.motionDetection) out.push("Motion");
  if (c.snapshot) out.push("Snapshot");
  if (c.audio) out.push("Audio");
  if (c.nightVision) out.push("Night vision");
  if (c.privacyZones) out.push("Privacy zones");
  if (c.battery) out.push("Battery");
  return out;
}

/** Mask an email for display: keep the first character and the domain. Raw addresses are never stored. */
export function maskEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const m = email.match(/^(.)(.*)(@.+)$/);
  return m ? `${m[1]}${"*".repeat(Math.min(6, Math.max(2, m[2].length)))}${m[3]}` : undefined;
}

/** GET /v1/users/me → RingAccount. Returns null when the document carries no users resource. */
export function normalizeAccount(doc: JsonApiDocument): RingAccount | null {
  const res = Array.isArray(doc.data) ? doc.data[0] : doc.data;
  if (!res || res.type !== "users" || !res.id) return null;
  const a = (res.attributes ?? {}) as Attrs;
  return { accountId: res.id, firstName: str(a.first_name), lastName: str(a.last_name), emailMasked: maskEmail(str(a.email)), fetchedAt: new Date().toISOString() };
}

export function normalizeHistory(doc: JsonApiDocument): RingHistoryEvent[] {
  const list = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : [];
  const lookup = indexIncluded(doc.included);
  return list.map((r) => {
    const a = (r.attributes ?? {}) as Attrs;
    const start = num(a.start);
    const end = num(a.end);
    const src = r.relationships?.source?.data;
    const cv = r.relationships?.cv_detections?.data;
    const cvList = Array.isArray(cv) ? cv : cv ? [cv] : [];
    const detections = cvList
      .map((d) => {
        const inc = lookup(d);
        const t = inc?.attributes as Attrs | undefined;
        return str(t?.detection_type) ?? str(t?.type) ?? str(t?.label) ?? str(t?.sub_type) ?? d.type;
      })
      .filter((x): x is string => Boolean(x));
    return {
      id: r.id,
      kind: str(a.event_type) ?? str(a.kind) ?? str(a.type) ?? r.type,
      createdAt: start !== undefined ? new Date(start).toISOString() : str(a.created_at) ?? str(a.timestamp) ?? str(a.occurred_at),
      endedAt: end !== undefined ? new Date(end).toISOString() : undefined,
      deviceId: src && !Array.isArray(src) ? src.id : undefined,
      detections,
      attributes: a,
    };
  });
}

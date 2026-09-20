/* ---------------------------------------------------------------------------
   Ring Partner API (JSON:API) raw shapes + MATAN AI normalized types.
   Raw shapes are only used inside lib/ring; the UI consumes normalized types.
--------------------------------------------------------------------------- */

export interface JsonApiResourceIdentifier {
  type: string;
  id: string;
}

export interface JsonApiRelationship {
  data?: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null;
  links?: Record<string, string>;
}

export interface JsonApiResource<A = Record<string, unknown>> {
  type: string;
  id: string;
  attributes?: A;
  relationships?: Record<string, JsonApiRelationship>;
  links?: Record<string, string>;
}

export interface JsonApiDocument<A = Record<string, unknown>> {
  data: JsonApiResource<A>[] | JsonApiResource<A> | null;
  included?: JsonApiResource[];
  links?: Record<string, string>;
  meta?: Record<string, unknown>;
}

export interface JsonApiError {
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
}

export interface JsonApiErrorDocument {
  errors?: JsonApiError[];
}

/** Attributes observed on `devices` resources. */
export interface RingDeviceAttributes {
  name?: string;
  image_url?: string;
  device_kind?: string;
  subscribed?: boolean;
}

/* ---- Normalized ---------------------------------------------------------- */

export type RingDeviceKind = "doorbell" | "camera" | "chime" | "device";

export interface RingDiscoveredDevice {
  id: string;
  name: string;
  type: RingDeviceKind;
  manufacturer: "Ring";
  /** Product hint derived from Ring's own product image path (e.g. "Doorbell Pro"). Undefined when unknown. */
  model?: string;
  imageUrl?: string;
  status: {
    online: boolean | null;
    label: "Online" | "Offline" | "Unknown";
    reportedAt?: string;
    batteryPercentage?: number;
    signalStrength?: number;
    /** Chime snooze (device-status.audio.snooze). null = not reported. */
    snoozeActive?: boolean | null;
    /** device-status.state as returned by Ring (often null). */
    state?: string | null;
  };
  location?: {
    country?: string;
    state?: string;
  };
  /**
   * Read-only capability facts from GET /v1/devices/{id}/capabilities. `undefined` = the
   * capabilities resource was not included; `false`/`null` = Ring reported it absent (null).
   * Capability values are read-only and never indicate control functionality (Ring FAQ).
   */
  capabilities: {
    video?: boolean;
    motionDetection?: boolean;
    snapshot?: boolean;
    privacyZones?: boolean;
    nightVision?: boolean;
    audio?: boolean;
    battery?: boolean;
    maxResolution?: number;
    codecs?: string[];
    ratio?: string;
    supportedResolutions?: number[];
    /** Which video / motion / image settings Ring says are configurable (e.g. resolution_mode, motion_zones). */
    configurable?: { video?: string[]; motion?: string[]; imageEnhancements?: string[] };
    /** Sensor-type capabilities Ring reports (null on cameras/doorbells = absent). */
    sensors?: { co?: boolean; smoke?: boolean; glassBreak?: boolean; tamper?: boolean; flood?: boolean; freeze?: boolean; contact?: boolean };
    /** Chime audio: customizable slot count / supported actions (null on non-chimes). */
    audioSlots?: number | null;
    audioActions?: string[] | null;
  };
  /** Current settings from GET /v1/devices/{id}/configurations (read-only in this API). */
  configuration?: {
    motionEnabled?: boolean;
    hasMotionZones?: boolean;
    hasPrivacyZones?: boolean;
    motionZonesCount?: number;
    privacyZonesCount?: number;
    /** image_enhancements values as reported (e.g. { color_night_vision: "off", hdr: "off" }). */
    imageEnhancements?: Record<string, string>;
    audioVolume?: number;
  };
  source: "ring-playground";
}

export interface ConnectedRingDevice {
  id: string;
  ringDeviceId: string;
  ringName: string;
  displayName: string;
  deviceType: RingDeviceKind;
  model?: string;
  imageUrl?: string;
  locationLabel?: string;
  status: "online" | "offline" | "unknown";
  statusReportedAt?: string;
  capabilities: string[];
  details: RingDiscoveredDevice["capabilities"];
  /** Read-only configuration snapshot from Ring (refreshed on sync). */
  configuration?: RingDiscoveredDevice["configuration"];
  region?: RingDiscoveredDevice["location"];
  source: "ring-playground";
  connectedAt: string;
  lastSyncedAt: string;
  aiEnabled: boolean;
  favorite: boolean;
}

/** GET /v1/users/me - the authenticated Ring account (Playground: synthetic "Playground User"). */
export interface RingAccount {
  /** Ring account identifier (resource id). */
  accountId: string;
  firstName?: string;
  lastName?: string;
  /** Masked for display (l***@domain); the raw address is never stored. */
  emailMasked?: string;
  fetchedAt: string;
}

export type TokenStatus = "missing" | "validating" | "valid" | "expiring" | "expired" | "invalid";

export interface RingSessionInfo {
  status: Exclude<TokenStatus, "validating" | "missing">;
  expiresAt: string;
  connectedAt: string;
  lastValidatedAt: string;
  discoveredCount: number;
  /** Ring account behind the session, when GET /v1/users/me succeeded. */
  account?: RingAccount | null;
}

export type RingErrorCode =
  | "RING_TOKEN_MISSING"
  | "RING_TOKEN_INVALID"
  | "RING_TOKEN_EXPIRED"
  | "RING_FORBIDDEN"
  | "RING_NOT_FOUND"
  | "RING_RATE_LIMITED"
  | "RING_UNAVAILABLE"
  | "RING_BAD_REQUEST"
  | "RING_NETWORK"
  | "RING_NO_SESSION"
  | "RING_UNKNOWN";

export interface RingErrorPayload {
  code: RingErrorCode;
  message: string;
  title: string;
  retryAfterSeconds?: number;
}

/** Recent history events for a device (GET /v1/history/devices/{id}/events). */
export interface RingHistoryEvent {
  id: string;
  /** motion | ding | on_demand | … */
  kind: string;
  createdAt?: string;
  endedAt?: string;
  deviceId?: string;
  /** Computer-vision detection labels when Ring includes them (person, package, vehicle, …). */
  detections: string[];
  attributes: Record<string, unknown>;
}

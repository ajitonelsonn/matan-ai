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
  };
  location?: {
    country?: string;
    state?: string;
  };
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
  };
  configuration?: {
    motionEnabled?: boolean;
    hasMotionZones?: boolean;
    hasPrivacyZones?: boolean;
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
  region?: RingDiscoveredDevice["location"];
  source: "ring-playground";
  connectedAt: string;
  lastSyncedAt: string;
  aiEnabled: boolean;
  favorite: boolean;
}

export type TokenStatus = "missing" | "validating" | "valid" | "expiring" | "expired" | "invalid";

export interface RingSessionInfo {
  status: Exclude<TokenStatus, "validating" | "missing">;
  expiresAt: string;
  connectedAt: string;
  lastValidatedAt: string;
  discoveredCount: number;
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

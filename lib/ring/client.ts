import "server-only";
import { RING_API_BASE_URL, RING_DEVICES_INCLUDE, RING_REQUEST_TIMEOUT_MS } from "./constants";
import { RingApiError, fromResponse } from "./errors";
import { normalizeAccount, normalizeDevices, normalizeHistory } from "./normalize";
import type { JsonApiDocument, JsonApiErrorDocument, RingAccount, RingDeviceAttributes, RingDiscoveredDevice, RingHistoryEvent } from "./types";

/**
 * Server-side Ring Partner API client.
 * - Runs only on the Next.js server (browser requests to Ring are blocked by CORS
 *   and would expose the token).
 * - Never logs the token or Authorization header.
 * - `cache: "no-store"` on every call - responses are user-specific.
 */
async function ringFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const url = `${RING_API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.api+json, application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(RING_REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    console.error({ event: "ring_request_failed", path: path.split("?")[0], reason: e instanceof Error ? e.name : "unknown" });
    throw new RingApiError("RING_NETWORK", 502);
  }

  if (!res.ok) {
    let body: JsonApiErrorDocument | null = null;
    try {
      body = (await res.json()) as JsonApiErrorDocument;
    } catch {
      body = null;
    }
    const err = fromResponse(res.status, body, res.headers.get("Retry-After"));
    console.error({ event: "ring_request_error", path: path.split("?")[0], status: res.status, code: err.code });
    throw err;
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new RingApiError("RING_UNKNOWN", 502, "Ring returned a response Matan AI couldn't read.");
  }
}

/** Device Discovery: every Ring device accessible to this token, with side-loaded status/capabilities/location/configurations. */
export async function discoverRingDevices(token: string): Promise<RingDiscoveredDevice[]> {
  const doc = await ringFetch<JsonApiDocument<RingDeviceAttributes>>(`/v1/devices?include=${RING_DEVICES_INCLUDE}`, token);
  const devices = normalizeDevices(doc);
  console.log({ event: "ring_discovery", success: true, count: devices.length });
  return devices;
}

export async function getRingDevice(token: string, deviceId: string): Promise<RingDiscoveredDevice | null> {
  const doc = await ringFetch<JsonApiDocument<RingDeviceAttributes>>(`/v1/devices/${encodeURIComponent(deviceId)}?include=${RING_DEVICES_INCLUDE}`, token);
  return normalizeDevices(doc)[0] ?? null;
}

export async function getRingDeviceStatus(token: string, deviceId: string) {
  const doc = await ringFetch<JsonApiDocument>(`/v1/devices/${encodeURIComponent(deviceId)}/status`, token);
  const attrs = (Array.isArray(doc.data) ? doc.data[0] : doc.data)?.attributes ?? {};
  const online = typeof attrs.online === "boolean" ? attrs.online : null;
  return { online, reportedAt: typeof attrs.reported_at === "string" ? attrs.reported_at : undefined, raw: attrs };
}

export async function getRingDeviceCapabilities(token: string, deviceId: string) {
  const doc = await ringFetch<JsonApiDocument>(`/v1/devices/${encodeURIComponent(deviceId)}/capabilities`, token);
  return (Array.isArray(doc.data) ? doc.data[0] : doc.data)?.attributes ?? {};
}

export async function getRingDeviceLocation(token: string, deviceId: string) {
  const doc = await ringFetch<JsonApiDocument>(`/v1/devices/${encodeURIComponent(deviceId)}/location`, token);
  const a = (Array.isArray(doc.data) ? doc.data[0] : doc.data)?.attributes ?? {};
  return { country: typeof a.country === "string" ? a.country : undefined, state: typeof a.state === "string" ? a.state : undefined };
}

export async function getRingDeviceConfigurations(token: string, deviceId: string) {
  const doc = await ringFetch<JsonApiDocument>(`/v1/devices/${encodeURIComponent(deviceId)}/configurations`, token);
  return (Array.isArray(doc.data) ? doc.data[0] : doc.data)?.attributes ?? {};
}

export async function getRingDeviceEvents(token: string, deviceId: string): Promise<RingHistoryEvent[]> {
  const doc = await ringFetch<JsonApiDocument>(`/v1/history/devices/${encodeURIComponent(deviceId)}/events`, token);
  return normalizeHistory(doc);
}

/** GET /v1/users/me → the authenticated Ring account (account id + display fields, email masked). */
export async function getRingAccount(token: string): Promise<RingAccount | null> {
  const doc = await ringFetch<JsonApiDocument>(`/v1/users/me`, token);
  return normalizeAccount(doc);
}

/* ---- Live view (WebRTC / WHEP) ------------------------------------------- */

export interface WhepSession {
  sdpAnswer: string;
  /** Session URL returned in the Location header; DELETE it to end the stream. */
  sessionUrl: string | null;
}

/**
 * Start a WHEP live-view session: forward the browser's SDP offer to Ring and
 * return Ring's SDP answer. The token stays on the server.
 * POST /v1/devices/{id}/media/streaming/whep/sessions  (Content-Type: application/sdp)
 */
export async function startWhepSession(token: string, deviceId: string, sdpOffer: string): Promise<WhepSession> {
  const path = `/v1/devices/${encodeURIComponent(deviceId)}/media/streaming/whep/sessions`;
  let res: Response;
  try {
    res = await fetch(`${RING_API_BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp", Accept: "application/sdp" },
      body: sdpOffer,
      cache: "no-store",
      signal: AbortSignal.timeout(RING_REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    console.error({ event: "ring_whep_failed", reason: e instanceof Error ? e.name : "unknown" });
    throw new RingApiError("RING_NETWORK", 502);
  }
  if (!res.ok) {
    let body: JsonApiErrorDocument | null = null;
    try {
      body = (await res.json()) as JsonApiErrorDocument;
    } catch {
      body = null;
    }
    const err = fromResponse(res.status, body, res.headers.get("Retry-After"));
    console.error({ event: "ring_whep_error", status: res.status, code: err.code });
    throw err;
  }
  const sdpAnswer = await res.text();
  if (!/^v=0/m.test(sdpAnswer)) throw new RingApiError("RING_UNKNOWN", 502, "Ring returned an unexpected live-view response.");
  console.log({ event: "ring_whep_started", success: true });
  return { sdpAnswer, sessionUrl: res.headers.get("Location") };
}

/** End a WHEP session. Only Ring session URLs are accepted (no open proxying). */
export async function stopWhepSession(token: string, sessionUrl: string): Promise<void> {
  if (!sessionUrl.startsWith(`${RING_API_BASE_URL}/v1/devices/`) || !sessionUrl.includes("/media/streaming/whep/sessions/")) {
    throw new RingApiError("RING_BAD_REQUEST", 400, "Not a Ring live-view session URL.");
  }
  try {
    await fetch(sessionUrl, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(RING_REQUEST_TIMEOUT_MS) });
    console.log({ event: "ring_whep_stopped" });
  } catch {
    /* best effort - the session times out on Ring's side anyway */
  }
}

/* ---- Event media (snapshots) --------------------------------------------- */

export type SnapshotRequest = { type: "at_timestamp"; timestamp: number } | { type: "latest_in_range"; start_timestamp: number; end_timestamp?: number };

export interface RingSnapshot {
  bytes: Uint8Array;
  contentType: string;
  format: "jpeg" | "png";
  /** Ring-reported capture time (X-Media-Timestamp), when present. */
  capturedAt?: string;
}

const MAX_SNAPSHOT_BYTES = 6 * 1024 * 1024;

/**
 * Download an image snapshot for a device/time window.
 * POST /v1/devices/{id}/media/image/download -> 303 See Other -> pre-signed image URL.
 * The Bearer token is sent ONLY to api.amazonvision.com; the redirect is followed
 * manually without credentials. Returns null when Ring has no media (404/416).
 */
export async function getRingSnapshot(token: string, deviceId: string, req: SnapshotRequest, format: "jpeg" | "png" = "jpeg"): Promise<RingSnapshot | null> {
  const path = `/v1/devices/${encodeURIComponent(deviceId)}/media/image/download`;
  let res: Response;
  try {
    res = await fetch(`${RING_API_BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({ ...req, image_options: { format } }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(RING_REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    console.error({ event: "ring_snapshot_failed", reason: e instanceof Error ? e.name : "unknown" });
    throw new RingApiError("RING_NETWORK", 502);
  }

  if (res.status === 404 || res.status === 416) {
    console.log({ event: "ring_snapshot_unavailable", status: res.status });
    return null;
  }

  let imageRes: Response = res;
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("Location");
    if (!location) return null;
    try {
      imageRes = await fetch(location, { cache: "no-store", signal: AbortSignal.timeout(RING_REQUEST_TIMEOUT_MS) }); // pre-signed URL: no Authorization header
    } catch {
      throw new RingApiError("RING_NETWORK", 502);
    }
  }

  if (!imageRes.ok) {
    if (imageRes === res) {
      let body: JsonApiErrorDocument | null = null;
      try {
        body = (await res.json()) as JsonApiErrorDocument;
      } catch {
        body = null;
      }
      const err = fromResponse(res.status, body, res.headers.get("Retry-After"));
      console.error({ event: "ring_snapshot_error", status: res.status, code: err.code });
      throw err;
    }
    let hint = "";
    try {
      hint = (await imageRes.text()).slice(0, 160);
    } catch {
      /* ignore */
    }
    console.error({ event: "ring_snapshot_media_error", status: imageRes.status, hint });
    return null;
  }

  const contentType = imageRes.headers.get("Content-Type") ?? `image/${format}`;
  const buf = new Uint8Array(await imageRes.arrayBuffer());
  if (!buf.byteLength || buf.byteLength > MAX_SNAPSHOT_BYTES) return null;
  const ts = res.headers.get("X-Media-Timestamp") ?? imageRes.headers.get("X-Media-Timestamp");
  console.log({ event: "ring_snapshot", success: true, bytes: buf.byteLength, contentType });
  return { bytes: buf, contentType, format: /png/i.test(contentType) ? "png" : "jpeg", capturedAt: ts ? new Date(Number(ts)).toISOString() : undefined };
}

/* ---- Event media (video clips) -------------------------------------------- */

export interface RingClip {
  bytes: Uint8Array;
  contentType: string;
  format: "mp4";
  /** Ring-reported actual start (X-Media-Timestamp) and length (X-Media-Length, ms). */
  actualTimestamp?: string;
  actualLengthMs?: number;
  partial: boolean;
}

export const MAX_CLIP_MS = 60_000; // hard cap: never request more than 60 s of video
const MAX_CLIP_BYTES = 20 * 1024 * 1024; // Nova inline video limit is 25 MB total payload

/**
 * Download an existing recording for a time window.
 * POST /v1/devices/{id}/media/video/download { timestamp, duration } -> 200/206 MP4 bytes
 * (416 when nothing was recorded). Follows a 303 without credentials if Ring redirects.
 * Returns null when no media is available.
 */
export async function getRingClip(token: string, deviceId: string, timestampMs: number, durationMs: number): Promise<RingClip | null> {
  const duration = Math.max(1000, Math.min(MAX_CLIP_MS, Math.floor(durationMs)));
  const path = `/v1/devices/${encodeURIComponent(deviceId)}/media/video/download`;
  let res: Response;
  try {
    res = await fetch(`${RING_API_BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "*/*" },
      // Minimal documented body; Ring picks codec/resolution. (Adding video_options caused HTTP 400 on the Playground.)
      body: JSON.stringify({ timestamp: Math.floor(timestampMs), duration }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(RING_REQUEST_TIMEOUT_MS * 2),
    });
  } catch (e) {
    console.error({ event: "ring_clip_failed", reason: e instanceof Error ? e.name : "unknown" });
    throw new RingApiError("RING_NETWORK", 502);
  }
  if (res.status === 404 || res.status === 416) {
    console.log({ event: "ring_clip_unavailable", status: res.status });
    return null;
  }
  let mediaRes: Response = res;
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("Location");
    if (!location) return null;
    try {
      mediaRes = await fetch(location, { cache: "no-store", signal: AbortSignal.timeout(RING_REQUEST_TIMEOUT_MS * 2) });
    } catch {
      throw new RingApiError("RING_NETWORK", 502);
    }
  }
  if (!mediaRes.ok) {
    if (mediaRes === res) {
      let body: JsonApiErrorDocument | null = null;
      try {
        body = (await res.json()) as JsonApiErrorDocument;
      } catch {
        body = null;
      }
      const err = fromResponse(res.status, body, res.headers.get("Retry-After"));
      const first = body?.errors?.[0];
      console.error({ event: "ring_clip_error", status: res.status, code: err.code, ringCode: first?.code, ringTitle: first?.title, ringDetail: first?.detail?.slice(0, 200) });
      if (res.status === 400) return null; // treat "cannot serve this window" as no media rather than failing the analysis
      throw err;
    }
    return null;
  }
  const buf = new Uint8Array(await mediaRes.arrayBuffer());
  if (!buf.byteLength || buf.byteLength > MAX_CLIP_BYTES) {
    console.log({ event: "ring_clip_skipped", bytes: buf.byteLength });
    return null;
  }
  const ts = res.headers.get("X-Media-Timestamp") ?? mediaRes.headers.get("X-Media-Timestamp");
  const len = res.headers.get("X-Media-Length") ?? mediaRes.headers.get("X-Media-Length");
  console.log({ event: "ring_clip", success: true, bytes: buf.byteLength, partial: mediaRes.status === 206, lengthMs: len ? Number(len) : undefined });
  return {
    bytes: buf,
    contentType: mediaRes.headers.get("Content-Type") ?? "video/mp4",
    format: "mp4",
    actualTimestamp: ts ? new Date(Number(ts)).toISOString() : undefined,
    actualLengthMs: len ? Number(len) : undefined,
    partial: mediaRes.status === 206,
  };
}

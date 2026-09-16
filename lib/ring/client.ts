import "server-only";
import { RING_API_BASE_URL, RING_DEVICES_INCLUDE, RING_REQUEST_TIMEOUT_MS } from "./constants";
import { RingApiError, fromResponse } from "./errors";
import { normalizeDevices, normalizeHistory } from "./normalize";
import type { JsonApiDocument, JsonApiErrorDocument, RingDeviceAttributes, RingDiscoveredDevice, RingHistoryEvent } from "./types";

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

export async function getRingUser(token: string) {
  const doc = await ringFetch<JsonApiDocument>(`/v1/users/me`, token);
  const a = (Array.isArray(doc.data) ? doc.data[0] : doc.data)?.attributes ?? {};
  return { firstName: typeof a.first_name === "string" ? a.first_name : undefined, email: typeof a.email === "string" ? a.email : undefined };
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

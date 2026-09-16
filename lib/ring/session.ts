import "server-only";
import { cookies } from "next/headers";
import { RING_PLAYGROUND_TOKEN_LIFETIME_MS, RING_SESSION_COOKIE, RING_TOKEN_EXPIRING_THRESHOLD_MS } from "./constants";
import type { ConnectedRingDevice, RingDiscoveredDevice, RingSessionInfo } from "./types";

/**
 * Server-side Ring Playground session + connected-device store (hackathon Option A).
 * - The raw token lives ONLY here, in server memory, keyed by a random session id.
 * - The browser holds an HttpOnly cookie with the session id - never the token.
 * - Connected devices are stored separately from the UI mock dataset and never
 *   contain the token.
 * State survives Next.js hot reloads via globalThis; it is intentionally lost on restart.
 */
interface RingSession {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastValidatedAt: number;
  invalidated: boolean;
  discovered: RingDiscoveredDevice[];
}

interface RingState {
  sessions: Map<string, RingSession>;
  connected: ConnectedRingDevice[];
}

declare global {
  // eslint-disable-next-line no-var
  var __matanRing: RingState | undefined;
}

function state(): RingState {
  if (!globalThis.__matanRing) globalThis.__matanRing = { sessions: new Map(), connected: [] };
  return globalThis.__matanRing;
}

/** Best-effort expiry from a JWT `exp` claim (no verification - only used for the countdown). */
function expFromJwt(token: string): number | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { exp?: number };
    if (typeof payload.exp === "number" && payload.exp * 1000 > Date.now()) return payload.exp * 1000;
  } catch {
    /* not a JWT - fall back to the documented lifetime */
  }
  return undefined;
}

export async function createRingSession(token: string, discovered: RingDiscoveredDevice[]): Promise<RingSession> {
  const s = state();
  // One active session per browser: drop the previous one.
  const existing = await readSessionId();
  if (existing) s.sessions.delete(existing);
  for (const [id, sess] of s.sessions) if (sess.expiresAt < Date.now() - 60 * 60 * 1000) s.sessions.delete(id);

  const now = Date.now();
  const session: RingSession = {
    id: crypto.randomUUID(),
    token,
    createdAt: now,
    expiresAt: expFromJwt(token) ?? now + RING_PLAYGROUND_TOKEN_LIFETIME_MS,
    lastValidatedAt: now,
    invalidated: false,
    discovered,
  };
  s.sessions.set(session.id, session);
  const jar = await cookies();
  jar.set(RING_SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil((session.expiresAt - now) / 1000) + 60 * 60, // keep the cookie a bit longer so the "expired" state is visible
  });
  return session;
}

async function readSessionId() {
  const jar = await cookies();
  return jar.get(RING_SESSION_COOKIE)?.value;
}

export async function getRingSession(): Promise<RingSession | null> {
  const id = await readSessionId();
  if (!id) return null;
  return state().sessions.get(id) ?? null;
}

export function sessionInfo(session: RingSession | null): RingSessionInfo | null {
  if (!session) return null;
  const remaining = session.expiresAt - Date.now();
  const status: RingSessionInfo["status"] = session.invalidated ? "invalid" : remaining <= 0 ? "expired" : remaining <= RING_TOKEN_EXPIRING_THRESHOLD_MS ? "expiring" : "valid";
  return {
    status,
    expiresAt: new Date(session.expiresAt).toISOString(),
    connectedAt: new Date(session.createdAt).toISOString(),
    lastValidatedAt: new Date(session.lastValidatedAt).toISOString(),
    discoveredCount: session.discovered.length,
  };
}

/** A usable token for a server-to-server call, or null when missing/expired/invalidated. */
export function usableToken(session: RingSession | null): string | null {
  if (!session || session.invalidated || session.expiresAt <= Date.now()) return null;
  return session.token;
}

export function markValidated(session: RingSession, discovered?: RingDiscoveredDevice[]) {
  session.lastValidatedAt = Date.now();
  if (discovered) session.discovered = discovered;
}

export function markInvalid(session: RingSession) {
  session.invalidated = true;
  session.token = "";
}

export async function destroyRingSession() {
  const id = await readSessionId();
  if (id) state().sessions.delete(id);
  const jar = await cookies();
  jar.delete(RING_SESSION_COOKIE);
}

/* ---- Connected devices --------------------------------------------------- */

export function listConnected(): ConnectedRingDevice[] {
  return state().connected;
}

export function upsertConnected(device: ConnectedRingDevice) {
  const list = state().connected;
  const idx = list.findIndex((d) => d.ringDeviceId === device.ringDeviceId);
  if (idx >= 0) list[idx] = { ...list[idx], ...device, id: list[idx].id, connectedAt: list[idx].connectedAt };
  else list.push(device);
  return list[idx >= 0 ? idx : list.length - 1];
}

export function updateConnected(id: string, patch: Partial<Pick<ConnectedRingDevice, "displayName" | "locationLabel" | "aiEnabled" | "favorite">>) {
  const d = state().connected.find((x) => x.id === id);
  if (!d) return null;
  if (typeof patch.displayName === "string" && patch.displayName.trim()) d.displayName = patch.displayName.trim().slice(0, 60);
  if (patch.locationLabel !== undefined) d.locationLabel = patch.locationLabel.trim().slice(0, 60) || undefined;
  if (typeof patch.aiEnabled === "boolean") d.aiEnabled = patch.aiEnabled;
  if (typeof patch.favorite === "boolean") d.favorite = patch.favorite;
  return d;
}

export function removeConnected(id: string) {
  const list = state().connected;
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/** Refresh status/capabilities of connected devices from a fresh discovery result. */
export function syncConnected(discovered: RingDiscoveredDevice[]) {
  const now = new Date().toISOString();
  for (const d of state().connected) {
    const fresh = discovered.find((x) => x.id === d.ringDeviceId);
    if (!fresh) continue;
    d.ringName = fresh.name;
    d.status = fresh.status.online === null ? "unknown" : fresh.status.online ? "online" : "offline";
    d.statusReportedAt = fresh.status.reportedAt;
    d.details = fresh.capabilities;
    d.imageUrl = fresh.imageUrl ?? d.imageUrl;
    d.model = fresh.model ?? d.model;
    d.lastSyncedAt = now;
  }
}

export function toConnected(dev: RingDiscoveredDevice, local: { displayName?: string; locationLabel?: string; aiEnabled?: boolean; favorite?: boolean }, capabilityLabels: string[]): ConnectedRingDevice {
  const now = new Date().toISOString();
  return {
    id: `ring-${crypto.randomUUID().slice(0, 8)}`,
    ringDeviceId: dev.id,
    ringName: dev.name,
    displayName: (local.displayName?.trim() || dev.name).slice(0, 60),
    deviceType: dev.type,
    model: dev.model,
    imageUrl: dev.imageUrl,
    locationLabel: local.locationLabel?.trim().slice(0, 60) || undefined,
    status: dev.status.online === null ? "unknown" : dev.status.online ? "online" : "offline",
    statusReportedAt: dev.status.reportedAt,
    capabilities: capabilityLabels,
    details: dev.capabilities,
    region: dev.location,
    source: "ring-playground",
    connectedAt: now,
    lastSyncedAt: now,
    aiEnabled: local.aiEnabled ?? true,
    favorite: local.favorite ?? false,
  };
}

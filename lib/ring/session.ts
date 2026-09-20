import "server-only";
import { cookies } from "next/headers";
import { RING_PLAYGROUND_TOKEN_LIFETIME_MS, RING_SESSION_COOKIE, RING_TOKEN_EXPIRING_THRESHOLD_MS } from "./constants";
import type { ConnectedRingDevice, RingAccount, RingDiscoveredDevice, RingSessionInfo } from "./types";
import { currentUserSub } from "@/lib/auth/server";
import { SK, deleteItem, putItem, queryPrefix, stripKeys, userPK } from "@/lib/aws/dynamodb";

/**
 * Server-side Ring Playground session + connected-device store (hackathon Option A).
 * - The raw token lives ONLY here, in server memory, keyed by a random session id.
 * - The browser holds an HttpOnly cookie with the session id - never the token.
 * - Connected devices are per Cognito user, persisted in DynamoDB
 *   (PK=USER#{sub}, SK=DEVICE#{id}) with a per-user in-memory cache, and never
 *   contain the token.
 * Token sessions survive hot reloads via globalThis and are intentionally lost on restart.
 */
interface RingSession {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastValidatedAt: number;
  invalidated: boolean;
  discovered: RingDiscoveredDevice[];
  /** GET /v1/users/me result (no raw email). */
  account?: RingAccount | null;
}

interface RingState {
  sessions: Map<string, RingSession>;
  /** sub → connected devices (hydrated from DynamoDB once per process). */
  connected: Map<string, ConnectedRingDevice[]>;
  hydrated: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __matanRing: RingState | undefined;
}

function state(): RingState {
  if (!globalThis.__matanRing) globalThis.__matanRing = { sessions: new Map(), connected: new Map(), hydrated: new Set() };
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

export async function createRingSession(token: string, discovered: RingDiscoveredDevice[], account?: RingAccount | null): Promise<RingSession> {
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
    account: account ?? null,
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
    account: session.account ?? null,
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

/* ---- Connected devices (per user, DynamoDB-backed) ----------------------- */

type DeviceItem = ConnectedRingDevice & { PK: string; SK: string; type: "DEVICE" };

function connectedList(sub = currentUserSub()) {
  const s = state();
  let list = s.connected.get(sub);
  if (!list) {
    list = [];
    s.connected.set(sub, list);
  }
  return list;
}

/** Load the user's connected devices from DynamoDB into the cache (once per process). */
export async function hydrateConnected(sub: string, force = false) {
  const s = state();
  if (!force && s.hydrated.has(sub)) return;
  const items = await queryPrefix<DeviceItem>(userPK(sub), "DEVICE#");
  const list = items.map((it) => stripKeys<ConnectedRingDevice & { type?: string }>(it as unknown as Record<string, unknown>)).map(({ type: _t, ...d }) => d as ConnectedRingDevice);
  list.sort((a, b) => a.connectedAt.localeCompare(b.connectedAt));
  s.connected.set(sub, list);
  s.hydrated.add(sub);
  console.info({ event: "dynamodb_hydrated", kind: "devices", count: list.length });
}

async function persistDevice(sub: string, d: ConnectedRingDevice) {
  // Only application data - never the Ring token, never the raw session.
  await putItem({ ...d, PK: userPK(sub), SK: SK.device(d.id), type: "DEVICE" });
}

export function listConnected(): ConnectedRingDevice[] {
  return connectedList();
}

export async function upsertConnected(device: ConnectedRingDevice) {
  const sub = currentUserSub();
  const list = connectedList(sub);
  const idx = list.findIndex((d) => d.ringDeviceId === device.ringDeviceId);
  if (idx >= 0) list[idx] = { ...list[idx], ...device, id: list[idx].id, connectedAt: list[idx].connectedAt };
  else list.push(device);
  const saved = list[idx >= 0 ? idx : list.length - 1];
  await persistDevice(sub, saved);
  return saved;
}

export async function updateConnected(id: string, patch: Partial<Pick<ConnectedRingDevice, "displayName" | "locationLabel" | "aiEnabled" | "favorite">>) {
  const sub = currentUserSub();
  const d = connectedList(sub).find((x) => x.id === id);
  if (!d) return null;
  if (typeof patch.displayName === "string" && patch.displayName.trim()) d.displayName = patch.displayName.trim().slice(0, 60);
  if (patch.locationLabel !== undefined) d.locationLabel = patch.locationLabel.trim().slice(0, 60) || undefined;
  if (typeof patch.aiEnabled === "boolean") d.aiEnabled = patch.aiEnabled;
  if (typeof patch.favorite === "boolean") d.favorite = patch.favorite;
  await persistDevice(sub, d);
  return d;
}

export async function removeConnected(id: string) {
  const sub = currentUserSub();
  const list = connectedList(sub);
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  await deleteItem(userPK(sub), SK.device(id));
  return true;
}

/** Refresh status/capabilities of connected devices from a fresh discovery result. */
export async function syncConnected(discovered: RingDiscoveredDevice[]) {
  const sub = currentUserSub();
  const now = new Date().toISOString();
  const changed: ConnectedRingDevice[] = [];
  for (const d of connectedList(sub)) {
    const fresh = discovered.find((x) => x.id === d.ringDeviceId);
    if (!fresh) continue;
    d.ringName = fresh.name;
    d.status = fresh.status.online === null ? "unknown" : fresh.status.online ? "online" : "offline";
    d.statusReportedAt = fresh.status.reportedAt;
    d.details = fresh.capabilities;
    d.configuration = fresh.configuration ?? d.configuration;
    d.region = fresh.location ?? d.region;
    d.imageUrl = fresh.imageUrl ?? d.imageUrl;
    d.model = fresh.model ?? d.model;
    d.lastSyncedAt = now;
    changed.push(d);
  }
  await Promise.all(changed.map((d) => persistDevice(sub, d)));
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
    configuration: dev.configuration,
    region: dev.location,
    source: "ring-playground",
    connectedAt: now,
    lastSyncedAt: now,
    aiEnabled: local.aiEnabled ?? true,
    favorite: local.favorite ?? false,
  };
}

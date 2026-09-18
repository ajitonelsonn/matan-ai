import "server-only";
import type { SettingsData } from "@/lib/types";
import { defaultSettings } from "@/lib/mock/settings";
import { currentUser } from "@/lib/auth/server";
import { SK, getItem, putItem, userPK } from "@/lib/aws/dynamodb";
import { getStore } from "@/lib/mock/store";

/**
 * Per-user settings (PK=USER#{sub}, SK=SETTINGS) with an in-memory cache.
 * Outside an authenticated scope (Demo/mock routes, tests) the mock store is used.
 */
declare global {
  // eslint-disable-next-line no-var
  var __matanUserSettings: Map<string, SettingsData> | undefined;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function cache() {
  if (!globalThis.__matanUserSettings) globalThis.__matanUserSettings = new Map();
  return globalThis.__matanUserSettings;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function mergeSettings<T extends object>(target: T, patch: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = mergeSettings((out[k] ?? {}) as object, v as object);
    else if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Load the user's settings (defaults merged with what is stored) into the cache, once per process. */
export async function hydrateUserSettings(sub: string, force = false) {
  if (!force && cache().has(sub)) return;
  const item = await getItem<{ settings?: DeepPartial<SettingsData> }>(userPK(sub), SK.settings);
  cache().set(sub, item?.settings ? mergeSettings(clone(defaultSettings), item.settings) : clone(defaultSettings));
}

/** Current settings: the signed-in user's when in scope, else the mock store's. */
export function getUserSettings(): SettingsData {
  const u = currentUser();
  if (!u) return getStore().settings;
  return cache().get(u.sub) ?? clone(defaultSettings);
}

export async function saveUserSettings(patch: DeepPartial<SettingsData>): Promise<SettingsData> {
  const u = currentUser();
  if (!u) {
    const s = getStore();
    s.settings = mergeSettings(s.settings, patch);
    return s.settings;
  }
  await hydrateUserSettings(u.sub);
  const next = mergeSettings(getUserSettings(), patch);
  cache().set(u.sub, next);
  await putItem({ PK: userPK(u.sub), SK: SK.settings, type: "SETTINGS", settings: next });
  return next;
}

export async function resetUserSettings(): Promise<SettingsData> {
  const u = currentUser();
  const fresh = clone(defaultSettings);
  if (!u) {
    getStore().settings = fresh;
    return fresh;
  }
  cache().set(u.sub, fresh);
  await putItem({ PK: userPK(u.sub), SK: SK.settings, type: "SETTINGS", settings: fresh });
  return fresh;
}

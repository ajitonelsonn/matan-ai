import { getStore, delay, resetStore } from "@/lib/mock/store";
import { defaultSettings } from "@/lib/mock/settings";
import { user } from "@/lib/mock/users";
import { ok, readJson } from "@/lib/api/http";
import type { SettingsData } from "@/lib/types";

export const dynamic = "force-dynamic";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T extends object>(target: T, patch: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = merge((out[k] ?? {}) as object, v as object);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export async function GET() {
  await delay(200);
  return ok({ settings: getStore().settings, account: user });
}

export async function PATCH(req: Request) {
  await delay(200);
  const body = await readJson<DeepPartial<SettingsData>>(req);
  const s = getStore();
  s.settings = merge(s.settings, body);
  return ok({ settings: s.settings, account: user });
}

export async function POST(req: Request) {
  const body = await readJson<{ action: "reset" | "resetApp" | "export" }>(req);
  await delay(600);
  if (body.action === "reset") {
    getStore().settings = JSON.parse(JSON.stringify(defaultSettings));
  }
  if (body.action === "resetApp") {
    resetStore();
  }
  if (body.action === "export") {
    return ok({ exported: true, size: "12.4 MB", file: "matan-ai-export-2026-09-11.zip" });
  }
  return ok({ settings: getStore().settings, account: user });
}

import { delay, resetStore } from "@/lib/mock/store";
import { user } from "@/lib/mock/users";
import { ok, readJson } from "@/lib/api/http";
import type { SettingsData } from "@/lib/types";
import { userRoute } from "@/lib/auth/scope";
import { getUserSettings, resetUserSettings, saveUserSettings } from "@/lib/matan/user-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Settings are per signed-in user and persisted in DynamoDB (SK=SETTINGS). Account facts still come from the mock profile. */
export const GET = userRoute(async () => {
  await delay(120);
  return ok({ settings: getUserSettings(), account: user });
});

export const PATCH = userRoute(async (req) => {
  const body = await readJson<DeepPartial<SettingsData>>(req);
  const settings = await saveUserSettings(body);
  return ok({ settings, account: user });
});

export const POST = userRoute(async (req) => {
  const body = await readJson<{ action: "reset" | "resetApp" | "export" }>(req);
  await delay(300);
  if (body.action === "reset") return ok({ settings: await resetUserSettings(), account: user });
  if (body.action === "resetApp") {
    resetStore();
    return ok({ settings: await resetUserSettings(), account: user });
  }
  if (body.action === "export") return ok({ exported: true, size: "12.4 MB", file: "matan-ai-export-2026-09-11.zip" });
  return ok({ settings: getUserSettings(), account: user });
});

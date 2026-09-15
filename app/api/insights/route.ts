import { getStore, delay } from "@/lib/mock/store";
import { buildInsights } from "@/lib/mock/insights";
import { ok } from "@/lib/api/http";
import type { InsightRange } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await delay(320);
  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "7d") as InsightRange;
  return ok(buildInsights(getStore().events, range));
}

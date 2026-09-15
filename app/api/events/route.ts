import { getStore, delay } from "@/lib/mock/store";
import { eventsInRange } from "@/lib/mock/insights";
import { ok } from "@/lib/api/http";
import type { EventPriority, EventType, InsightRange, Paginated, RingEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const categoryTypes: Record<string, EventType[]> = {
  all: ["person", "package", "vehicle", "animal", "doorbell", "unusual", "other"],
  people: ["person"],
  packages: ["package"],
  vehicles: ["vehicle"],
  animals: ["animal"],
  doorbell: ["doorbell"],
  others: ["other", "unusual"],
};

export async function GET(req: Request) {
  await delay();
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const category = url.searchParams.get("category") ?? "all";
  const range = (url.searchParams.get("range") ?? "7d") as InsightRange;
  const priority = url.searchParams.get("priority")?.split(",").filter(Boolean) as EventPriority[] | undefined;
  const cameraId = url.searchParams.get("cameraId");
  const sort = url.searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));

  const s = getStore();
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean);
  if (ids?.length) {
    const items = ids.map((id) => s.events.find((e) => e.id === id)).filter((e): e is RingEvent => Boolean(e));
    return ok({ items, meta: { total: items.length, page: 1, pageSize: items.length, hasMore: false }, categoryCounts: {} });
  }
  let list = eventsInRange(s.events, range);
  if (cameraId) list = list.filter((e) => e.cameraId === cameraId);
  if (search) {
    list = list.filter((e) =>
      [e.title, e.location, e.summary, ...e.tags].some((f) => f.toLowerCase().includes(search)),
    );
  }
  // Category counts are computed after search but before category filter so tabs stay useful.
  const categoryCounts: Record<string, number> = {};
  for (const [key, types] of Object.entries(categoryTypes)) {
    categoryCounts[key] = list.filter((e) => types.includes(e.type)).length;
  }
  const types = categoryTypes[category] ?? categoryTypes.all;
  list = list.filter((e) => types.includes(e.type));
  if (priority?.length) list = list.filter((e) => priority.includes(e.priority));

  const weight: Record<EventPriority, number> = { important: 0, attention: 1, normal: 2 };
  list = [...list].sort((a, b) => {
    if (sort === "oldest") return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (sort === "priority") return weight[a.priority] - weight[b.priority] || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const total = list.length;
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  const result: Paginated<RingEvent> & { categoryCounts: Record<string, number> } = {
    items,
    meta: { total, page, pageSize, hasMore: page * pageSize < total },
    categoryCounts,
  };
  return ok(result);
}

import { getStore, delay } from "@/lib/mock/store";
import { ok, notFound, readJson } from "@/lib/api/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await delay(120);
  const { id } = await params;
  const ev = getStore().events.find((e) => e.id === id);
  return ev ? ok(ev) : notFound("Event not found");
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ starred?: boolean; reviewed?: boolean; actionId?: string; priority?: "normal" | "attention" | "important" }>(req);
  const ev = getStore().events.find((e) => e.id === id);
  if (!ev) return notFound("Event not found");
  if (typeof body.starred === "boolean") ev.starred = body.starred;
  if (typeof body.reviewed === "boolean") ev.reviewed = body.reviewed;
  if (body.priority) ev.priority = body.priority;
  if (body.actionId && ev.recommendedActions) {
    const a = ev.recommendedActions.find((x) => x.id === body.actionId);
    if (a) a.done = !a.done;
  }
  return ok(ev);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const s = getStore();
  const idx = s.events.findIndex((e) => e.id === id);
  if (idx === -1) return notFound("Event not found");
  s.events.splice(idx, 1);
  return ok({ deleted: id });
}

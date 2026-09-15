import { getStore, delay, nextId } from "@/lib/mock/store";
import { ok, notFound, readJson } from "@/lib/api/http";
import type { Automation } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await delay(120);
  const { id } = await params;
  const a = getStore().automations.find((x) => x.id === id);
  return a ? ok(a) : notFound("Automation not found");
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<Pick<Automation, "enabled" | "name" | "description" | "trigger" | "condition" | "action">> & { action?: string; duplicate?: boolean }>(req);
  const s = getStore();
  const a = s.automations.find((x) => x.id === id);
  if (!a) return notFound("Automation not found");
  if (body.duplicate) {
    const copy: Automation = { ...a, id: nextId("aut"), name: `${a.name} (copy)`, runsThisWeek: 0, lastRunAt: undefined, exampleText: "Duplicated just now" };
    s.automations.splice(s.automations.indexOf(a) + 1, 0, copy);
    return ok(copy, { status: 201 });
  }
  if (typeof body.enabled === "boolean") {
    a.enabled = body.enabled;
    s.automationLogs.unshift({
      id: nextId("log"),
      automationId: a.id,
      automationName: a.name,
      timestamp: MOCK_NOW,
      message: body.enabled ? "Automation enabled." : "Automation disabled.",
      status: "success",
    });
  }
  if (body.name) a.name = body.name;
  if (body.description) a.description = body.description;
  if (body.trigger) a.trigger = body.trigger;
  if ("condition" in body) a.condition = body.condition || undefined;
  if (body.action) a.action = body.action;
  return ok(a);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const s = getStore();
  const idx = s.automations.findIndex((x) => x.id === id);
  if (idx === -1) return notFound("Automation not found");
  const [removed] = s.automations.splice(idx, 1);
  s.automationLogs.unshift({
    id: nextId("log"),
    automationId: removed.id,
    automationName: removed.name,
    timestamp: MOCK_NOW,
    message: "Automation deleted.",
    status: "success",
  });
  return ok({ deleted: id });
}

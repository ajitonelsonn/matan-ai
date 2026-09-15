import { getStore, delay, nextId } from "@/lib/mock/store";
import { suggestedAutomations, triggerOptions, conditionOptions, actionOptions } from "@/lib/mock/automations";
import { ok, badRequest, readJson } from "@/lib/api/http";
import type { Automation, AutomationCategory } from "@/lib/types";
import { MOCK_NOW } from "@/lib/mock/clock";

export const dynamic = "force-dynamic";

export async function GET() {
  await delay();
  const s = getStore();
  const counts: Record<string, number> = { all: s.automations.length };
  for (const a of s.automations) counts[a.category] = (counts[a.category] ?? 0) + 1;
  return ok({
    items: s.automations,
    counts,
    suggested: suggestedAutomations.filter((sug) => !s.automations.some((a) => a.name === sug.name)),
    logs: s.automationLogs,
    options: { triggers: triggerOptions, conditions: conditionOptions, actions: actionOptions },
  });
}

export async function POST(req: Request) {
  await delay(500);
  const body = await readJson<{
    name?: string;
    trigger: string;
    condition?: string;
    action: string;
    category?: AutomationCategory;
    icon?: string;
    tone?: Automation["tone"];
    description?: string;
  }>(req);
  if (!body.trigger || !body.action) return badRequest("Trigger and action are required");
  const s = getStore();
  const category: AutomationCategory =
    body.category ??
    (/package|deliver/i.test(body.trigger) ? "deliveries" : /unusual|night|security|alert/i.test(`${body.trigger} ${body.action}`) ? "security" : /family/i.test(body.trigger) ? "care" : /light|door|reply/i.test(body.action) ? "access" : "custom");
  const automation: Automation = {
    id: nextId("aut"),
    name: body.name?.trim() || `When ${body.trigger.toLowerCase()}`,
    description: body.description || `${body.trigger} → ${body.action}`,
    category,
    trigger: body.trigger,
    condition: body.condition,
    action: body.action,
    enabled: true,
    icon: body.icon ?? "Zap",
    tone: body.tone ?? "primary",
    exampleText: "Created just now",
    runsThisWeek: 0,
  };
  s.automations.unshift(automation);
  s.automationLogs.unshift({
    id: nextId("log"),
    automationId: automation.id,
    automationName: automation.name,
    timestamp: MOCK_NOW,
    message: "Automation created and enabled.",
    status: "success",
  });
  return ok(automation, { status: 201 });
}

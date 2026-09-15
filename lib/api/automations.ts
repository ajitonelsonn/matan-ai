import { request } from "./client";
import type { Automation, AutomationCategory, AutomationLog, SuggestedAutomation } from "@/lib/types";

export interface AutomationsResponse {
  items: Automation[];
  counts: Record<string, number>;
  suggested: SuggestedAutomation[];
  logs: AutomationLog[];
  options: { triggers: string[]; conditions: string[]; actions: string[] };
}

export const automationsApi = {
  list: () => request<AutomationsResponse>("/api/automations"),
  get: (id: string) => request<Automation>(`/api/automations/${id}`),
  create: (body: {
    name?: string;
    trigger: string;
    condition?: string;
    action: string;
    category?: AutomationCategory;
    icon?: string;
    tone?: Automation["tone"];
    description?: string;
  }) => request<Automation>("/api/automations", { method: "POST", json: body }),
  update: (id: string, patch: Partial<Pick<Automation, "enabled" | "name" | "description" | "trigger" | "condition" | "action">>) =>
    request<Automation>(`/api/automations/${id}`, { method: "PATCH", json: patch }),
  duplicate: (id: string) => request<Automation>(`/api/automations/${id}`, { method: "PATCH", json: { duplicate: true } }),
  remove: (id: string) => request<{ deleted: string }>(`/api/automations/${id}`, { method: "DELETE" }),
};

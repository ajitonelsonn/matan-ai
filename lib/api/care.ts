import { request } from "./client";
import type { CareContext, MatanRule } from "@/lib/matan/rules/types";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Care Context & Smart Rules (Matan-owned configuration; authenticated, user-scoped). */
export const careApi = {
  get: () => request<{ context: CareContext }>("/api/matan/care"),
  save: (patch: DeepPartial<CareContext>) => request<{ context: CareContext }>("/api/matan/care", { method: "PUT", json: patch }),
  rules: () => request<{ rules: MatanRule[] }>("/api/matan/rules"),
  createRule: (rule: Partial<MatanRule>) => request<{ rule: MatanRule }>("/api/matan/rules", { method: "POST", json: rule }),
  updateRule: (id: string, patch: Partial<MatanRule>) => request<{ rule: MatanRule }>(`/api/matan/rules/${encodeURIComponent(id)}`, { method: "PATCH", json: patch }),
  deleteRule: (id: string) => request<{ deleted: string }>(`/api/matan/rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

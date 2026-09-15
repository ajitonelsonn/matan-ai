import { request, qs } from "./client";
import type { InsightRange, InsightsData } from "@/lib/types";

export const insightsApi = {
  get: (range: InsightRange = "7d") => request<InsightsData>(`/api/insights${qs({ range })}`),
};

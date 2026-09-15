import { request } from "./client";
import type { CareFeature, CareInsight, FamilyActivity, FamilyMember, FamilyPresence } from "@/lib/types";

export interface FamilyResponse {
  members: FamilyMember[];
  counts: Record<FamilyPresence, number>;
  activity: FamilyActivity[];
  insights: CareInsight[];
  features: CareFeature[];
  liveViews: { cameraId: string; label: string; imageUrl: string }[];
  status: "safe" | "unknown" | "attention";
}

export const familyApi = {
  get: () => request<FamilyResponse>("/api/family"),
  setFeature: (featureId: string, enabled: boolean) => request<FamilyResponse>("/api/family", { method: "PATCH", json: { featureId, enabled } }),
  setPresence: (memberId: string, presence: FamilyPresence) => request<FamilyResponse>("/api/family", { method: "PATCH", json: { memberId, presence } }),
  addMember: (body: { name: string; role: string }) => request<FamilyMember>("/api/family", { method: "POST", json: body }),
  removeMember: (id: string) => request<FamilyResponse>(`/api/family?id=${id}`, { method: "DELETE" }),
};

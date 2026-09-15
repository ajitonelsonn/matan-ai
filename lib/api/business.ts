import { request } from "./client";
import type {
  BusinessEvent,
  BusinessInsight,
  BusinessIntegration,
  BusinessLocation,
  BusinessReport,
  TeamMember,
} from "@/lib/types";

export interface BusinessResponse {
  locations: BusinessLocation[];
  team: TeamMember[];
  events: BusinessEvent[];
  insights: BusinessInsight[];
  trend: { date: string; day: string; people: number; vehicles: number; packages: number; security: number }[];
  reports: BusinessReport[];
  integrations: BusinessIntegration[];
  metrics: { locations: number; cameras: number; team: number; securityEvents: number };
}

export const businessApi = {
  get: () => request<BusinessResponse>("/api/business"),
  setIntegration: (integrationId: string, connected: boolean) =>
    request<BusinessResponse>("/api/business", { method: "PATCH", json: { integrationId, connected } }),
  setRole: (memberId: string, role: TeamMember["role"]) => request<BusinessResponse>("/api/business", { method: "PATCH", json: { memberId, role } }),
  setLocationStatus: (locationId: string, status: "online" | "offline") =>
    request<BusinessResponse>("/api/business", { method: "PATCH", json: { locationId, status } }),
  generateReport: (name?: string, period?: string) => request<BusinessReport>("/api/business", { method: "POST", json: { action: "report", name, period } }),
  addLocation: (name: string, city: string) => request<BusinessLocation>("/api/business", { method: "POST", json: { action: "location", name, city } }),
  addMember: (name: string, role: TeamMember["role"]) => request<TeamMember>("/api/business", { method: "POST", json: { action: "member", name, role } }),
  removeMember: (memberId: string) => request<BusinessResponse>(`/api/business?memberId=${memberId}`, { method: "DELETE" }),
  removeReport: (reportId: string) => request<BusinessResponse>(`/api/business?reportId=${reportId}`, { method: "DELETE" }),
};

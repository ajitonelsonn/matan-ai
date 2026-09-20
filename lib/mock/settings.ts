import type { SettingsData } from "@/lib/types";

export const defaultSettings: SettingsData = {
  general: {
    appName: "Ajito's Home",
    timeZone: "(GMT+9) Dili, Timor-Leste",
    dateFormat: "DD/MM/YYYY",
    startPage: "Home",
  },
  notifications: {
    securityAlerts: true,
    packageDeliveries: true,
    familyActivity: true,
    deviceStatus: true,
    marketingUpdates: false,
    quietHoursEnabled: true,
    quietHours: "10:00 PM - 06:00 AM",
    channels: { push: true, email: true, sms: false },
  },
  privacy: {
    retentionDays: 30,
    aiProcessing: "balanced",
    privacyZones: 2,
    shareWithFamily: true,
    shareAnonymizedAnalytics: false,
  },
  ai: {
    sensitivity: "Medium",
    peopleRecognition: true,
    knownFaces: 6,
    smartAlerts: true,
    language: "English",
    autoAnalyze: "snapshot",
    autoIncludeLiveView: true,
    mediaPadSeconds: 5,
  },
  security: { activeModeId: "home", history: [] },
  appearance: {
    theme: "Dark",
    accent: "blue",
    fontSize: "Medium",
  },
  region: {
    language: "English",
    region: "Timor-Leste",
    units: "Metric (°C, km)",
  },
};

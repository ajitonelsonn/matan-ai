/**
 * In-memory mock store. This is the single source of truth behind the mock API
 * route handlers, so every page reads/writes the same state. It persists across
 * Next.js hot reloads via globalThis. Replace with real services later.
 */
import type {
  Automation,
  AutomationLog,
  CareFeature,
  Device,
  ModeActivity,
  ModeSchedule,
  Notification,
  RingEvent,
  SecurityMode,
  SecurityModeId,
  SettingsData,
  AssistantConversation,
  BusinessIntegration,
  BusinessReport,
  FamilyMember,
  TeamMember,
  BusinessLocation,
} from "@/lib/types";
import { allEvents } from "./events";
import { devices } from "./devices";
import { automations, automationLogs } from "./automations";
import { securityModes, modeSchedules, modeActivity } from "./securityModes";
import { careFeatures, familyMembers } from "./family";
import { businessIntegrations, businessReports, teamMembers, businessLocations } from "./business";
import { notifications } from "./users";
import { defaultSettings } from "./settings";
import { seedConversations } from "./assistantSeed";

export interface MockState {
  events: RingEvent[];
  devices: Device[];
  automations: Automation[];
  automationLogs: AutomationLog[];
  securityModes: SecurityMode[];
  activeModeId: SecurityModeId;
  scheduleEnabled: boolean;
  schedules: ModeSchedule[];
  modeActivity: ModeActivity[];
  careFeatures: CareFeature[];
  familyMembers: FamilyMember[];
  notifications: Notification[];
  settings: SettingsData;
  conversations: AssistantConversation[];
  integrations: BusinessIntegration[];
  reports: BusinessReport[];
  team: TeamMember[];
  locations: BusinessLocation[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function createState(): MockState {
  return {
    events: clone(allEvents),
    devices: clone(devices),
    automations: clone(automations),
    automationLogs: clone(automationLogs),
    securityModes: clone(securityModes),
    activeModeId: "home",
    scheduleEnabled: true,
    schedules: clone(modeSchedules),
    modeActivity: clone(modeActivity),
    careFeatures: clone(careFeatures),
    familyMembers: clone(familyMembers),
    notifications: clone(notifications),
    settings: clone(defaultSettings),
    conversations: clone(seedConversations),
    integrations: clone(businessIntegrations),
    reports: clone(businessReports),
    team: clone(teamMembers),
    locations: clone(businessLocations),
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __matanStore: MockState | undefined;
}

export function getStore(): MockState {
  if (!globalThis.__matanStore) {
    globalThis.__matanStore = createState();
  }
  return globalThis.__matanStore;
}

export function resetStore() {
  globalThis.__matanStore = createState();
  return globalThis.__matanStore;
}

/** Small artificial latency so loading states are visible in the demo. */
export function delay(ms = 260) {
  return new Promise((r) => setTimeout(r, ms));
}

let idCounter = 5000;
export function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/* ---------------------------------------------------------------------------
   Core MATAN AI domain types. Shared by the mock API, client API and UI.
--------------------------------------------------------------------------- */

export type EventPriority = "normal" | "attention" | "important";

export type EventType =
  | "person"
  | "package"
  | "vehicle"
  | "animal"
  | "doorbell"
  | "unusual"
  | "other";

export interface EventTimelineStep {
  time: string; // ISO
  label: string;
}

export interface RecommendedAction {
  id: string;
  label: string;
  done: boolean;
}

export interface RingEvent {
  id: string;
  type: EventType;
  title: string;
  location: string;
  cameraId?: string;
  timestamp: string; // ISO
  priority: EventPriority;
  /** Optional label override for the risk pill, e.g. "LOW RISK" */
  badgeLabel?: string;
  confidence?: number; // 0..1
  summary: string;
  imageUrl?: string;
  videoUrl?: string;
  clipDuration?: number; // seconds
  tags: string[];
  aiAssessment?: string;
  timeline?: EventTimelineStep[];
  recommendedActions?: RecommendedAction[];
  starred?: boolean;
  reviewed?: boolean;
  /** Where this event came from. Undefined = demo dataset. */
  source?: "demo" | "ring";
  /** Matan processing state (server-derived): pending → capturing → analyzing → done | failed. */
  analysis?: "pending" | "capturing" | "analyzing" | "done" | "failed";
  /** Set when the last analysis attempt failed (event itself is unaffected). */
  analysisError?: { code: string; at: string };
  /** Outcome of the notification step for this event's decision, when known. */
  notification?: { status: "pending" | "sent" | "failed" | "skipped"; reason?: string; sentAt?: string; provider?: string; code?: string };
  /** Real timestamps for the Matan processing timeline; never invented - fields are absent until the step actually happened. */
  processing?: { receivedAt: string; capturedAt?: string; analyzedAt?: string; notifiedAt?: string };
  /** Raw Ring event type (motion | ding | on_demand) for Ring-derived events. */
  ringEventType?: string;
  /** Matan AI intelligence (Nova analysis + deterministic decision) once analysis completed. */
  intelligence?: import("@/lib/matan/schema").MatanEventIntelligence;
}

export type DeviceKind = "camera" | "doorbell" | "lock" | "chime";
export type DeviceStatus = "online" | "offline";

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  model: string;
  location: string;
  status: DeviceStatus;
  battery?: number; // percent
  signal?: number; // percent
  previewUrl?: string;
  firmware?: string;
  lastEventAt?: string;
  isRing: boolean;
  settings: {
    motionAlerts: boolean;
    aiDetection: boolean;
    audio: boolean;
    notifications: boolean;
  };
}

export type AutomationCategory =
  | "security"
  | "deliveries"
  | "access"
  | "care"
  | "custom";

export interface Automation {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  trigger: string;
  condition?: string;
  action: string;
  enabled: boolean;
  icon: string; // lucide icon name
  tone: "primary" | "success" | "warning" | "danger" | "purple";
  imageUrl?: string;
  exampleText?: string;
  runsThisWeek: number;
  lastRunAt?: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  automationName: string;
  timestamp: string;
  message: string;
  status: "success" | "skipped" | "error";
}

export interface SuggestedAutomation {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  trigger: string;
  action: string;
  icon: string;
  tone: Automation["tone"];
}

export type SecurityModeId =
  | "home"
  | "away"
  | "night"
  | "care"
  | "business"
  | "custom";

export interface SecurityModeSetting {
  key: string;
  label: string;
  hint: string;
  enabled: boolean;
  icon: string;
}

export interface SecurityMode {
  id: SecurityModeId;
  name: string;
  tagline: string;
  description: string;
  howItWorks: string;
  icon: string;
  tone: "primary" | "success" | "warning" | "purple" | "cyan" | "danger";
  settings: SecurityModeSetting[];
  alertLevel: "Normal" | "Elevated" | "Strict";
}

export interface ModeSchedule {
  id: string;
  modeId: SecurityModeId;
  label: string;
  window: string;
  enabled: boolean;
}

export interface ModeActivity {
  id: string;
  modeId: SecurityModeId;
  label: string;
  timestamp: string;
  source: "By Schedule" | "Manually" | "By Matan AI";
}

export type FamilyPresence = "home" | "away" | "unknown" | "attention";

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  presence: FamilyPresence;
  lastSeenAt: string;
  lastSeenLocation: string;
  isAdmin?: boolean;
}

export interface FamilyActivity {
  id: string;
  memberId: string;
  label: string;
  location: string;
  timestamp: string;
  icon: string;
  tone: "success" | "primary" | "purple" | "warning";
}

export interface CareInsight {
  id: string;
  title: string;
  description: string;
  tone: "success" | "purple" | "warning" | "primary";
  icon: string;
}

export interface CareFeature {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: string;
  tone: "warning" | "purple" | "primary" | "danger";
}

export interface BusinessLocation {
  id: string;
  slug: string;
  name: string;
  city: string;
  cameras: number;
  status: DeviceStatus;
  imageUrl?: string;
  manager: string;
  openHours: string;
  eventsToday: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: "Owner" | "Manager" | "Staff" | "Viewer";
  avatarUrl?: string;
  locationIds: string[];
  lastActive: string;
  status: "active" | "invited";
}

export interface BusinessEvent {
  id: string;
  locationId: string;
  title: string;
  timestamp: string;
  type: EventType;
  priority: EventPriority;
}

export interface BusinessInsight {
  id: string;
  title: string;
  tone: "success" | "warning" | "danger" | "primary";
  icon: string;
}

export interface BusinessReport {
  id: string;
  name: string;
  period: string;
  createdAt: string;
  size: string;
  status: "ready" | "generating";
}

export interface BusinessIntegration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  icon: string;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  tone: "success" | "warning" | "primary" | "danger";
  icon: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  tone: "primary" | "success" | "warning" | "danger";
  href?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  firstName: string;
  email: string;
  role: string;
  location: string;
  avatarUrl?: string;
  plan: string;
  twoFactor: boolean;
}

export interface Weather {
  tempC: number;
  condition: string;
  icon: "sun" | "cloud-sun" | "cloud" | "rain";
  city: string;
}

/* ---- Aggregates ---------------------------------------------------------- */

export interface EventCounts {
  total: number;
  normal: number;
  attention: number;
  important: number;
  byType: Record<EventType, number>;
}

export interface DashboardData {
  user: UserProfile;
  weather: Weather;
  notifications: Notification[];
  unreadNotifications: number;
  todayCounts: EventCounts;
  todayVsYesterdayPct: number;
  latestEvents: RingEvent[];
  devices: Device[];
  activeModeId: SecurityModeId;
  activeModeName: string;
  quickQuestions: string[];
  featuredCameraId: string;
  /** Real Mode: number of Ring events on record (all history), for copy that must not count only the preview list. */
  historyCount?: number;
}

export interface DailyTrendPoint {
  day: string; // "Sep 4"
  date: string; // ISO date
  people: number;
  packages: number;
  vehicles: number;
  animals: number;
  others: number;
  total: number;
}

export interface CameraActivity {
  cameraId: string;
  name: string;
  count: number;
  pct: number;
}

export interface ActivityRow {
  key: string;
  label: string;
  count: number;
  icon: string;
  tone: string;
}

export interface HeatCell {
  day: number; // 0 = Mon
  hourBucket: number; // 0..5 (4h buckets)
  value: number; // 0..1
}

export type InsightRange = "today" | "7d" | "30d" | "custom";

export interface InsightsData {
  range: InsightRange;
  rangeLabel: string;
  counts: EventCounts;
  deltas: Record<string, number>;
  trends: DailyTrendPoint[];
  byCamera: CameraActivity[];
  activities: ActivityRow[];
  heatmap: HeatCell[];
  findings: { normalPct: number; attentionPct: number; importantPct: number };
  findingNote: string;
  summary: string;
  recommendations: Insight[];
}

export interface AssistantChip {
  label: string;
  value: string | number;
  icon: string;
  tone?: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  chips?: AssistantChip[];
  banner?: { tone: "success" | "warning" | "danger" | "primary"; title: string; subtitle?: string };
  highlights?: string[];
  relatedEventIds?: string[];
  suggestions?: string[];
}

export interface AssistantConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: AssistantMessage[];
}

export interface SettingsData {
  general: {
    appName: string;
    timeZone: string;
    dateFormat: string;
    startPage: string;
  };
  notifications: {
    securityAlerts: boolean;
    packageDeliveries: boolean;
    familyActivity: boolean;
    deviceStatus: boolean;
    marketingUpdates: boolean;
    quietHoursEnabled: boolean;
    quietHours: string;
    channels: { push: boolean; email: boolean; sms: boolean };
    /** Where Matan AI email alerts go (server-side recipient; SES Sandbox requires a verified address). */
    emailAddress?: string;
    /** Minimum decision priority that is emailed: "high" (default) · "medium" · "low" · "all" (every completed analysis, incl. normal). */
    alertLevel?: "high" | "medium" | "low" | "all";
  };
  privacy: {
    retentionDays: number;
    aiProcessing: "cloud" | "balanced" | "minimal";
    privacyZones: number;
    shareWithFamily: boolean;
    shareAnonymizedAnalytics: boolean;
  };
  ai: {
    sensitivity: "Low" | "Medium" | "High";
    peopleRecognition: boolean;
    knownFaces: number;
    smartAlerts: boolean;
    language: string;
    /** Real Mode: analyze new Ring events automatically. */
    autoAnalyze: "off" | "snapshot" | "video";
    /** Also auto-analyze on_demand live-view sessions (Playground simulations). */
    autoIncludeLiveView: boolean;
    /** Seconds of media before/after the event window sent to Nova. */
    mediaPadSeconds: 5 | 10;
  };
  appearance: {
    theme: "Dark" | "Light" | "Auto";
    accent: "blue" | "green" | "purple" | "amber" | "red";
    fontSize: "Small" | "Medium" | "Large";
  };
  region: {
    language: string;
    region: string;
    units: string;
  };
}

export interface ApiListMeta {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: ApiListMeta;
}

import type {
  BusinessEvent,
  BusinessInsight,
  BusinessIntegration,
  BusinessLocation,
  BusinessReport,
  TeamMember,
} from "@/lib/types";
import { images } from "./images";
import { at, isoDate, lastDaysLabel, MOCK_NOW } from "./clock";
import { formatDate } from "@/lib/utils/format";

export const businessLocations: BusinessLocation[] = [
  { id: "loc-main", slug: "main-office", name: "Main Office", city: "Dili, Timor-Leste", cameras: 8, status: "online", imageUrl: images.office, manager: "Sara Gomes", openHours: "08:00 - 18:00", eventsToday: 42 },
  { id: "loc-comoro", slug: "branch-comoro", name: "Branch - Comoro", city: "Dili, Timor-Leste", cameras: 4, status: "online", imageUrl: images.officeEntrance, manager: "Rui Martins", openHours: "08:30 - 17:30", eventsToday: 18 },
  { id: "loc-warehouse", slug: "warehouse-tibar", name: "Warehouse", city: "Tibar, Timor-Leste", cameras: 6, status: "online", imageUrl: images.warehouse, manager: "Tomás Silva", openHours: "07:00 - 19:00", eventsToday: 27 },
  { id: "loc-retail", slug: "retail-store", name: "Retail Store", city: "Dili, Timor-Leste", cameras: 4, status: "online", imageUrl: images.retail, manager: "Lia Pereira", openHours: "09:00 - 21:00", eventsToday: 36 },
  { id: "loc-remote", slug: "remote-site", name: "Remote Site", city: "Liquiçá, Timor-Leste", cameras: 2, status: "offline", imageUrl: images.remoteSite, manager: "João Costa", openHours: "24 hours", eventsToday: 3 },
];

export const teamMembers: TeamMember[] = [
  { id: "tm-1", name: "Ajito Nelson", role: "Owner", avatarUrl: images.avatarAjito, locationIds: ["loc-main", "loc-comoro", "loc-warehouse", "loc-retail", "loc-remote"], lastActive: at(0, 9, 20), status: "active" },
  { id: "tm-2", name: "Sara Gomes", role: "Manager", avatarUrl: images.avatarSara, locationIds: ["loc-main"], lastActive: at(0, 9, 5), status: "active" },
  { id: "tm-3", name: "Rui Martins", role: "Staff", avatarUrl: images.avatarRui, locationIds: ["loc-comoro"], lastActive: at(0, 8, 50), status: "active" },
  { id: "tm-4", name: "Lia Pereira", role: "Staff", avatarUrl: images.avatarLia, locationIds: ["loc-retail"], lastActive: at(0, 9, 1), status: "active" },
  { id: "tm-5", name: "Tomás Silva", role: "Manager", avatarUrl: images.avatarTomas, locationIds: ["loc-warehouse"], lastActive: at(0, 7, 45), status: "active" },
  { id: "tm-6", name: "Elsa Ximenes", role: "Staff", avatarUrl: images.avatarElsa, locationIds: ["loc-main"], lastActive: at(-1, 17, 30), status: "active" },
  { id: "tm-7", name: "João Costa", role: "Staff", avatarUrl: images.avatarJoao, locationIds: ["loc-remote"], lastActive: at(-2, 12, 0), status: "active" },
  { id: "tm-8", name: "Filomena Reis", role: "Viewer", avatarUrl: images.avatarFilo, locationIds: ["loc-retail"], lastActive: at(-1, 15, 10), status: "active" },
  { id: "tm-9", name: "Pedro Amaral", role: "Staff", avatarUrl: images.avatarPedro, locationIds: ["loc-warehouse"], lastActive: at(0, 6, 58), status: "active" },
  { id: "tm-10", name: "Nina Belo", role: "Viewer", avatarUrl: images.avatarNina, locationIds: ["loc-main", "loc-comoro"], lastActive: at(-3, 10, 20), status: "active" },
  { id: "tm-11", name: "Marco Tilman", role: "Manager", avatarUrl: images.avatarMarco, locationIds: ["loc-retail", "loc-comoro"], lastActive: at(-1, 19, 40), status: "active" },
  { id: "tm-12", name: "Bela Soares", role: "Staff", avatarUrl: images.avatarBela, locationIds: ["loc-main"], lastActive: at(-5, 9, 0), status: "invited" },
];

export const businessEvents: BusinessEvent[] = [
  { id: "bev-1", locationId: "loc-main", title: "Person detected at Main Office", timestamp: at(0, 9, 14), type: "person", priority: "normal" },
  { id: "bev-2", locationId: "loc-retail", title: "Delivery package at Retail Store", timestamp: at(0, 8, 47), type: "package", priority: "normal" },
  { id: "bev-3", locationId: "loc-warehouse", title: "Vehicle entered at Warehouse", timestamp: at(0, 7, 32), type: "vehicle", priority: "normal" },
  { id: "bev-4", locationId: "loc-remote", title: "Unusual activity at Remote Site", timestamp: at(-1, 21, 12), type: "unusual", priority: "important" },
  { id: "bev-5", locationId: "loc-comoro", title: "After-hours motion at Branch", timestamp: at(-1, 19, 48), type: "other", priority: "attention" },
  { id: "bev-6", locationId: "loc-main", title: "Team arrival - 6 people", timestamp: at(-1, 8, 15), type: "person", priority: "normal" },
];

export const businessInsights: BusinessInsight[] = [
  { id: "bi-1", title: "Foot traffic increased by 18% compared to last week.", tone: "success", icon: "TrendingUp" },
  { id: "bi-2", title: "Peak delivery time: 10 AM - 12 PM.", tone: "warning", icon: "Package" },
  { id: "bi-3", title: `Unusual activity detected at Warehouse (${formatDate(at(-2, 20, 14)).slice(0, 6)}, 8:14 PM).`, tone: "danger", icon: "TriangleAlert" },
  { id: "bi-4", title: "Consider adding cameras at the parking area.", tone: "warning", icon: "Lightbulb" },
];

export const businessTrend = Array.from({ length: 7 }, (_, i) => {
  const dayOffset = i - 6;
  const people = [24, 22, 31, 30, 41, 37, 44][i];
  const vehicles = [18, 16, 14, 17, 20, 27, 26][i];
  const packages = [11, 9, 10, 12, 8, 14, 15][i];
  const security = [2, 1, 3, 1, 4, 2, 1][i];
  return {
    date: isoDate(dayOffset),
    day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Dili" }).format(new Date(isoDate(dayOffset) + "T12:00:00+09:00")),
    people,
    vehicles,
    packages,
    security,
  };
});

export const businessReports: BusinessReport[] = [
  { id: "rep-1", name: "Weekly Security Summary", period: lastDaysLabel(7), createdAt: at(0, 6, 0), size: "1.2 MB", status: "ready" },
  { id: "rep-2", name: "Foot Traffic Analysis", period: "Last month", createdAt: at(-10, 8, 0), size: "3.4 MB", status: "ready" },
  { id: "rep-3", name: "Delivery Log", period: lastDaysLabel(10), createdAt: at(-1, 20, 0), size: "640 KB", status: "ready" },
  { id: "rep-4", name: "Incident Report - Remote Site", period: formatDate(at(-1, 12, 0)), createdAt: at(-1, 21, 30), size: "210 KB", status: "ready" },
];

export const businessIntegrations: BusinessIntegration[] = [
  { id: "int-ring", name: "Ring for Business", description: "Camera events and media (demo data in this preview).", connected: true, icon: "Video" },
  { id: "int-email", name: "Email Digest", description: "Daily and weekly summaries to your team.", connected: true, icon: "Mail" },
  { id: "int-slack", name: "Slack", description: "Post important alerts to a channel.", connected: false, icon: "MessageSquare" },
  { id: "int-sheets", name: "Google Sheets", description: "Export foot traffic and deliveries automatically.", connected: false, icon: "Table" },
  { id: "int-webhook", name: "Webhooks", description: "Send events to your own systems.", connected: true, icon: "Webhook" },
  { id: "int-sms", name: "SMS Alerts", description: "Text important alerts to on-call staff.", connected: false, icon: "Smartphone" },
];

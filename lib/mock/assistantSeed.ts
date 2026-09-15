import type { AssistantConversation } from "@/lib/types";
import { minutesAgo } from "./clock";
import { allEvents } from "./events";
import { countEvents, eventsInRange } from "./insights";

const today = countEvents(eventsInRange(allEvents, "today"));
const others = today.byType.other + today.byType.doorbell + today.byType.unusual;

/**
 * Seeded "Recent Chats". Each has its own message history so switching
 * conversations feels real.
 */
export const seedConversations: AssistantConversation[] = [
  {
    id: "chat-today",
    title: "What happened today?",
    updatedAt: minutesAgo(2),
    messages: [
      {
        id: "m1",
        role: "assistant",
        content:
          "Hello, Ajito! 👋\nI'm Matan AI, your intelligent home assistant. I can help you understand your Ring events, summarize activity, find important moments, and automate actions.",
        timestamp: minutesAgo(3),
      },
      { id: "m2", role: "user", content: "What happened today?", timestamp: minutesAgo(2) },
      {
        id: "m3",
        role: "assistant",
        content: `Here's what happened today (Fri, 11 Sep 2026). I analyzed ${today.total} events. Overall, everything looks normal.`,
        timestamp: minutesAgo(2),
        chips: [
          { label: "People", value: today.byType.person, icon: "Users", tone: "primary" },
          { label: "Packages", value: today.byType.package, icon: "Package", tone: "success" },
          { label: "Vehicles", value: today.byType.vehicle, icon: "Car", tone: "purple" },
          { label: today.byType.animal === 1 ? "Animal" : "Animals", value: today.byType.animal, icon: "PawPrint", tone: "warning" },
          { label: "Others", value: others, icon: "MessageSquare", tone: "neutral" },
        ],
        banner: { tone: "success", title: "Overall, everything looks normal.", subtitle: "One event from 2:17 AM is flagged for review." },
        highlights: [
          `${today.byType.package} package ${today.byType.package === 1 ? "delivery" : "deliveries"} at the front door (all collected).`,
          "Regular family movement between 8:15 AM - 9:00 AM.",
          "An unrecognised visitor paused at the side door at 7:15 AM.",
          "One unusual access pattern at 2:17 AM was flagged for review.",
        ],
        relatedEventIds: ["EVT-1042", "EVT-1041"],
        suggestions: ["Why did you send me an alert?", "Is my home safe now?", "Show unusual activity"],
      },
    ],
  },
  {
    id: "chat-unusual",
    title: "Any unusual activity?",
    updatedAt: minutesAgo(60),
    messages: [
      { id: "u1", role: "user", content: "Any unusual activity?", timestamp: minutesAgo(61) },
      {
        id: "u2",
        role: "assistant",
        content:
          "I found one unusual event today. At 2:17 AM the same person appeared three times at the Back Door and Side Door within 8 minutes. No doorbell press and no recognised face, so I flagged it as important and sent you an alert.",
        timestamp: minutesAgo(60),
        banner: { tone: "danger", title: "1 important event needs your review", subtitle: "Unusual access pattern - Back Entrance, 02:17 AM" },
        relatedEventIds: ["EVT-1041"],
        suggestions: ["Show me the clip", "Is my home safe now?", "Enable Night Mode lights"],
      },
    ],
  },
  {
    id: "chat-week",
    title: "Summarize this week",
    updatedAt: minutesAgo(180),
    messages: [
      { id: "w1", role: "user", content: "Summarize this week", timestamp: minutesAgo(181) },
      {
        id: "w2",
        role: "assistant",
        content:
          "This week was quieter than last week. Most activity was routine family movement in the mornings and evenings, with deliveries clustered around late morning.",
        timestamp: minutesAgo(180),
        highlights: ["Activity decreased 18% vs last week.", "7 deliveries, 2 left unattended for 2+ hours.", "1 unusual access pattern flagged."],
        suggestions: ["Create a weekly report", "How many deliveries this week?"],
      },
    ],
  },
  {
    id: "chat-deliveries",
    title: "Show delivery events",
    updatedAt: minutesAgo(300),
    messages: [
      { id: "d1", role: "user", content: "Show delivery events", timestamp: minutesAgo(301) },
      {
        id: "d2",
        role: "assistant",
        content: "Here are your most recent deliveries. The latest one arrived at the Front Door this morning at 09:24 AM and looks like a normal courier drop-off.",
        timestamp: minutesAgo(300),
        relatedEventIds: ["EVT-1042", "EVT-1035"],
        suggestions: ["Notify me if a package is left for 2 hours", "How many deliveries this week?"],
      },
    ],
  },
  {
    id: "chat-safe",
    title: "Is my home safe now?",
    updatedAt: minutesAgo(1400),
    messages: [
      { id: "s1", role: "user", content: "Is my home safe now?", timestamp: minutesAgo(1401) },
      {
        id: "s2",
        role: "assistant",
        content: "Yes. All 6 devices are online, Home Mode is active, and there is no ongoing activity that needs your attention.",
        timestamp: minutesAgo(1400),
        banner: { tone: "success", title: "Your home is protected", subtitle: "All systems active" },
      },
    ],
  },
  {
    id: "chat-back",
    title: "Back entrance activity",
    updatedAt: minutesAgo(1500),
    messages: [
      { id: "b1", role: "user", content: "Back entrance activity", timestamp: minutesAgo(1501) },
      {
        id: "b2",
        role: "assistant",
        content: "The Back Door camera recorded 5 events yesterday - mostly the cat and family movement in the backyard. Nothing unusual.",
        timestamp: minutesAgo(1500),
        relatedEventIds: ["EVT-1038"],
      },
    ],
  },
  {
    id: "chat-report",
    title: "Create a daily report",
    updatedAt: minutesAgo(2900),
    messages: [
      { id: "r1", role: "user", content: "Create a daily report", timestamp: minutesAgo(2901) },
      {
        id: "r2",
        role: "assistant",
        content: "Done - I generated a daily report for 9 Sep 2026 and emailed it to ajito@example.com.",
        timestamp: minutesAgo(2900),
        banner: { tone: "primary", title: "Report generated", subtitle: "Daily Summary - 9 Sep 2026" },
      },
    ],
  },
  {
    id: "chat-visitors",
    title: "How many visitors?",
    updatedAt: minutesAgo(3000),
    messages: [
      { id: "v1", role: "user", content: "How many visitors?", timestamp: minutesAgo(3001) },
      {
        id: "v2",
        role: "assistant",
        content: "You had 4 visitors in the last 7 days: 2 couriers, 1 recognised friend (greeted by Maria), and 1 unrecognised person at the Side Door.",
        timestamp: minutesAgo(3000),
      },
    ],
  },
];

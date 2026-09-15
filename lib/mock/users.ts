import type { UserProfile, Weather, Notification } from "@/lib/types";
import { images } from "./images";
import { minutesAgo } from "./clock";

export const user: UserProfile = {
  id: "usr-ajito",
  name: "Ajito Nelson",
  firstName: "Ajito",
  email: "ajito@example.com",
  role: "Administrator",
  location: "Dili, Timor-Leste",
  avatarUrl: images.avatarAjito,
  plan: "Pro Plan",
  twoFactor: true,
};

export const weather: Weather = {
  tempC: 27,
  condition: "Partly sunny",
  icon: "cloud-sun",
  city: "Dili, Timor-Leste",
};

export const notifications: Notification[] = [
  {
    id: "ntf-1",
    title: "Unusual access pattern",
    body: "Person appeared 3 times at 2 cameras within 8 minutes during quiet hours.",
    timestamp: minutesAgo(427),
    read: false,
    tone: "danger",
    href: "/events/EVT-1041",
  },
  {
    id: "ntf-2",
    title: "Delivery detected",
    body: "Likely package delivery at the Front Door. No action required.",
    timestamp: minutesAgo(0),
    read: false,
    tone: "success",
    href: "/events/EVT-1042",
  },
  {
    id: "ntf-3",
    title: "Unknown visitor",
    body: "A person stayed near the Side Door for 2 minutes yesterday evening.",
    timestamp: minutesAgo(849),
    read: false,
    tone: "warning",
    href: "/events/EVT-1040",
  },
  {
    id: "ntf-4",
    title: "Daily summary ready",
    body: "Yesterday: 21 events analyzed, everything looked normal.",
    timestamp: minutesAgo(804),
    read: true,
    tone: "primary",
    href: "/insights",
  },
  {
    id: "ntf-5",
    title: "Night Mode activated",
    body: "Switched to Night Mode by schedule at 09:00 PM.",
    timestamp: minutesAgo(744),
    read: true,
    tone: "primary",
    href: "/security-modes",
  },
];

export const quickQuestions = [
  "What happened while I was away?",
  "Summarize today's activity",
  "How many deliveries this week?",
  "Why did you send me an alert?",
  "Is my home safe now?",
  "Show unusual activity",
];

import type { ModeActivity, ModeSchedule, SecurityMode, SecurityModeSetting } from "@/lib/types";
import { at } from "./clock";

const s = (key: string, label: string, hint: string, icon: string, enabled = true): SecurityModeSetting => ({
  key,
  label,
  hint,
  icon,
  enabled,
});

export const securityModes: SecurityMode[] = [
  {
    id: "home",
    name: "Home Mode",
    tagline: "Normal monitoring for when you're at home.",
    description: "Your home, your comfort. Matan AI keeps an eye on what matters.",
    howItWorks:
      "In Home Mode, Matan AI uses smart filtering to reduce unnecessary alerts while still surfacing important events like visitors, packages, or unusual activity.",
    icon: "House",
    tone: "primary",
    alertLevel: "Normal",
    settings: [
      s("motion", "Motion Detection", "Enabled", "Activity"),
      s("person", "Person Alerts", "Smart filtering", "User"),
      s("package", "Package Alerts", "Enabled", "Package"),
      s("vehicle", "Vehicle Alerts", "Enabled", "Car"),
      s("animal", "Animal Alerts", "Enabled", "PawPrint"),
      s("doorbell", "Doorbell Press", "Always notify", "Bell"),
      s("ai", "AI Analysis", "Enabled", "Brain"),
      s("email", "Email Notifications", "Important only", "Mail"),
    ],
  },
  {
    id: "away",
    name: "Away Mode",
    tagline: "Maximum protection when you're away.",
    description: "Every camera watches closely while nobody is home.",
    howItWorks:
      "In Away Mode, every detection is analysed with higher sensitivity. Any person who is not a recognised family member triggers an immediate alert.",
    icon: "Plane",
    tone: "cyan",
    alertLevel: "Strict",
    settings: [
      s("motion", "Motion Detection", "High sensitivity", "Activity"),
      s("person", "Person Alerts", "All people", "User"),
      s("package", "Package Alerts", "Enabled", "Package"),
      s("vehicle", "Vehicle Alerts", "Unknown vehicles", "Car"),
      s("animal", "Animal Alerts", "Disabled", "PawPrint", false),
      s("doorbell", "Doorbell Press", "Quick reply", "Bell"),
      s("ai", "AI Analysis", "Enabled", "Brain"),
      s("email", "Email Notifications", "All alerts", "Mail"),
    ],
  },
  {
    id: "night",
    name: "Night Mode",
    tagline: "Reduced notifications with enhanced night monitoring.",
    description: "Sleep well. Matan AI stays awake for you.",
    howItWorks:
      "In Night Mode, routine motion is muted but any person near an entrance during quiet hours is treated as important and reviewed immediately.",
    icon: "Moon",
    tone: "purple",
    alertLevel: "Elevated",
    settings: [
      s("motion", "Motion Detection", "Entrances only", "Activity"),
      s("person", "Person Alerts", "Immediate", "User"),
      s("package", "Package Alerts", "Disabled", "Package", false),
      s("vehicle", "Vehicle Alerts", "Stopped vehicles", "Car"),
      s("animal", "Animal Alerts", "Disabled", "PawPrint", false),
      s("doorbell", "Doorbell Press", "Always notify", "Bell"),
      s("ai", "AI Analysis", "Enabled", "Brain"),
      s("email", "Email Notifications", "Important only", "Mail"),
    ],
  },
  {
    id: "care",
    name: "Care Mode",
    tagline: "Monitor and care for family members, elderly or loved ones.",
    description: "Gentle monitoring that keeps loved ones safe.",
    howItWorks:
      "Care Mode focuses on routine: arrivals, departures and expected movement. Matan AI raises a calm check-in if an expected routine is missed.",
    icon: "Heart",
    tone: "danger",
    alertLevel: "Normal",
    settings: [
      s("motion", "Motion Detection", "Indoor routine", "Activity"),
      s("person", "Person Alerts", "Family members", "User"),
      s("package", "Package Alerts", "Enabled", "Package"),
      s("vehicle", "Vehicle Alerts", "Disabled", "Car", false),
      s("animal", "Animal Alerts", "Disabled", "PawPrint", false),
      s("doorbell", "Doorbell Press", "Always notify", "Bell"),
      s("ai", "AI Analysis", "Routine tracking", "Brain"),
      s("email", "Email Notifications", "Daily check-in", "Mail"),
    ],
  },
  {
    id: "business",
    name: "Business Mode",
    tagline: "Advanced monitoring for offices, shops or business premises.",
    description: "Operational security for your business hours and after hours.",
    howItWorks:
      "Business Mode applies opening-hours rules. During hours, Matan AI counts foot traffic; after hours, any presence becomes an important alert.",
    icon: "Store",
    tone: "success",
    alertLevel: "Elevated",
    settings: [
      s("motion", "Motion Detection", "After hours", "Activity"),
      s("person", "Person Alerts", "After hours", "User"),
      s("package", "Package Alerts", "Enabled", "Package"),
      s("vehicle", "Vehicle Alerts", "Loading bay", "Car"),
      s("animal", "Animal Alerts", "Disabled", "PawPrint", false),
      s("doorbell", "Doorbell Press", "Reception", "Bell"),
      s("ai", "AI Analysis", "Foot traffic", "Brain"),
      s("email", "Email Notifications", "Team digest", "Mail"),
    ],
  },
  {
    id: "custom",
    name: "Custom Mode",
    tagline: "Create your own rules and settings.",
    description: "Fine-tune every camera and alert to your liking.",
    howItWorks:
      "Custom Mode starts from Home Mode settings and lets you decide exactly which detections matter and how you want to be notified.",
    icon: "Settings",
    tone: "warning",
    alertLevel: "Normal",
    settings: [
      s("motion", "Motion Detection", "Custom", "Activity"),
      s("person", "Person Alerts", "Custom", "User"),
      s("package", "Package Alerts", "Custom", "Package"),
      s("vehicle", "Vehicle Alerts", "Custom", "Car", false),
      s("animal", "Animal Alerts", "Custom", "PawPrint", false),
      s("doorbell", "Doorbell Press", "Custom", "Bell"),
      s("ai", "AI Analysis", "Enabled", "Brain"),
      s("email", "Email Notifications", "Custom", "Mail", false),
    ],
  },
];

export const modeSchedules: ModeSchedule[] = [
  { id: "sch-home", modeId: "home", label: "Home Mode", window: "06:00 AM - 09:00 PM", enabled: true },
  { id: "sch-night", modeId: "night", label: "Night Mode", window: "09:00 PM - 06:00 AM", enabled: true },
  { id: "sch-away", modeId: "away", label: "Away Mode", window: "When everyone is away", enabled: true },
  { id: "sch-custom", modeId: "custom", label: "Custom Schedule", window: "Set specific days and times", enabled: false },
];

export const modeActivity: ModeActivity[] = [
  { id: "act-1", modeId: "home", label: "Switched to Home Mode", timestamp: at(0, 6, 12), source: "By Schedule" },
  { id: "act-2", modeId: "night", label: "Switched to Night Mode", timestamp: at(-1, 21, 0), source: "By Schedule" },
  { id: "act-3", modeId: "home", label: "Switched to Home Mode", timestamp: at(-1, 6, 4), source: "By Schedule" },
  { id: "act-4", modeId: "away", label: "Switched to Away Mode", timestamp: at(-3, 7, 30), source: "Manually" },
];

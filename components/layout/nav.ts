import {
  House,
  Video,
  ListOrdered,
  BarChart3,
  MessageSquare,
  Zap,
  ShieldCheck,
  Cctv,
  Heart,
  Building2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "events";
}

export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/live", label: "Live View", icon: Video },
  { href: "/events", label: "Events", icon: ListOrdered, badgeKey: "events" },
  { href: "/insights", label: "AI Insights", icon: BarChart3 },
  { href: "/assistant", label: "AI Assistant", icon: MessageSquare },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/security-modes", label: "Security Modes", icon: ShieldCheck },
  { href: "/devices", label: "Devices", icon: Cctv },
  { href: "/care", label: "Care & Family", icon: Heart },
  { href: "/business", label: "Business", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

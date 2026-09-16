"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Toggle } from "@/components/ui/Toggle";
import { useTheme } from "@/components/experience/theme-provider";
import { SourceBadge } from "@/components/experience/source-badge";
import { useExperience } from "@/components/experience/experience-provider";
import { useAppData } from "./AppDataProvider";
import { navItems, isActivePath } from "./nav";
import { TimorIdentityCard } from "./TimorIdentity";

export function BrandMark({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <Image src="/brand/matan-ai-logo.png" alt="Matan AI" width={size} height={size} priority className={cn("drop-shadow-[0_8px_24px_rgba(18,168,255,0.35)]", className)} />
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data } = useAppData();
  const { resolved, setTheme } = useTheme();
  const { mode, ring } = useExperience();
  const eventsBadge = data ? data.todayCounts.attention + data.todayCounts.important : 0;
  const source = (mode ?? "demo") === "demo" ? "demo" : ring.state === "connected" ? "ring" : ring.state === "expiring" ? "ring-expiring" : "ring-expired";

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex flex-col items-center px-4 pt-6 pb-5 text-center rounded-2xl mx-2 mt-2 hover:bg-surface-2/40 transition-colors">
        <BrandMark size={92} />
        <span className="mt-2 text-[22px] font-extrabold tracking-[0.06em] text-text leading-none">MATAN AI</span>
        <span className="mt-1.5 text-[12.5px] text-text-3">Your intelligent eye at home.</span>
        <SourceBadge source={source} size="xs" short className="mt-2.5" />
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-11 items-center gap-3 rounded-[13px] px-3.5 text-[15px] font-medium transition-[background-color,color,box-shadow] duration-150",
                    active
                      ? "bg-gradient-to-r from-primary to-primary-2 text-white shadow-[0_8px_24px_rgba(18,168,255,0.35)]"
                      : "text-text-2 hover:bg-surface-2/80 hover:text-text",
                  )}
                >
                  <Icon className={cn("size-5 shrink-0", active ? "text-white" : "text-text-3 group-hover:text-primary transition-colors")} aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badgeKey === "events" && eventsBadge > 0 && (
                    <span
                      className={cn(
                        "inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                        active ? "bg-white text-primary" : "bg-danger text-white shadow-[0_4px_12px_rgba(255,77,94,0.4)]",
                      )}
                      aria-label={`${eventsBadge} events need attention`}
                    >
                      {eventsBadge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 pb-4 pt-2 space-y-3">
        <TimorIdentityCard />
        <div className="flex items-center justify-between rounded-2xl px-3 py-2">
          <span className="flex items-center gap-2.5 text-sm text-text-2">
            {resolved === "dark" ? <Moon className="size-4 text-text-3" aria-hidden /> : <Sun className="size-4 text-warning" aria-hidden />}
            {resolved === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
          <Toggle checked={resolved === "dark"} label="Dark mode" size="sm" onChange={(v) => setTheme(v ? "dark" : "light")} />
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface/80 backdrop-blur-xl lg:flex" aria-label="Sidebar">
      <SidebarContent />
    </aside>
  );
}

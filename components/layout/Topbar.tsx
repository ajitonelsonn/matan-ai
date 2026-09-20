"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, CloudSun, Sun, Cloud, CloudRain, User, Settings, Building2, LifeBuoy, LogOut, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SearchInput } from "@/components/ui/SearchInput";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useClock } from "@/hooks/useClock";
import { timeAgo } from "@/lib/utils/format";
import { toneStyles } from "@/lib/utils/tones";
import { useAppData } from "./AppDataProvider";
import { RefreshIndicator } from "./RefreshIndicator";
import { ExperienceModeSwitch } from "@/components/experience/experience-mode-switch";
import { ExperienceBanner } from "@/components/experience/experience-banner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthLoadingScreen } from "@/components/auth/AuthGuard";
import { firstNameOf } from "@/lib/auth/user";

const weatherIcons = { sun: Sun, "cloud-sun": CloudSun, cloud: Cloud, rain: CloudRain };

/**
 * Weather: real only in Demo Mode's sample dataset. There is no weather integration yet,
 * so Real Mode shows an honest "future integration" chip instead of demo numbers.
 */
export function WeatherChip({ className }: { className?: string }) {
  const { data, mode } = useAppData();
  if (!data) return <Skeleton className={cn("h-10 w-32", className)} />;
  if (mode === "ring") {
    return (
      <div className={cn("flex items-center gap-2.5 opacity-80", className)} title="Local weather is a future integration - not part of the Ring API and not connected yet." aria-label="Weather: future integration">
        <CloudSun className="size-6 text-text-3" aria-hidden />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-text-2">Weather</div>
          <div className="text-[11px] text-text-3">Future integration</div>
        </div>
      </div>
    );
  }
  const Icon = weatherIcons[data.weather.icon];
  return (
    <div className={cn("flex items-center gap-2.5", className)} title={`${data.weather.condition} · demo data`}>
      <Icon className="size-6 text-warning" aria-hidden />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-text">{data.weather.tempC}°C</div>
        <div className="text-[11px] text-text-3">{data.weather.city}</div>
      </div>
    </div>
  );
}

export function ClockChip({ className }: { className?: string }) {
  const { time, date } = useClock();
  return (
    <div className={cn("leading-tight text-right", className)} aria-live="off">
      <div className="text-[13px] font-medium text-text-2 tabular-nums min-h-4">{date}</div>
      <div className="text-[15px] font-semibold text-text tabular-nums min-h-5">{time}</div>
    </div>
  );
}

export function NotificationsButton() {
  const { data, mode, markAllRead, markRead } = useAppData();
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const router = useRouter();
  const unread = data?.unreadNotifications ?? 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface-2/80 text-text-2 transition-[background-color,border-color,color] hover:border-border-strong hover:bg-surface-3 hover:text-text",
          open && "border-primary/50 text-primary",
        )}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-bg">
            {unread}
          </span>
        )}
      </button>
      <PopoverPanel open={open} align="end" width="22rem" className="p-0 max-w-[calc(100vw-2rem)]" role="dialog" aria-label="Notifications">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text">Notifications</h3>
          <Button variant="ghost" size="xs" leftIcon={<CheckCheck className="size-3.5" />} onClick={() => void markAllRead()} disabled={!unread}>
            Mark all read
          </Button>
        </div>
        <ul className="max-h-[22rem] overflow-y-auto p-1.5">
          {data && data.notifications.length === 0 && (
            <li className="px-3 py-6 text-center text-[13px] text-text-3">
              {mode === "ring" ? "No Matan notifications yet. Notify / Escalate decisions on your Ring events will appear here." : "You're all caught up."}
            </li>
          )}
          {data?.notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  void markRead(n.id);
                  setOpen(false);
                  if (n.href) router.push(n.href);
                }}
                className={cn("flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-primary/10", !n.read && "bg-primary/6")}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneStyles[n.tone].dot, n.read && "opacity-40")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm leading-snug", n.read ? "text-text-2" : "font-semibold text-text")}>{n.title}</span>
                  <span className="mt-0.5 block text-xs text-text-3 leading-relaxed line-clamp-2">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-text-3">{timeAgo(n.timestamp, mode === "ring" ? new Date().toISOString() : undefined)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-4 py-2.5 text-center">
          <Link href="/events" onClick={() => setOpen(false)} className="text-xs font-semibold text-primary hover:text-primary-2">
            View all events →
          </Link>
        </div>
      </PopoverPanel>
    </div>
  );
}

export function ProfileMenu({ compact }: { compact?: boolean }) {
  const { data } = useAppData();
  const { user, signOut } = useAuth();
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const toast = useToast();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const displayName = user?.name || user?.email || data?.user.name || "";
  const firstName = user ? firstNameOf(user) : data?.user.firstName ?? "";
  const avatar = user?.pictureUrl ?? (user ? undefined : data?.user.avatarUrl);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleSignOut = async () => {
    setOpen(false);
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login?notice=signed-out");
    } catch {
      setSigningOut(false);
      toast.error("Couldn't sign out", "Please try again.");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      {signingOut && <AuthLoadingScreen label="Signing you out…" />}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-2/80"
      >
        {displayName ? <Avatar name={displayName} src={avatar} size="md" ring /> : <Skeleton className="size-10 rounded-full" />}
        {!compact && (
          <>
            <span className="text-[15px] font-medium text-text">{firstName ? `Hello, ${firstName}` : ""}</span>
            <ChevronDown className={cn("size-4 text-text-3 transition-transform", open && "rotate-180")} aria-hidden />
          </>
        )}
      </button>
      <PopoverPanel open={open} align="end" width="16rem" role="menu">
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-text">{displayName}</p>
          <p className="text-xs text-text-3">{user?.email ?? data?.user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="primary" size="xs">
              {data?.user.role ?? "Member"}
            </Badge>
            {user && (
              <Badge tone={user.provider === "google" ? "success" : "neutral"} size="xs">
                {user.provider === "google" ? "Google" : "Email"}
              </Badge>
            )}
          </div>
        </div>
        <div className="my-1 h-px bg-border" />
        {[
          { label: "My account", icon: User, href: "/settings?tab=account" },
          { label: "Settings", icon: Settings, href: "/settings" },
          { label: "Business workspace", icon: Building2, href: "/business" },
          { label: "Help & support", icon: LifeBuoy, href: "/settings?tab=about" },
        ].map((item) => (
          <button key={item.label} role="menuitem" type="button" onClick={() => go(item.href)} className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm text-text-2 transition-colors hover:bg-primary/14 hover:text-text">
            <item.icon className="size-4 text-primary" aria-hidden />
            {item.label}
          </button>
        ))}
        <div className="my-1 h-px bg-border" />
        <button role="menuitem" type="button" onClick={handleSignOut} className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm text-text-2 transition-colors hover:bg-danger/12 hover:text-danger">
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </PopoverPanel>
    </div>
  );
}

export interface TopbarProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** Extra controls rendered between the search and the status cluster */
  actions?: React.ReactNode;
  /** Optional status pill (e.g. "Home is protected") */
  status?: React.ReactNode;
  showClock?: boolean;
  className?: string;
  /** Source banner under the header: compact (default), full (Home) or none. */
  banner?: "compact" | "full" | "none";
}

/**
 * Shared page header: title/subtitle on the left, the standard control cluster
 * (search · weather · clock · notifications · profile) on the right.
 */
export function Topbar({ title, subtitle, search, actions, status, showClock = true, className, banner = "compact" }: TopbarProps) {
  return (
    <>
    <header className={cn("mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between", className)}>
      <div className="min-w-0 xl:flex-1 xl:min-w-[340px]">
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-text leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] sm:text-[16px] text-text-2 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3 xl:max-w-[72%] xl:justify-end">
        {search && <SearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} containerClassName="w-full sm:w-64 xl:w-60 2xl:w-72" aria-label={search.placeholder ?? "Search"} />}
        {actions}
        {status}
        <div className={cn("hidden items-center gap-4 border-l border-border pl-4", actions ? "2xl:flex" : "md:flex")}>
          {showClock && <ClockChip className="hidden 2xl:block" />}
          <WeatherChip />
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <ExperienceModeSwitch className="mr-1" />
          <RefreshIndicator />
          <NotificationsButton />
          <ProfileMenu />
        </div>
      </div>
    </header>
    {banner !== "none" && <ExperienceBanner compact={banner === "compact"} className="mb-5" />}
    </>
  );
}

"use client";

import * as React from "react";
import { dashboardApi } from "@/lib/api/dashboard";
import type { DashboardData } from "@/lib/types";
import { useAppMode } from "@/components/experience/experience-provider";
import { getDataSource } from "@/lib/data/get-data-source";
import type { RingSessionInfo } from "@/lib/ring/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { firstNameOf, type MatanUser } from "@/lib/auth/user";

interface AppDataContextValue {
  data: (DashboardData & { stale?: boolean; ringSession?: RingSessionInfo | null }) | null;
  mode: "demo" | "ring";
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const AppDataContext = React.createContext<AppDataContextValue | null>(null);

/**
 * Shell-level data (user, weather, notifications, active mode, device summary).
 * Pages call `refresh()` after mutations so badges and status stay consistent.
 */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const mode = useAppMode();
  const { user: authUser } = useAuth();
  const [data, setData] = React.useState<AppDataContextValue["data"]>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const seq = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const id = ++seq.current;
    try {
      const d = await getDataSource(mode).getDashboard();
      if (id !== seq.current) return;
      setData(withSignedInUser(d, authUser));
      setError(null);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [mode, authUser]);

  // (Re)load whenever the experience mode changes - the two sources never mix.
  React.useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Real Mode: poll so new Ring events and automatic analyses show up on Home without a click.
  React.useEffect(() => {
    if (mode !== "ring") return;
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [mode, refresh]);

  const markAllRead = React.useCallback(async () => {
    setData((d) => (d ? { ...d, unreadNotifications: 0, notifications: d.notifications.map((n) => ({ ...n, read: true })) } : d));
    await dashboardApi.markAllRead();
  }, []);

  const markRead = React.useCallback(async (id: string) => {
    setData((d) => {
      if (!d) return d;
      const notifications = d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return { ...d, notifications, unreadNotifications: notifications.filter((n) => !n.read).length };
    });
    await dashboardApi.markRead(id);
  }, []);

  const value = React.useMemo(() => ({ data, mode, loading, error, refresh, markAllRead, markRead }), [data, mode, loading, error, refresh, markAllRead, markRead]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = React.useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider>");
  return ctx;
}

/** The shell shows the real Cognito identity; the mock profile only supplies role/plan/location. */
function withSignedInUser<T extends DashboardData>(d: T, u: MatanUser | null): T {
  if (!u) return d;
  const name = u.name || u.email;
  return { ...d, user: { ...d.user, id: u.id, name, firstName: firstNameOf(u), email: u.email, avatarUrl: u.pictureUrl } };
}

"use client";

import * as React from "react";
import { dashboardApi } from "@/lib/api/dashboard";
import type { DashboardData } from "@/lib/types";

interface AppDataContextValue {
  data: DashboardData | null;
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
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const d = await dashboardApi.get();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const value = React.useMemo(() => ({ data, loading, error, refresh, markAllRead, markRead }), [data, loading, error, refresh, markAllRead, markRead]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = React.useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider>");
  return ctx;
}

"use client";

import * as React from "react";
import { dashboardApi } from "@/lib/api/dashboard";
import { request } from "@/lib/api/client";
import type { DashboardData } from "@/lib/types";
import { useAppMode } from "@/components/experience/experience-provider";
import { getDataSource, markClientAnalyzing } from "@/lib/data/get-data-source";
import { refreshBus } from "@/lib/loading/store";
import type { RingSessionInfo } from "@/lib/ring/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { firstNameOf, type MatanUser } from "@/lib/auth/user";
import { isProcessing } from "@/lib/matan/event-state";

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

  // Real Mode: the server only records which new events need auto-analysis; this browser drives
  // the work by calling /api/matan/auto/step one event at a time (each step is one awaited request,
  // so it also works on stateless hosting where nothing runs after a response). While a step is in
  // flight the event is shown as "analyzing" via the client overlay in the ring data source.
  const stepping = React.useRef(false);
  const pending = mode === "ring" ? data?.autoPending ?? 0 : 0;
  React.useEffect(() => {
    if (mode !== "ring" || pending <= 0 || stepping.current) return;
    stepping.current = true;
    let cancelled = false;
    (async () => {
      try {
        let next: string | undefined = data?.autoPendingIds?.[0];
        for (let i = 0; i < 20 && !cancelled; i++) {
          if (next) markClientAnalyzing(next, true);
          const r = await request<{ eventId: string | null; ok: boolean; code?: string; pending: number; nextId?: string | null }>("/api/matan/auto/step", { method: "POST", json: {} }).catch(() => null);
          if (next) markClientAnalyzing(next, false);
          if (r?.eventId) markClientAnalyzing(r.eventId, false);
          refreshBus.emit();
          if (!r || r.pending <= 0) break;
          next = r.nextId ?? undefined;
        }
      } finally {
        stepping.current = false;
        if (!cancelled) void refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pending, refresh]);

  // Poll so new Ring events and automatic analyses show up on Home without a click.
  // 6 s while Matan is capturing/analyzing something, 30 s otherwise (same cadence as the Events page).
  const busy = mode === "ring" && (Boolean(data?.latestEvents.some((e) => isProcessing(e))) || pending > 0);
  React.useEffect(() => {
    if (mode !== "ring") return;
    const id = setInterval(() => void refresh(), busy ? 6_000 : 30_000);
    return () => clearInterval(id);
  }, [mode, refresh, busy]);

  const markAllRead = React.useCallback(async () => {
    setData((d) => (d ? { ...d, unreadNotifications: 0, notifications: d.notifications.map((n) => ({ ...n, read: true })) } : d));
    if (mode === "ring") await request("/api/ring/notifications", { method: "POST", json: { all: true } });
    else await dashboardApi.markAllRead();
  }, [mode]);

  const markRead = React.useCallback(async (id: string) => {
    setData((d) => {
      if (!d) return d;
      const notifications = d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return { ...d, notifications, unreadNotifications: notifications.filter((n) => !n.read).length };
    });
    if (mode === "ring") await request("/api/ring/notifications", { method: "POST", json: { id } });
    else await dashboardApi.markRead(id);
  }, [mode]);

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

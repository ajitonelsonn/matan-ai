"use client";

import * as React from "react";
import { ringApi } from "@/lib/api/ring";
import { refreshBus } from "@/lib/loading/store";
import type { ConnectedRingDevice, RingSessionInfo } from "@/lib/ring/types";
import { useRingCountdown } from "@/components/devices/use-ring-session";

export type AppMode = "demo" | "ring";
export type RingConnectionState = "not_connected" | "connecting" | "connected" | "expiring" | "expired" | "invalid";

export const MODE_STORAGE_KEY = "matan.experience.mode";
/** Session-scoped flag: the chooser is shown once per sign-in, not on every refresh. Cleared on sign-out. */
export const MODE_CHOSEN_SESSION_KEY = "matan.experience.chosen";

export function clearModeChoiceForSession() {
  try {
    sessionStorage.removeItem(MODE_CHOSEN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function chosenThisSession() {
  try {
    return sessionStorage.getItem(MODE_CHOSEN_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

interface ExperienceContextValue {
  /** null = the user has not chosen yet (first run). */
  mode: AppMode | null;
  chosen: boolean;
  /** Switch mode. Entering Real Mode with no valid Ring session opens the Connect Ring flow. */
  switchMode: (mode: AppMode) => void;
  /** Direct set (used by the first-run chooser and after a successful Ring connection). */
  setMode: (mode: AppMode) => void;
  ring: {
    state: RingConnectionState;
    session: RingSessionInfo | null;
    connected: ConnectedRingDevice[];
    loading: boolean;
    countdownLabel: string;
    refresh: () => Promise<void>;
    setData: (patch: { connected?: ConnectedRingDevice[]; session?: RingSessionInfo | null }) => void;
  };
  /** Open the Add/Connect Ring modal (from anywhere). */
  openConnect: (opts?: { thenMode?: AppMode }) => void;
  connectOpen: boolean;
  closeConnect: () => void;
  connectThenMode: AppMode | null;
  transition: { active: boolean; target: AppMode | null };
  announce: (message: string) => void;
}

const ExperienceContext = React.createContext<ExperienceContextValue | null>(null);

function readStoredMode(): AppMode | null {
  try {
    const v = localStorage.getItem(MODE_STORAGE_KEY);
    return v === "demo" || v === "ring" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Product-level Demo/Real mode state. Independent from the Matan account and
 * from the Ring Playground session: `{ mode: "ring", ring.state: "expired" }`
 * is a valid, fully usable state.
 */
export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<AppMode | null>(null);
  const [chosen, setChosen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [connected, setConnected] = React.useState<ConnectedRingDevice[]>([]);
  const [session, setSession] = React.useState<RingSessionInfo | null>(null);
  const [ringLoading, setRingLoading] = React.useState(true);
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [connectThenMode, setConnectThenMode] = React.useState<AppMode | null>(null);
  const [transition, setTransition] = React.useState<{ active: boolean; target: AppMode | null }>({ active: false, target: null });
  const [liveMessage, setLiveMessage] = React.useState("");
  const cd = useRingCountdown(session);

  const refreshRing = React.useCallback(async () => {
    try {
      const res = await ringApi.devices();
      setConnected(res.connected);
      setSession(res.session);
    } catch {
      /* keep previous state */
    } finally {
      setRingLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // The stored mode is remembered as the default, but every new sign-in starts at the
    // Demo/Real chooser; a plain refresh within the same session skips it.
    const stored = readStoredMode();
    setModeState(stored);
    setChosen(Boolean(stored) && chosenThisSession());
    setHydrated(true);
    void refreshRing();
    const t = setInterval(() => void refreshRing(), 60_000);
    const unsub = refreshBus.subscribe(() => void refreshRing());
    return () => {
      clearInterval(t);
      unsub();
    };
  }, [refreshRing]);

  const announce = React.useCallback((message: string) => {
    setLiveMessage("");
    requestAnimationFrame(() => setLiveMessage(message));
  }, []);

  const persist = React.useCallback((m: AppMode) => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, m);
      sessionStorage.setItem(MODE_CHOSEN_SESSION_KEY, "1");
      document.cookie = `matan_mode=${m}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = React.useCallback(
    (m: AppMode) => {
      setModeState(m);
      setChosen(true);
      persist(m);
      announce(m === "demo" ? "Demo Mode active. All data is mock data." : "Real Mode active. Connected to the Ring Simulator.");
    },
    [persist, announce],
  );

  const ringState: RingConnectionState = ringLoading && !session ? "connecting" : !session ? "not_connected" : cd.status === "valid" ? "connected" : cd.status === "expiring" ? "expiring" : cd.status === "invalid" ? "invalid" : "expired";

  const runTransition = React.useCallback(
    (target: AppMode, done: () => void) => {
      setTransition({ active: true, target });
      window.setTimeout(() => {
        done();
        window.setTimeout(() => setTransition({ active: false, target: null }), 220);
      }, 900);
    },
    [],
  );

  const switchMode = React.useCallback(
    (target: AppMode) => {
      if (target === mode) return;
      if (target === "demo") {
        // Real -> Demo: immediate, Ring session is kept for the next Real session.
        runTransition("demo", () => setMode("demo"));
        return;
      }
      // Demo -> Real: only with a usable Ring session, otherwise connect first.
      if (ringState === "connected" || ringState === "expiring") {
        runTransition("ring", () => setMode("ring"));
      } else {
        setConnectThenMode("ring");
        setConnectOpen(true);
      }
    },
    [mode, ringState, runTransition, setMode],
  );

  const openConnect = React.useCallback((opts?: { thenMode?: AppMode }) => {
    setConnectThenMode(opts?.thenMode ?? null);
    setConnectOpen(true);
  }, []);

  const value = React.useMemo<ExperienceContextValue>(
    () => ({
      mode: hydrated ? mode : null,
      chosen: hydrated ? chosen : true, // don't flash the chooser before hydration
      switchMode,
      setMode,
      ring: {
        state: ringState,
        session,
        connected,
        loading: ringLoading,
        countdownLabel: cd.label,
        refresh: refreshRing,
        setData: (patch) => {
          if (patch.connected) setConnected(patch.connected);
          if (patch.session !== undefined) setSession(patch.session);
        },
      },
      openConnect,
      connectOpen,
      closeConnect: () => setConnectOpen(false),
      connectThenMode,
      transition,
      announce,
    }),
    [hydrated, mode, chosen, switchMode, setMode, ringState, session, connected, ringLoading, cd.label, refreshRing, openConnect, connectOpen, connectThenMode, transition, announce],
  );

  return (
    <ExperienceContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
    </ExperienceContext.Provider>
  );
}

export function useExperience() {
  const ctx = React.useContext(ExperienceContext);
  if (!ctx) throw new Error("useExperience must be used within <ExperienceProvider>");
  return ctx;
}

/** Convenience: the effective data mode ("demo" until a choice is made). */
export function useAppMode(): AppMode {
  return useExperience().mode ?? "demo";
}

"use client";

import * as React from "react";
import { Hub } from "aws-amplify/utils";
import { configureAuth, currentMatanUser, signOutEverywhere } from "@/lib/auth/client";
import { isAuthConfigured } from "@/lib/auth/config";
import type { AuthState, MatanUser } from "@/lib/auth/user";
import { clearModeChoiceForSession } from "@/components/experience/experience-provider";

interface AuthContextValue extends AuthState {
  configured: boolean;
  /** Re-read the Cognito session (after sign-in, verification, OAuth callback). */
  refresh: () => Promise<MatanUser | null>;
  signOut: () => Promise<void>;
  /** Last OAuth (Google) failure reported by Amplify, cleared on next refresh. */
  oauthError: string | null;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Owns the Cognito session for the whole app. Sits above ExperienceProvider so
 * that Demo/Real mode, Ring session and dashboard data are never loaded for an
 * unauthenticated visitor. Tokens never leave Amplify's storage - pages only see
 * the `MatanUser` model.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ loading: true, authenticated: false, user: null });
  const [oauthError, setOauthError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!configureAuth()) {
      setState({ loading: false, authenticated: false, user: null });
      return null;
    }
    const user = await currentMatanUser();
    setState({ loading: false, authenticated: Boolean(user), user });
    return user;
  }, []);

  const signOut = React.useCallback(async () => {
    try {
      await signOutEverywhere();
    } finally {
      clearModeChoiceForSession(); // next sign-in starts at the Demo/Real chooser again
      setState({ loading: false, authenticated: false, user: null });
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    if (!isAuthConfigured) return;
    // Amplify completes the OAuth code exchange itself; Hub tells us when it lands.
    const stop = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          setOauthError(null);
          void refresh();
          break;
        case "signInWithRedirect_failure":
          setOauthError("google");
          setState((s) => ({ ...s, loading: false }));
          break;
        case "signedOut":
          setState({ loading: false, authenticated: false, user: null });
          break;
        case "tokenRefresh_failure":
          void refresh();
          break;
      }
    });
    return stop;
  }, [refresh]);

  const value = React.useMemo<AuthContextValue>(() => ({ ...state, configured: isAuthConfigured, refresh, signOut, oauthError }), [state, refresh, signOut, oauthError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

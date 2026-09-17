"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { AuthLoadingScreen, safeNext } from "./AuthGuard";

const TIMEOUT_MS = 15_000;

/**
 * /auth/callback - Amplify exchanges the `code` in the URL for tokens on load.
 * We wait for the session, then send the user to the destination they started from.
 * Failures (Cognito `error=` params, timeouts) return to /login with a friendly notice.
 */
export function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const { loading, authenticated, oauthError, refresh } = useAuth();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (params.get("error")) {
      router.replace("/login?notice=oauth-failed");
      return;
    }
    if (authenticated) {
      let next = "/";
      try {
        next = safeNext(sessionStorage.getItem("matan.auth.next"));
        sessionStorage.removeItem("matan.auth.next");
      } catch {
        /* storage unavailable */
      }
      router.replace(next);
      return;
    }
    if (oauthError || (timedOut && !loading)) router.replace("/login?notice=oauth-failed");
  }, [authenticated, oauthError, timedOut, loading, params, router]);

  // Amplify's OAuth listener fires a Hub event; poll once more in case it landed before we subscribed.
  React.useEffect(() => {
    if (loading || authenticated) return;
    const t = setTimeout(() => void refresh(), 1500);
    return () => clearTimeout(t);
  }, [loading, authenticated, refresh]);

  return <AuthLoadingScreen label="Signing you in…" />;
}

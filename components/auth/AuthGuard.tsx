"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MatanLoader } from "@/components/matan/MatanLoader";
import { isPublicRoute } from "@/lib/auth/config";
import { useAuth } from "./AuthProvider";
import { AuthNotConfigured } from "./AuthNotConfigured";

/** Sanitise a `next` destination: same-origin paths only (no open redirects). */
export function safeNext(raw: string | null | undefined, fallback = "/") {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || /^\/\\/.test(raw)) return fallback;
  if (isPublicRoute(raw.split("?")[0])) return fallback;
  return raw;
}

/** Branded full-page wait state - used while Cognito reports the session, and while signing in/out. */
export function AuthLoadingScreen({ label = "Checking your Matan AI session…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-bg" role="status" aria-live="polite">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="relative flex flex-col items-center">
        <MatanLoader size="md" label={label} messages={[label]} />
      </div>
    </div>
  );
}

/**
 * Gate for the protected app. Public auth routes render straight through
 * (without the app shell); every other route waits for the session, then either
 * renders the app or redirects to /login preserving the destination.
 */
export function AuthGuard({ children, app }: { children: React.ReactNode; app: (children: React.ReactNode) => React.ReactNode }) {
  const pathname = usePathname();
  const { loading, authenticated, configured } = useAuth();
  const router = useRouter();
  const publicRoute = isPublicRoute(pathname);

  React.useEffect(() => {
    if (publicRoute || loading || authenticated || !configured) return;
    const next = `${pathname}${window.location.search}`;
    router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }, [publicRoute, loading, authenticated, configured, pathname, router]);

  if (publicRoute) return <>{children}</>;
  if (!configured) return <AuthNotConfigured />;
  if (loading || !authenticated) return <AuthLoadingScreen />;
  return <>{app(children)}</>;
}

/** On auth pages: bounce an already-signed-in user to their destination. */
export function useRedirectIfAuthenticated() {
  const { loading, authenticated } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  React.useEffect(() => {
    if (!loading && authenticated) router.replace(safeNext(params.get("next")));
  }, [loading, authenticated, router, params]);
  return loading || authenticated;
}

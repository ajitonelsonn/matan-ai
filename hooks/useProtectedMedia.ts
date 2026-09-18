"use client";

import * as React from "react";
import { fetchAuthSession } from "aws-amplify/auth";

const PROTECTED_PREFIX = "/api/matan/media/";
export const isProtectedMediaUrl = (src?: string | null): src is string => Boolean(src && src.startsWith(PROTECTED_PREFIX));

/**
 * <img>/<video> can't send an Authorization header, and /api/matan/media/:id now
 * requires the signed-in user's Cognito token. Fetch the bytes with the token and
 * expose a same-document object URL instead. Non-protected URLs pass through untouched.
 */
export function useProtectedMedia(src?: string | null): { url: string | undefined; error: boolean; loading: boolean } {
  const protectedSrc = isProtectedMediaUrl(src) ? src : null;
  const [url, setUrl] = React.useState<string | undefined>(protectedSrc ? undefined : src ?? undefined);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(Boolean(protectedSrc));

  React.useEffect(() => {
    if (!protectedSrc) {
      setUrl(src ?? undefined);
      setError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.accessToken?.toString();
        const res = await fetch(protectedSrc, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [protectedSrc, src]);

  return { url, error, loading };
}

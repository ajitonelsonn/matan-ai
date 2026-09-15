"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { refreshBus } from "@/lib/loading/store";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: (opts?: { silent?: boolean }) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Minimal data hook: loading/error/refetch with request de-duplication.
 * `deps` re-run the fetcher (e.g. filters change).
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: React.DependencyList = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);

  const run = useCallback(async (opts?: { silent?: boolean }) => {
    const id = ++seq.current;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id === seq.current) setData(result);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Global refresh (topbar button) re-runs every active data hook silently.
  useEffect(() => refreshBus.subscribe(() => void run({ silent: true })), [run]);

  return { data, loading, error, refetch: run, setData };
}

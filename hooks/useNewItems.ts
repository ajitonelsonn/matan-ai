"use client";

import * as React from "react";

/**
 * Track ids that appeared after the first render so the UI can highlight genuinely new
 * items (e.g. a Ring event that just landed via polling). An id stays "new" for `ttlMs`.
 */
export function useNewItems(ids: string[], ttlMs = 90_000): Set<string> {
  const seen = React.useRef<Set<string> | null>(null);
  const [fresh, setFresh] = React.useState<Map<string, number>>(new Map());
  const key = ids.join("|");

  React.useEffect(() => {
    if (!ids.length) return;
    if (seen.current === null) {
      seen.current = new Set(ids); // initial load is never "new"
      return;
    }
    const now = Date.now();
    const added = ids.filter((id) => !seen.current!.has(id));
    if (!added.length) return;
    added.forEach((id) => seen.current!.add(id));
    setFresh((prev) => {
      const next = new Map(prev);
      added.forEach((id) => next.set(id, now));
      return next;
    });
    const t = setTimeout(() => setFresh((prev) => new Map([...prev].filter(([, at]) => Date.now() - at < ttlMs))), ttlMs + 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ttlMs]);

  return React.useMemo(() => new Set(fresh.keys()), [fresh]);
}

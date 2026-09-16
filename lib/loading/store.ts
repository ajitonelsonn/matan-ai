"use client";

import { useSyncExternalStore } from "react";

/**
 * Global "requests in flight" counter + refresh bus.
 * - Every API call is tracked so the logo loader can show while data refreshes.
 * - `refreshBus` lets the topbar refresh button re-run every active data hook.
 */
let inflight = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function trackRequest<T>(p: Promise<T>): Promise<T> {
  inflight += 1;
  emit();
  const done = () => {
    inflight = Math.max(0, inflight - 1);
    emit();
  };
  p.then(done, done);
  return p;
}

export function useInflight() {
  return useSyncExternalStore(subscribe, () => inflight, () => 0);
}

const refreshListeners = new Set<() => void>();
export const refreshBus = {
  subscribe(l: () => void): () => void {
    refreshListeners.add(l);
    return () => {
      refreshListeners.delete(l);
    };
  },
  emit() {
    refreshListeners.forEach((l) => l());
  },
};

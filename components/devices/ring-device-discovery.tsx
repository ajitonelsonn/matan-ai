"use client";

import * as React from "react";
import { ShieldCheck, Radar, Lock, Clock, ServerCrash, SearchX, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MatanLoader } from "@/components/matan/MatanLoader";
import { RING_PLAYGROUND_URL } from "@/lib/ring/constants";
import type { RingErrorPayload } from "@/lib/ring/types";

/** Loading state while the backend talks to Ring (spec §32). */
export function RingDiscoveryLoading() {
  return (
    <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
      <MatanLoader size="md" wordmark={false} messages={["Connecting securely to Ring…", "Reading device information…", "Normalizing device details…"]} label="Discovering your Ring devices" />
      <p className="mt-4 text-[15px] font-semibold text-text">Discovering your Ring devices…</p>
      <ul className="mt-2 space-y-1 text-[13px] text-text-3">
        <li className="flex items-center justify-center gap-2">
          <Lock className="size-3.5 text-primary" /> Connecting securely to Ring
        </li>
        <li className="flex items-center justify-center gap-2">
          <Radar className="size-3.5 text-primary" /> Reading device information
        </li>
      </ul>
    </div>
  );
}

const iconFor: Record<string, React.ReactNode> = {
  RING_TOKEN_INVALID: <Lock />,
  RING_TOKEN_EXPIRED: <Clock />,
  RING_TOKEN_MISSING: <Lock />,
  RING_FORBIDDEN: <ShieldCheck />,
  RING_RATE_LIMITED: <Clock />,
  RING_UNAVAILABLE: <ServerCrash />,
  RING_NETWORK: <ServerCrash />,
  RING_NOT_FOUND: <SearchX />,
};

/** Normalized Ring error state (spec §23). */
export function RingDiscoveryError({ error, onRetry, onBack }: { error: RingErrorPayload; onRetry: () => void; onBack?: () => void }) {
  const tokenIssue = error.code === "RING_TOKEN_INVALID" || error.code === "RING_TOKEN_EXPIRED" || error.code === "RING_TOKEN_MISSING";
  return (
    <div className="card border-danger/30" role="alert" aria-live="assertive">
      <EmptyState
        compact
        icon={iconFor[error.code] ?? <ServerCrash />}
        title={error.title}
        description={error.retryAfterSeconds ? `${error.message} (Retry-After: ${error.retryAfterSeconds}s)` : error.message}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
            )}
            {tokenIssue && (
              <Button variant="secondary" href={RING_PLAYGROUND_URL} rightIcon={<ExternalLink className="size-4" />}>
                Open Ring Playground
              </Button>
            )}
            <Button onClick={onRetry} leftIcon={<RefreshCw className="size-4" />}>
              Try Again
            </Button>
          </div>
        }
      />
    </div>
  );
}

export function RingDiscoveryEmpty({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  return (
    <div className="card">
      <EmptyState
        compact
        icon={<SearchX />}
        title="No Ring devices found"
        description="The token is valid, but no accessible devices were returned. Check the Ring Playground session and try again."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button onClick={onRetry} leftIcon={<RefreshCw className="size-4" />}>
              Discover again
            </Button>
          </div>
        }
      />
    </div>
  );
}

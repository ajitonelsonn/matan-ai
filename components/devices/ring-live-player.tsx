"use client";

import * as React from "react";
import { Play, Square, RefreshCw, Radio, Lock, ExternalLink, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { SafeImage } from "@/components/ui/SafeImage";
import { MatanLoader } from "@/components/matan/MatanLoader";
import { RingBadge } from "@/components/matan/Brand";
import { useRingLiveStream } from "./use-ring-live-stream";
import { RING_PLAYGROUND_URL } from "@/lib/ring/constants";
import type { ConnectedRingDevice } from "@/lib/ring/types";
import { formatDuration } from "@/lib/utils/format";

function useElapsed(since: number | null) {
  const [s, setS] = React.useState(0);
  React.useEffect(() => {
    if (!since) return setS(0);
    const id = setInterval(() => setS(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(id);
  }, [since]);
  return s;
}

/**
 * Real Ring live view (WebRTC/WHEP) rendered inside the Live View hero frame.
 * Shows the device's Ring product image until the stream starts.
 */
export function RingLivePlayer({ device, sessionLive, onReconnect, className, autoStart }: { device: ConnectedRingDevice; sessionLive: boolean; onReconnect: () => void; className?: string; autoStart?: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const { state, error, start, stop, startedAt } = useRingLiveStream(device.id, videoRef);
  const [muted, setMuted] = React.useState(true);
  const elapsed = useElapsed(startedAt);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (autoStart && sessionLive && !started.current) {
      started.current = true;
      void start();
    }
  }, [autoStart, sessionLive, start]);

  const fullscreen = () => frameRef.current?.requestFullscreen?.().catch(() => undefined);

  return (
    <div ref={frameRef} className={cn("relative h-[17rem] w-full overflow-hidden rounded-hero border border-primary/40 glow bg-black sm:aspect-video sm:h-auto", className)}>
      {/* Poster (Ring product image) while not streaming */}
      {state !== "live" && (
        <div className="absolute inset-0">
          <SafeImage src={device.imageUrl} alt="" sizes="(max-width: 1024px) 100vw, 60vw" className="[&_img]:object-contain [&_img]:p-16 [&_img]:opacity-40" />
        </div>
      )}
      <video ref={videoRef} autoPlay playsInline muted={muted} className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-300", state === "live" ? "opacity-100" : "opacity-0")} aria-label={`${device.displayName} live stream`} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/55 via-transparent to-bg/70" aria-hidden />

      {/* Top chrome */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3.5 sm:p-4">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-bg/60 pl-3 pr-1.5 py-1 backdrop-blur-md">
          <StatusDot tone={state === "live" ? "success" : device.status === "online" ? "primary" : "danger"} pulse={state === "live"} />
          <span className="text-[15px] font-semibold text-text">{device.displayName}</span>
          {state === "live" ? (
            <Badge tone="danger" size="sm" className="ml-1 bg-bg/60 backdrop-blur-md border-danger/40">
              <span className="size-1.5 rounded-full bg-danger animate-pulse-dot" aria-hidden /> LIVE
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm" className="ml-1 bg-bg/60">
              {state === "connecting" ? "Connecting" : "Ring · Playground"}
            </Badge>
          )}
        </div>
        <RingBadge />
      </div>

      {/* Center states */}
      {state === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
          <MatanLoader size="md" wordmark={false} messages={["Creating WebRTC offer…", "Negotiating WHEP session with Ring…", "Waiting for video…"]} label="Connecting to Ring live view" />
        </div>
      )}
      {(state === "idle" || state === "ended") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto px-6 pb-16 pt-4 text-center sm:gap-3 sm:pb-20">
          {sessionLive ? (
            <>
              <button type="button" onClick={() => void start()} aria-label="Start live view" className="flex size-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-bg/55 text-text backdrop-blur transition-transform hover:scale-105 sm:size-20">
                <Play className="size-7 fill-current pl-1 sm:size-9" />
              </button>
              <p className="text-[15px] font-semibold text-text">{state === "ended" ? "Stream ended" : "Start Ring live view"}</p>
              <p className="hidden max-w-md text-[13px] text-text-2 sm:block">
                Real WebRTC stream from the Ring Playground device. Tip: trigger a <span className="text-text">Package</span>, <span className="text-text">Vehicle</span> or <span className="text-text">Motion</span> simulation in the Playground to see an event clip.
              </p>
            </>
          ) : (
            <>
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-danger/30 bg-danger/12 text-danger sm:size-14">
                <Lock className="size-5 sm:size-6" />
              </span>
              <p className="text-[15px] font-semibold text-text">Ring session expired</p>
              <p className="hidden max-w-sm text-[13px] text-text-2 sm:block">Generate a new Playground token to stream live video.</p>
              <Button onClick={onReconnect}>Reconnect Ring</Button>
            </>
          )}
        </div>
      )}
      {state === "error" && error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
          <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-danger/30 bg-danger/12 text-danger">
            <Radio className="size-6" />
          </span>
          <p className="text-[15px] font-semibold text-text">{error.title}</p>
          <p className="max-w-md text-[13px] text-text-2">{error.message}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="secondary" size="sm" href={RING_PLAYGROUND_URL} rightIcon={<ExternalLink className="size-3.5" />}>
              Open Playground
            </Button>
            <Button size="sm" leftIcon={<RefreshCw className="size-4" />} onClick={() => void start()}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Bottom chrome */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5 sm:p-4">
        <div className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-bg/60 pl-1.5 pr-4 text-[15px] font-semibold text-text backdrop-blur-md">
          {state === "live" ? (
            <button type="button" onClick={() => void stop()} className="inline-flex size-8 items-center justify-center rounded-full bg-surface-3 hover:bg-danger/30" aria-label="Stop live view">
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button type="button" onClick={() => void start()} disabled={state === "connecting" || !sessionLive} className="inline-flex size-8 items-center justify-center rounded-full bg-surface-3 hover:bg-primary/40 disabled:opacity-50" aria-label="Start live view">
              <Play className="size-4 fill-current" />
            </button>
          )}
          {state === "live" ? "Live" : state === "connecting" ? "Connecting…" : "Ready"}
          {state === "live" && <span className="tabular-nums text-text-2">{formatDuration(elapsed)}</span>}
        </div>
        <div className="flex items-center gap-2">
          <IconButton label={muted ? "Unmute" : "Mute"} variant="glass" size="lg" className="rounded-full" onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX /> : <Volume2 />}
          </IconButton>
          <IconButton label="Fullscreen" variant="glass" size="lg" className="rounded-full" onClick={fullscreen}>
            <Maximize2 />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

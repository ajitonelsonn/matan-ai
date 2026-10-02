"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Camera,
  Maximize2,
  Pause,
  Play,
  Video,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  MessageSquare,
  Siren,
  Lightbulb,
  Lock,
  LockOpen,
  Disc,
  Zap,
  Download,
  Share2,
  Settings,
  Film,
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useAppData } from "@/components/layout/AppDataProvider";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Menu } from "@/components/ui/Menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import { LiveCameraFrame, CameraTile } from "@/components/matan/CameraCard";
import { RiskBadge } from "@/components/matan/RiskBadge";
import { ProtectionPill } from "@/components/matan/EventStatus";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { RingBadge } from "@/components/matan/Brand";
import { useApi } from "@/hooks/useApi";
import { devicesApi } from "@/lib/api/devices";
import { eventsApi } from "@/lib/api/events";
import { images } from "@/lib/mock/images";
import { MOCK_NOW, TIME_ZONE } from "@/lib/mock/clock";
import { formatTime, formatDuration } from "@/lib/utils/format";
import { priorityTone, toneStyles } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";
import type { Device, RingEvent } from "@/lib/types";
import { ringApi } from "@/lib/api/ring";
import { RingLivePlayer } from "@/components/devices/ring-live-player";
import { RingLiveSidePanel } from "@/components/devices/ring-live-side-panel";
import { AddRingDeviceModal } from "@/components/devices/add-ring-device-modal";
import { useRingCountdown } from "@/components/devices/use-ring-session";
import { RingBadge as RingSourceBadge } from "@/components/matan/Brand";
import { useExperience } from "@/components/experience/experience-provider";
import { DemoMarker, SourceBadge } from "@/components/experience/source-badge";
import { RingCameraSettings, RingLiveControls, RingQuickActions, SnapshotViewer } from "@/components/devices/ring-live-tools";
import { getDataSource } from "@/lib/data/get-data-source";

const quickReplies = ["We'll be right there.", "Please leave the package at the door.", "We can't come to the door right now.", "Thanks! Have a great day."];

const sceneImage: Record<string, string | undefined> = { "cam-front": images.delivery };

function hourFraction(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: false, timeZone: TIME_ZONE }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (h + m / 60) / 24;
}

function useElapsed(active: boolean) {
  const [s, setS] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

function analysisFor(ev: RingEvent | undefined, cam: Device | undefined) {
  if (!ev) {
    return {
      headline: "Quiet scene",
      confidence: 0.98,
      priority: "normal" as const,
      badge: "Normal",
      text: `No activity detected at the ${cam?.name ?? "camera"} in the last hour. Matan AI is watching for people, packages and vehicles.`,
      tags: ["No motion", "Normal behaviour"],
      image: cam?.previewUrl,
    };
  }
  const headline = ev.type === "package" ? "Likely delivery" : ev.type === "unusual" ? "Unusual access pattern" : ev.type === "vehicle" ? "Vehicle in view" : ev.type === "animal" ? "Animal detected" : ev.type === "doorbell" ? "Visitor at the door" : ev.priority === "attention" ? "Unknown visitor" : "Person detected";
  return {
    headline,
    confidence: ev.confidence ?? 0.85,
    priority: ev.priority,
    badge: ev.badgeLabel ?? undefined,
    text: ev.aiAssessment ?? ev.summary,
    tags: [...ev.tags.filter((t) => !/normal/i.test(t)).slice(0, 3), cam?.name ?? ev.location, ...(ev.priority === "normal" ? ["Normal behaviour"] : [])],
    image: ev.imageUrl,
  };
}

export function LivePage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: shell } = useAppData();

  const { mode: experienceMode } = useExperience();
  const isRingMode = experienceMode === "ring";
  // Real Mode never loads the sample cameras - the Playground devices are the only source.
  const devicesQ = useApi(() => (experienceMode === "ring" ? Promise.resolve(null) : devicesApi.list()), [experienceMode]);
  const cameras = React.useMemo(() => (isRingMode ? [] : (devicesQ.data?.items ?? []).filter((d) => d.kind === "camera" || d.kind === "doorbell")), [devicesQ.data, isRingMode]);
  const [camId, setCamId] = React.useState<string>(params.get("camera") ?? (isRingMode ? "" : "cam-front"));

  // Real Ring devices connected through the Playground join the camera list.
  const ringQ = useApi(() => ringApi.devices(), []);
  const ringDevices = React.useMemo(() => (ringQ.data?.connected ?? []).filter((d) => d.details.video !== false), [ringQ.data]);
  const ringSession = ringQ.data?.session ?? null;
  const ringCountdown = useRingCountdown(ringSession);
  const ringLive = ringCountdown.status === "valid" || ringCountdown.status === "expiring";
  const ringCam = camId.startsWith("ring:") ? ringDevices.find((d) => `ring:${d.id}` === camId) : undefined;
  const [reconnectOpen, setReconnectOpen] = React.useState(false);
  // Real Mode defaults to the first connected Ring device when no camera was requested.
  React.useEffect(() => {
    if (isRingMode && !params.get("camera") && ringDevices[0] && !camId.startsWith("ring:")) setCamId(`ring:${ringDevices[0].id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRingMode, ringDevices.length]);

  const cam = isRingMode ? undefined : (cameras.find((c) => c.id === camId) ?? cameras[0]);

  // Real Mode: today's real Ring events (with Matan priorities); Demo Mode: the sample dataset.
  const eventsQ = useApi(() => (isRingMode ? getDataSource("ring").getEvents({ range: "today", pageSize: 100 }) : eventsApi.list({ range: "today", pageSize: 100 })), [isRingMode]);
  const [snap, setSnap] = React.useState<{ src: string; capturedAt?: string } | null>(null);
  const todays = eventsQ.data?.items ?? [];
  // Real Mode: the timeline belongs to the selected Ring device; Demo Mode: the sample camera.
  const camEvents = isRingMode ? (ringCam ? todays.filter((e) => e.cameraId === ringCam.id) : todays) : todays.filter((e) => e.cameraId === cam?.id);
  const latest = camEvents[0];
  const ai = analysisFor(latest, cam);

  const [paused, setPaused] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [talking, setTalking] = React.useState(false);
  const [lights, setLights] = React.useState(false);
  const [locked, setLocked] = React.useState(true);
  const [recording, setRecording] = React.useState(false);
  const elapsed = useElapsed(!paused);
  const recElapsed = useElapsed(recording);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const reply = usePopover();

  React.useEffect(() => {
    if (ringCam) window.history.replaceState(null, "", `/live?camera=ring:${ringCam.id}`);
    else if (cam && !isRingMode) window.history.replaceState(null, "", `/live?camera=${cam.id}`);
  }, [cam, ringCam, isRingMode]);

  const fullscreen = () => {
    if (frameRef.current && document.fullscreenEnabled) void frameRef.current.requestFullscreen().catch(() => toast.info("Fullscreen isn't available here"));
    else toast.info("Fullscreen isn't available in this browser");
  };

  const siren = async () => {
    const ok = await confirm({
      title: "Activate the siren?",
      description: "This would sound the siren on your Ring device. In this preview no physical device is connected.",
      confirmLabel: "Activate siren",
      icon: <Siren />,
    });
    if (ok) toast.warning("Siren requested", "No real device is connected in this preview.");
  };

  const updateSetting = async (key: keyof Device["settings"], value: boolean) => {
    if (!cam) return;
    try {
      const updated = await devicesApi.update(cam.id, { settings: { [key]: value } });
      devicesQ.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) } : d));
      toast.success("Camera settings saved", `${cam.name} · ${String(key).replace(/([A-Z])/g, " $1").toLowerCase()} ${value ? "on" : "off"}`);
    } catch {
      toast.error();
    }
  };

  const scrollStrip = (dir: 1 | -1) => stripRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });

  const online = cameras.filter((c) => c.status === "online").length;
  const counts = { normal: todays.filter((e) => e.priority === "normal").length, attention: todays.filter((e) => e.priority === "attention").length, important: todays.filter((e) => e.priority === "important").length };
  const nowIso = isRingMode ? new Date().toISOString() : MOCK_NOW;
  const nowFrac = hourFraction(nowIso);
  const important = shell?.todayCounts.important ?? 0;

  const loading = devicesQ.loading || !cam;

  return (
    <>
      <Topbar title={<span className="flex flex-wrap items-center gap-3">Live View {ringCam ? <SourceBadge source={ringLive ? "ring" : "ring-expired"} short /> : <SourceBadge source="demo" short title="Simulated camera" />}</span>} subtitle={ringCam ? "Real WebRTC stream from the Ring Developer Playground simulator." : isRingMode ? "Demo cameras are simulated. Select a Ring device for the real simulator stream." : "Simulated live experience. Mock controls stay active in Demo Mode."} status={<ProtectionPill modeName={shell?.activeModeName} level={important ? "review" : "protected"} className="hidden md:inline-flex" />} />

      {devicesQ.error ? (
        <ErrorState onRetry={() => void devicesQ.refetch()} message={devicesQ.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          {/* Left */}
          <div className="space-y-5 xl:col-span-8">
            {ringCam ? (
              <div ref={frameRef}>
                <RingLivePlayer key={ringCam.id} device={ringCam} sessionLive={ringLive} onReconnect={() => setReconnectOpen(true)} autoStart={params.get("autoplay") === "1"} />
              </div>
            ) : loading ? (
              <div className="relative">
                <Skeleton className="aspect-video w-full rounded-hero" />
                <LoadingOverlay label="Connecting to camera" />
              </div>
            ) : (
              <div ref={frameRef} className="rounded-hero">
                <LiveCameraFrame device={cam} imageUrl={sceneImage[cam.id] ?? cam.previewUrl} timestamp={`${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(MOCK_NOW))}  ${formatTime(MOCK_NOW)}`} topRight={<span className="inline-flex items-center gap-1.5 rounded-full border border-purple/40 bg-bg/60 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-purple backdrop-blur">✨ Demo camera</span>} priority>
                  {/* Side controls */}
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-2 sm:left-4">
                    <IconButton label={muted ? "Unmute" : "Mute"} variant="glass" size="lg" className="rounded-full" onClick={() => setMuted((m) => !m)}>
                      {muted ? <VolumeX /> : <Volume2 />}
                    </IconButton>
                    <IconButton label={talking ? "Stop talking" : "Talk"} variant="glass" size="lg" className="rounded-full" active={talking} onClick={() => setTalking((t) => !t)}>
                      {talking ? <Mic /> : <MicOff />}
                    </IconButton>
                    <IconButton label="Snapshot" variant="glass" size="lg" className="rounded-full" onClick={() => toast.success("Snapshot saved", `${cam.name} · ${formatTime(MOCK_NOW)}`)}>
                      <Camera />
                    </IconButton>
                    <IconButton label="Fullscreen" variant="glass" size="lg" className="rounded-full" onClick={fullscreen}>
                      <Maximize2 />
                    </IconButton>
                  </div>
                  {recording && (
                    <div className="absolute left-1/2 top-16 -translate-x-1/2 inline-flex items-center gap-2 rounded-full border border-danger/40 bg-bg/70 px-3 py-1 text-[12.5px] font-semibold text-danger backdrop-blur">
                      <span className="size-2 rounded-full bg-danger animate-pulse-dot" aria-hidden />
                      REC {formatDuration(recElapsed)}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5 sm:p-4">
                    <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? "Resume" : "Pause"} className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-bg/60 pl-1.5 pr-4 text-[15px] font-semibold text-text backdrop-blur-md hover:bg-bg/80">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-3">{paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}</span>
                      {paused ? "Paused" : "Live"}
                      <span className="tabular-nums text-text-2">{formatDuration(elapsed)}</span>
                    </button>
                    <Button
                      onClick={() => setTalking((t) => !t)}
                      leftIcon={<Mic className="size-4" />}
                      className={cn("bg-gradient-to-b from-danger to-[#e63b4c] shadow-[0_8px_24px_rgba(255,77,94,0.35)] hover:from-[#ff5f6e] hover:to-danger", talking && "ring-2 ring-danger/50")}
                      size="lg"
                    >
                      {talking ? "Stop talking" : "Talk to Visitor"}
                    </Button>
                  </div>
                </LiveCameraFrame>
              </div>
            )}

            {/* Camera selector */}
            <section className="card p-4" aria-labelledby="cam-selector">
              <SectionHeader
                icon={<Video />}
                title={<span id="cam-selector">Camera Selector</span>}
                action={
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium">
                    {ringDevices.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <RingSourceBadge size="xs" /> {ringDevices.length} Ring
                      </span>
                    )}
                    {!isRingMode && (
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <span className="size-1.5 rounded-full bg-success" aria-hidden />
                        {online}/{cameras.length} demo online
                      </span>
                    )}
                  </span>
                }
              />
              <div className="flex items-center gap-2">
                <IconButton label="Scroll left" size="sm" onClick={() => scrollStrip(-1)}>
                  <ChevronLeft />
                </IconButton>
                <div ref={stripRef} className="flex flex-1 gap-3 overflow-x-auto scrollbar-none pb-1 snap-x">
                  {ringDevices.map((d) => (
                    <div key={`ring:${d.id}`} className="relative w-[150px] shrink-0 snap-start">
                      <CameraTile name={d.displayName} imageUrl={d.imageUrl} online={d.status === "online"} selected={`ring:${d.id}` === camId} onClick={() => setCamId(`ring:${d.id}`)} showLive={false} />
                      <span className="pointer-events-none absolute right-2 top-2"><RingSourceBadge size="xs" /></span>
                    </div>
                  ))}
                  {isRingMode && ringDevices.length === 0 && !ringQ.loading && <p className="self-center text-[13px] text-text-3">No Ring devices connected yet - connect the Playground to add one.</p>}
                  {isRingMode
                    ? null
                    : loading
                    ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[92px] w-[150px] shrink-0 rounded-2xl" />)
                    : cameras.map((c) => (
                        <div key={c.id} className="relative w-[150px] shrink-0 snap-start">
                          <CameraTile name={c.name} imageUrl={c.id === "cam-front" ? images.delivery : c.previewUrl} online={c.status === "online"} selected={!ringCam && c.id === cam?.id} onClick={() => setCamId(c.id)} showLive={false} />
                          <span className="pointer-events-none absolute right-2 top-2"><DemoMarker /></span>
                        </div>
                      ))}
                </div>
                <IconButton label="Scroll right" size="sm" onClick={() => scrollStrip(1)}>
                  <ChevronRight />
                </IconButton>
              </div>
            </section>

            {/* Timeline */}
            <section className="card p-4" aria-labelledby="timeline-title">
              <SectionHeader
                icon={<Clock />}
                title={<span id="timeline-title">Today&apos;s Timeline</span>}
                href="/events?range=today"
                linkLabel="View all events"
                subtitle={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-text-2">{todays.length} events</span>
                    <Badge tone="success" size="xs" icon={<CircleCheck className="size-3" />}>{counts.normal} Normal</Badge>
                    <Badge tone="warning" size="xs" icon={<CircleAlert className="size-3" />}>{counts.attention} Attention</Badge>
                    <Badge tone="danger" size="xs" icon={<TriangleAlert className="size-3" />}>{counts.important} Important</Badge>
                  </span>
                }
              />
              <div className="relative mt-6 px-2 pb-6 pt-4">
                <div className="absolute left-2 right-2 top-4 h-1.5 rounded-full bg-gradient-to-r from-primary/20 via-surface-3 to-primary/20" aria-hidden />
                <div className="absolute top-[13px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary ring-4 ring-primary/25" style={{ left: `calc(${nowFrac * 100}% )` }} aria-hidden />
                <div className="absolute -top-3 -translate-x-1/2 rounded-md bg-primary px-1.5 py-0.5 text-[10.5px] font-bold text-white" style={{ left: `calc(${nowFrac * 100}% )` }}>
                  {formatTime(nowIso)}
                </div>
                {todays.map((e) => {
                  const f = hourFraction(e.timestamp);
                  const t = toneStyles[priorityTone[e.priority]];
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => router.push(`/events/${e.id}`)}
                      title={`${formatTime(e.timestamp)} · ${e.title} · ${e.location}`}
                      aria-label={`${formatTime(e.timestamp)} ${e.title} at ${e.location}`}
                      className={cn("absolute top-[11px] -translate-x-1/2 rounded-full border-2 border-surface transition-transform hover:scale-150 focus-visible:scale-150", e.priority === "normal" ? "size-3.5" : "size-4", t.dot, e.priority === "important" && "shadow-[0_0_10px_rgba(255,77,94,0.8)]")}
                      style={{ left: `${f * 100}%` }}
                    />
                  );
                })}
                <div className="absolute left-2 right-2 top-9 flex justify-between text-[11.5px] text-text-3">
                  {["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM", "12 AM"].map((l, i) => (
                    <span key={i} className={cn(i === 6 && "text-primary font-semibold")}>{i === 6 ? "Live" : l}</span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right */}
          <div className="space-y-5 xl:col-span-4">
            {/* AI analysis */}
            {ringCam ? (
              <RingLiveSidePanel device={ringCam} sessionLive={ringLive} onReconnect={() => setReconnectOpen(true)} />
            ) : (
            <section className="card-hero p-5" aria-labelledby="ai-title">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-primary text-white shadow-[0_6px_18px_rgba(154,113,255,0.35)]">
                    <Sparkles className="size-5" />
                  </span>
                  <h2 id="ai-title" className="text-[19px] font-bold text-text">
                    AI Real-time Analysis
                  </h2>
                </div>
                <Badge tone="primary" size="md">{Math.round(ai.confidence * 100)}% confident</Badge>
              </div>
              {eventsQ.loading || loading ? (
                <div className="relative mt-4 min-h-[160px]">
                  <Skeleton className="h-full w-full absolute inset-0" />
                  <LoadingOverlay size="sm" label="Analyzing scene" />
                </div>
              ) : (
                <>
                  <div className="mt-4 flex gap-4">
                    <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl border border-border">
                      <SafeImage src={ai.image} alt="" sizes="120px" grayscale={ai.priority === "important"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[19px] font-semibold text-text">{ai.headline}</h3>
                        <RiskBadge priority={ai.priority} label={ai.badge} size="md" />
                      </div>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{ai.text}</p>
                    </div>
                  </div>
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    {ai.tags.map((t) => (
                      <Badge key={t} tone={/normal/i.test(t) ? "success" : "primary"} size="md" variant={/normal/i.test(t) ? "soft" : "outline"}>
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <h4 className="mt-5 text-[15px] font-semibold text-text">Actions</h4>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button leftIcon={<Mic className="size-4" />} onClick={() => setTalking((t) => !t)} className="flex-1">
                      {talking ? "Stop talking" : "Talk to visitor"}
                    </Button>
                    <div ref={reply.rootRef} className="relative flex-1">
                      <Button ref={reply.triggerRef} variant="secondary" fullWidth leftIcon={<MessageSquare className="size-4" />} rightIcon={<ChevronDown className="size-4 text-text-3" />} onClick={() => reply.setOpen((o) => !o)} aria-expanded={reply.open} aria-haspopup="listbox">
                        Quick reply
                      </Button>
                      <PopoverPanel open={reply.open} align="end" width="16rem" role="listbox" aria-label="Quick replies">
                        {quickReplies.map((r) => (
                          <button
                            key={r}
                            role="option"
                            aria-selected={false}
                            type="button"
                            onClick={() => {
                              reply.setOpen(false);
                              toast.success("Quick reply sent", `“${r}” played on ${cam?.name}`);
                            }}
                            className="block w-full rounded-[10px] px-3 py-2 text-left text-sm text-text-2 hover:bg-primary/14 hover:text-text"
                          >
                            {r}
                          </button>
                        ))}
                      </PopoverPanel>
                    </div>
                    <Menu
                      items={[
                        { label: "Open latest event", icon: <ArrowRight />, onSelect: () => latest && router.push(`/events/${latest.id}`), disabled: !latest },
                        { label: "Mark as reviewed", icon: <CircleCheck />, onSelect: () => toast.success("Marked as reviewed") },
                        { label: "Share event", icon: <Share2 />, onSelect: () => toast.success("Link copied") },
                      ]}
                    />
                  </div>
                </>
              )}
            </section>
            )}

            {/* Live controls */}
            {ringCam ? (
              <RingLiveControls device={ringCam} live={ringLive} onSnapshot={(src, capturedAt) => setSnap({ src, capturedAt })} />
            ) : (
            <section className="card p-5" aria-labelledby="controls-title">
              <SectionHeader icon={<Video />} title={<span id="controls-title">Live Controls</span>} />
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Siren", icon: <Siren />, tone: "danger", onClick: () => void siren(), active: false },
                  { label: "Lights", icon: <Lightbulb />, tone: "warning", onClick: () => { setLights((l) => !l); toast.success(lights ? "Lights turned off" : "Lights turned on", "Smart lights near the front door"); }, active: lights },
                  { label: locked ? "Door Lock" : "Unlocked", icon: locked ? <Lock /> : <LockOpen />, tone: "primary", onClick: () => { setLocked((l) => !l); toast.success(locked ? "Door unlocked" : "Door locked"); }, active: locked },
                  { label: "Snapshot", icon: <Camera />, tone: "neutral", onClick: () => toast.success("Snapshot saved"), active: false },
                  { label: recording ? "Stop" : "Record", icon: <Disc />, tone: "neutral", onClick: () => { setRecording((r) => !r); toast.success(recording ? "Recording saved" : "Recording started"); }, active: recording },
                ].map((c) => {
                  const t = toneStyles[c.tone as keyof typeof toneStyles];
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={c.onClick}
                      aria-pressed={c.active}
                      className={cn(
                        "card-inset flex flex-col items-center gap-2 px-1 py-3.5 text-[12px] font-medium transition-[border-color,background-color,transform] hover:border-border-strong active:translate-y-px",
                        c.active && cn(t.bg, t.border),
                      )}
                    >
                      <span className={cn("[&>svg]:size-5", c.tone === "neutral" ? "text-text" : t.text)}>{c.icon}</span>
                      <span className={cn(c.tone === "neutral" ? "text-text" : t.text, "truncate max-w-full")}>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {ringCam ? (
                <RingQuickActions device={ringCam} frameRef={frameRef} live={ringLive} />
              ) : (
              <section className="card p-5" aria-labelledby="qa-title">
                <SectionHeader icon={<Zap />} title={<span id="qa-title">Quick Actions</span>} iconTone="warning" />
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Screenshot", icon: <Camera />, onClick: () => toast.success("Screenshot saved") },
                    { label: "Record Clip", icon: <Film />, onClick: () => { setRecording(true); toast.success("Recording a 30s clip"); } },
                    { label: "Download", icon: <Download />, onClick: () => toast.success("Download started", "Last 5 minutes · 42 MB") },
                    { label: "Share Event", icon: <Share2 />, onClick: () => toast.success("Link copied") },
                  ].map((a) => (
                    <button key={a.label} type="button" onClick={a.onClick} className="card-inset flex min-w-0 flex-col items-center gap-1.5 px-2 py-3 text-center text-[12px] font-medium text-text transition-[border-color,background-color] hover:border-border-strong">
                      <span className="text-primary [&>svg]:size-[18px]">{a.icon}</span>
                      <span className="truncate max-w-full">{a.label}</span>
                    </button>
                  ))}
                </div>
              </section>
              )}

              {ringCam ? (
                <RingCameraSettings device={ringCam} onChange={(d) => ringQ.setData((prev) => (prev ? { ...prev, connected: prev.connected.map((x) => (x.id === d.id ? d : x)) } : prev))} />
              ) : (
              <section className="card p-5" aria-labelledby="cs-title">
                <SectionHeader icon={<Settings />} title={<span id="cs-title">Camera Settings</span>} />
                <ul className="space-y-3">
                  {(
                    [
                      ["motionAlerts", "Motion Alerts"],
                      ["aiDetection", "AI Detection"],
                      ["audio", "Audio"],
                      ["notifications", "Notifications"],
                    ] as [keyof Device["settings"], string][]
                  ).map(([key, label]) => (
                    <li key={key} className="flex items-center justify-between text-[14px] text-text-2">
                      {label}
                      {cam ? <Toggle size="sm" checked={cam.settings[key]} onChange={(v) => void updateSetting(key, v)} label={label} /> : <Skeleton className="h-5 w-9 rounded-full" />}
                    </li>
                  ))}
                </ul>
                <Button href={cam ? `/devices/${cam.id}` : "/devices"} variant="ghost" size="sm" rightIcon={<ArrowRight className="size-4" />} className="mt-3 -mr-2 float-right text-primary">
                  Manage Settings
                </Button>
              </section>
              )}
            </div>
          </div>
        </div>
      )}

      {ringCam && <SnapshotViewer src={snap?.src ?? null} capturedAt={snap?.capturedAt} device={ringCam} onClose={() => setSnap(null)} />}
      <AddRingDeviceModal open={reconnectOpen} onClose={() => setReconnectOpen(false)} existingSession={ringSession} alreadyConnectedIds={(ringQ.data?.connected ?? []).map((d) => d.ringDeviceId)} onConnected={(connected, session) => ringQ.setData({ connected, session })} />
    </>
  );
}

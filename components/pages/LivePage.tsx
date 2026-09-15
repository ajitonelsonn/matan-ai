"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  Maximize2,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Sparkles,
  MessageSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Siren,
  Lightbulb,
  Lock,
  LockOpen,
  Circle,
  Download,
  Share2,
  Video,
  Zap,
  Settings,
  Clock,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { useAppData } from "@/components/layout/AppDataProvider";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Menu } from "@/components/ui/Menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { SafeImage } from "@/components/ui/SafeImage";
import { ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { LiveCameraFrame, CameraTile } from "@/components/matan/CameraCard";
import { RiskBadge } from "@/components/matan/RiskBadge";
import { ProtectionPill } from "@/components/matan/EventStatus";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { QuickAction } from "@/components/matan/QuickAction";
import { useApi } from "@/hooks/useApi";
import { devicesApi } from "@/lib/api/devices";
import { eventsApi } from "@/lib/api/events";
import { cn } from "@/lib/utils/cn";
import { priorityTone, toneStyles } from "@/lib/utils/tones";
import { formatTime, formatTimeWithSeconds, formatWeekdayDate, formatDuration } from "@/lib/utils/format";
import { MOCK_NOW, TIME_ZONE } from "@/lib/mock/clock";
import type { Device, RingEvent } from "@/lib/types";

const headlines: Record<RingEvent["type"], string> = {
  package: "Likely delivery",
  person: "Person nearby",
  vehicle: "Vehicle activity",
  animal: "Animal passing",
  doorbell: "Visitor at the door",
  unusual: "Unusual activity",
  other: "Routine motion",
};

const quickReplies = ["We'll be right there.", "Please leave the package by the door.", "Sorry, we can't come to the door right now.", "Can I help you?"];

function hourOf(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: false, timeZone: TIME_ZONE }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

export function LivePage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: app } = useAppData();

  const devicesQ = useApi(() => devicesApi.list(), []);
  const eventsQ = useApi(() => eventsApi.list({ range: "today", pageSize: 100, sort: "newest" }), []);

  const cameras = React.useMemo(() => (devicesQ.data?.items ?? []).filter((d) => d.kind === "camera" || d.kind === "doorbell"), [devicesQ.data]);
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get("camera"));
  const selected = cameras.find((c) => c.id === selectedId) ?? cameras[0];

  React.useEffect(() => {
    if (!selectedId && cameras.length) setSelectedId(cameras[0].id);
  }, [cameras, selectedId]);

  const [paused, setPaused] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [talking, setTalking] = React.useState(false);
  const [lights, setLights] = React.useState(false);
  const [locked, setLocked] = React.useState(true);
  const [recording, setRecording] = React.useState(false);
  const [recSeconds, setRecSeconds] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(24);
  const frameRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const todayEvents = eventsQ.data?.items ?? [];
  const camEvents = todayEvents.filter((e) => e.cameraId === selected?.id);
  const analysis = camEvents[0] ?? todayEvents[0];
  const counts = {
    total: todayEvents.length,
    normal: todayEvents.filter((e) => e.priority === "normal").length,
    attention: todayEvents.filter((e) => e.priority === "attention").length,
    important: todayEvents.filter((e) => e.priority === "important").length,
  };

  const selectCamera = (id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `/live?camera=${id}`);
  };

  const fullscreen = () => {
    const el = frameRef.current;
    if (el && document.fullscreenEnabled) void el.requestFullscreen().catch(() => toast.info("Fullscreen isn't available here"));
    else toast.info("Fullscreen isn't available in this browser");
  };

  const siren = async () => {
    const ok = await confirm({
      title: "Activate the siren?",
      description: "The siren on this Ring device would sound for 30 seconds. In this preview the action is simulated.",
      confirmLabel: "Activate siren",
      icon: <Siren />,
    });
    if (ok) toast.warning("Siren activated (demo)", "Would sound for 30 seconds on the connected device.");
  };

  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      toast.success("Clip saved", `${selected?.name} · ${formatDuration(recSeconds)} recorded (demo)`);
      setRecSeconds(0);
    } else {
      setRecording(true);
      toast.info("Recording started", "Tap Record again to stop and save the clip.");
    }
  };

  const updateSetting = async (key: keyof Device["settings"], value: boolean) => {
    if (!selected) return;
    devicesQ.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === selected.id ? { ...x, settings: { ...x.settings, [key]: value } } : x)) } : d));
    try {
      await devicesApi.update(selected.id, { settings: { [key]: value } });
      toast.success("Camera settings saved");
    } catch {
      toast.error();
      void devicesQ.refetch({ silent: true });
    }
  };

  const level = counts.important > 0 ? "review" : "protected";
  const nowHour = hourOf(MOCK_NOW);

  return (
    <>
      <Topbar
        title="Live View"
        subtitle="Watch your Ring cameras in real time, with AI-powered understanding."
        status={<ProtectionPill modeName={app?.activeModeName} level={level} className="hidden sm:inline-flex" />}
      />

      {devicesQ.error ? (
        <ErrorState onRetry={() => void devicesQ.refetch()} message={devicesQ.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          {/* Main column */}
          <div className="space-y-5 xl:col-span-8">
            {devicesQ.loading || !selected ? (
              <Skeleton className="aspect-video w-full rounded-hero" />
            ) : (
              <div ref={frameRef} className="rounded-hero">
                <LiveCameraFrame
                  device={selected}
                  imageUrl={selected.previewUrl}
                  timestamp={`${formatWeekdayDate(MOCK_NOW).replace(/^\w+,\s/, "")} · ${formatTimeWithSeconds(MOCK_NOW)}`}
                  priority
                  topRight={recording && <Badge tone="danger" variant="solid" size="sm" dot>REC {formatDuration(recSeconds)}</Badge>}
                >
                  {/* Left rail controls */}
                  <div className="absolute left-3.5 top-1/2 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
                    <IconButton label={muted ? "Unmute audio" : "Mute audio"} variant="glass" size="lg" className="rounded-full" onClick={() => setMuted((m) => !m)}>
                      {muted ? <VolumeX /> : <Volume2 />}
                    </IconButton>
                    <IconButton label={talking ? "Stop talking" : "Talk"} variant="glass" size="lg" className="rounded-full" active={talking} onClick={() => setTalking((t) => !t)}>
                      {talking ? <Mic /> : <MicOff />}
                    </IconButton>
                    <IconButton label="Snapshot" variant="glass" size="lg" className="rounded-full" onClick={() => toast.success("Snapshot saved", `${selected.name} · added to your gallery`)}>
                      <Camera />
                    </IconButton>
                    <IconButton label="Fullscreen" variant="glass" size="lg" className="rounded-full" onClick={fullscreen}>
                      <Maximize2 />
                    </IconButton>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5 sm:p-4">
                    <button
                      type="button"
                      onClick={() => setPaused((p) => !p)}
                      aria-pressed={paused}
                      className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-bg/60 pl-1.5 pr-4 text-[15px] font-semibold text-text backdrop-blur-md transition-colors hover:bg-bg/80"
                    >
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-3 text-text">{paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}</span>
                      {paused ? "Paused" : "Live"}
                      <span className="tabular-nums text-text-2">{formatDuration(elapsed)}</span>
                    </button>
                    <Button
                      onClick={() => {
                        setTalking((t) => !t);
                        toast.info(talking ? "Two-way talk ended" : "Two-way talk started (demo)", talking ? undefined : "Your voice would play through the camera speaker.");
                      }}
                      leftIcon={<Mic className="size-4" />}
                      className={cn("bg-gradient-to-b from-[#ff5f6f] to-danger shadow-[0_8px_24px_rgba(255,77,94,0.35)] hover:from-[#ff7280] hover:to-[#ff5566]", talking && "from-surface-3 to-surface-3 text-text shadow-none")}
                    >
                      {talking ? "End talk" : "Talk to Visitor"}
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
                  devicesQ.data && (
                    <span className="flex items-center gap-1.5 text-[13px] text-success">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden />
                      {cameras.filter((c) => c.status === "online").length}/{cameras.length} online
                    </span>
                  )
                }
                className="mb-3"
              />
              <CameraStrip cameras={cameras} selectedId={selected?.id} onSelect={selectCamera} loading={devicesQ.loading} />
            </section>

            {/* Timeline */}
            <section className="card p-4 sm:p-5" aria-labelledby="timeline-title">
              <SectionHeader icon={<Clock />} title={<span id="timeline-title">Today&apos;s Timeline</span>} href="/events?range=today" linkLabel="View all events" className="mb-3" />
              {eventsQ.loading ? (
                <Skeleton className="h-24" />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="mr-2 font-semibold text-text">{counts.total} events</span>
                    <Badge tone="success" size="md" dot>
                      {counts.normal} Normal
                    </Badge>
                    <Badge tone="warning" size="md" dot>
                      {counts.attention} Attention
                    </Badge>
                    <Badge tone="danger" size="md" dot>
                      {counts.important} Important
                    </Badge>
                  </div>
                  <DayTimeline events={todayEvents} nowHour={nowHour} onOpen={(id) => router.push(`/events/${id}`)} highlightCameraId={selected?.id} />
                </>
              )}
            </section>
          </div>

          {/* Side column */}
          <div className="space-y-5 xl:col-span-4">
            <section className="card-hero p-5" aria-labelledby="ai-title">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-primary text-white">
                    <Sparkles className="size-5" />
                  </span>
                  <h2 id="ai-title" className="text-[19px] font-semibold text-text">
                    AI Real-time Analysis
                  </h2>
                </div>
                {analysis?.confidence && (
                  <Badge tone="primary" size="md">
                    {Math.round(analysis.confidence * 100)}% confident
                  </Badge>
                )}
              </div>
              {eventsQ.loading || !analysis ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-8" />
                </div>
              ) : (
                <>
                  <div className="mt-4 flex gap-4">
                    <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl border border-border">
                      <SafeImage src={analysis.imageUrl} alt="" sizes="120px" grayscale={analysis.priority === "important"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[20px] font-semibold leading-tight text-text">{headlines[analysis.type]}</h3>
                        <RiskBadge priority={analysis.priority} label={analysis.badgeLabel ?? (analysis.priority === "normal" ? "Low risk" : undefined)} />
                      </div>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{analysis.aiAssessment ?? analysis.summary}</p>
                    </div>
                  </div>
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    <Badge tone="primary" size="md">
                      {analysis.location}
                    </Badge>
                    {analysis.tags.map((tag) => (
                      <Badge key={tag} tone={/normal|recognised|known/i.test(tag) ? "success" : "neutral"} size="md" className={/normal|recognised|known/i.test(tag) ? "" : "bg-surface-3/70 text-text-2"}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-[12px] text-text-3">
                    Based on the latest event from {analysis.location} at {formatTime(analysis.timestamp)}.{" "}
                    <Link href={`/events/${analysis.id}`} className="font-semibold text-primary hover:text-primary-2">
                      Open event →
                    </Link>
                  </p>
                </>
              )}
              <h4 className="mt-5 text-[15px] font-semibold text-text">Actions</h4>
              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  className="flex-1"
                  leftIcon={<Mic className="size-4" />}
                  variant={talking ? "secondary" : "primary"}
                  onClick={() => {
                    setTalking((t) => !t);
                    toast.info(talking ? "Two-way talk ended" : "Two-way talk started (demo)");
                  }}
                >
                  {talking ? "End talk" : "Talk to visitor"}
                </Button>
                <Menu
                  align="end"
                  width="18rem"
                  items={quickReplies.map((q) => ({ label: q, icon: <MessageSquare />, onSelect: () => toast.success("Quick reply played (demo)", `“${q}”`) }))}
                  trigger={
                    <Button variant="secondary" className="flex-1" leftIcon={<MessageSquare className="size-4" />} rightIcon={<ChevronDown className="size-4" />}>
                      Quick reply
                    </Button>
                  }
                />
                <Menu
                  align="end"
                  items={[
                    { label: "Mark as reviewed", onSelect: () => toast.success("Event marked as reviewed") },
                    { label: "Share event", icon: <Share2 />, onSelect: () => toast.success("Link copied") },
                    { label: "Open in Events", icon: <ArrowRight />, onSelect: () => analysis && router.push(`/events/${analysis.id}`) },
                  ]}
                  triggerVariant="solid"
                />
              </div>
            </section>

            <section className="card p-5" aria-labelledby="controls-title">
              <SectionHeader icon={<SlidersHorizontal />} title={<span id="controls-title">Live Controls</span>} className="mb-3" />
              <div className="grid grid-cols-5 gap-2">
                <ControlTile icon={<Siren />} label="Siren" tone="danger" onClick={() => void siren()} />
                <ControlTile icon={<Lightbulb />} label="Lights" tone="warning" active={lights} onClick={() => { setLights((l) => !l); toast.success(lights ? "Lights turned off (demo)" : "Lights turned on (demo)"); }} />
                <ControlTile icon={locked ? <Lock /> : <LockOpen />} label={locked ? "Door Lock" : "Unlocked"} tone="primary" active={!locked} onClick={async () => {
                  if (locked) {
                    const ok = await confirm({ title: "Unlock the front door?", description: "This would unlock the connected smart lock. Simulated in this preview.", confirmLabel: "Unlock", tone: "default", icon: <LockOpen /> });
                    if (!ok) return;
                  }
                  setLocked((l) => !l);
                  toast.success(locked ? "Door unlocked (demo)" : "Door locked (demo)");
                }} />
                <ControlTile icon={<Camera />} label="Snapshot" tone="neutral" onClick={() => toast.success("Snapshot saved", `${selected?.name ?? "Camera"} · added to your gallery`)} />
                <ControlTile icon={<Circle className={recording ? "fill-danger text-danger" : ""} />} label={recording ? "Stop" : "Record"} tone="neutral" active={recording} onClick={toggleRecording} />
              </div>
              <p className="mt-3 text-[11.5px] text-text-3">Controls update demo state only. Real Ring device actuation is part of a later phase.</p>
            </section>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
              <section className="card p-5" aria-labelledby="qa-title">
                <SectionHeader icon={<Zap />} title={<span id="qa-title">Quick Actions</span>} iconTone="warning" className="mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  <QuickAction icon={<Camera />} label="Screenshot" onClick={() => toast.success("Screenshot saved")} />
                  <QuickAction icon={<Video />} label="Record Clip" onClick={toggleRecording} />
                  <QuickAction icon={<Download />} label="Download" onClick={() => toast.success("Download started", "Last 30 seconds · demo clip")} />
                  <QuickAction icon={<Share2 />} label="Share Event" onClick={() => toast.success("Link copied", analysis ? `/events/${analysis.id}` : undefined)} />
                </div>
              </section>
              <section className="card p-5" aria-labelledby="cs-title">
                <SectionHeader icon={<Settings />} title={<span id="cs-title">Camera Settings</span>} className="mb-3" />
                {selected ? (
                  <ul className="space-y-1">
                    {(
                      [
                        ["motionAlerts", "Motion Alerts"],
                        ["aiDetection", "AI Detection"],
                        ["audio", "Audio"],
                        ["notifications", "Notifications"],
                      ] as [keyof Device["settings"], string][]
                    ).map(([key, label]) => (
                      <li key={key} className="flex items-center justify-between py-1.5">
                        <span className="text-[14px] text-text-2">{label}</span>
                        <Toggle checked={selected.settings[key]} onChange={(v) => void updateSetting(key, v)} label={`${label} for ${selected.name}`} size="sm" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Skeleton className="h-32" />
                )}
                <Link href={selected ? `/devices/${selected.id}` : "/devices"} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:text-primary-2">
                  Manage Settings <ArrowRight className="size-3.5" />
                </Link>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ControlTile({ icon, label, tone, active, onClick }: { icon: React.ReactNode; label: string; tone: "danger" | "warning" | "primary" | "neutral"; active?: boolean; onClick: () => void }) {
  const t = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "card-inset flex flex-col items-center justify-center gap-2 px-1 py-3.5 text-center transition-[border-color,background-color,transform] duration-150 hover:border-border-strong hover:bg-surface-2/70 active:translate-y-px",
        active && cn(t.border, "bg-surface-2"),
      )}
    >
      <span className={cn("[&>svg]:size-5", tone === "neutral" ? "text-text" : t.text)}>{icon}</span>
      <span className={cn("text-[12px] font-semibold", tone === "neutral" ? "text-text" : t.text)}>{label}</span>
    </button>
  );
}

function CameraStrip({ cameras, selectedId, onSelect, loading }: { cameras: Device[]; selectedId?: string; onSelect: (id: string) => void; loading: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  return (
    <div className="flex items-center gap-2">
      <IconButton label="Previous cameras" variant="outline" size="sm" onClick={() => scroll(-1)} className="hidden sm:inline-flex">
        <ChevronLeft />
      </IconButton>
      <div ref={ref} className="flex flex-1 gap-3 overflow-x-auto scrollbar-none py-1" role="listbox" aria-label="Cameras">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[112px] w-[176px] shrink-0 rounded-2xl" />)
          : cameras.map((c) => (
              <div key={c.id} className="w-[176px] shrink-0" role="option" aria-selected={c.id === selectedId}>
                <CameraTile name={c.name} imageUrl={c.previewUrl} online={c.status === "online"} selected={c.id === selectedId} onClick={() => onSelect(c.id)} showLive={false} />
              </div>
            ))}
      </div>
      <IconButton label="Next cameras" variant="outline" size="sm" onClick={() => scroll(1)} className="hidden sm:inline-flex">
        <ChevronRight />
      </IconButton>
    </div>
  );
}

function DayTimeline({ events, nowHour, onOpen, highlightCameraId }: { events: RingEvent[]; nowHour: number; onOpen: (id: string) => void; highlightCameraId?: string }) {
  const labels = ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM", "12 AM"];
  return (
    <div className="mt-5">
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-6 h-1 rounded-full bg-gradient-to-r from-primary/40 via-primary/25 to-surface-3" aria-hidden />
        {/* now marker */}
        <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(nowHour / 24) * 100}%` }} aria-hidden>
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10.5px] font-bold text-white">{formatTime(MOCK_NOW)}</span>
          <span className="mt-0.5 h-8 w-px bg-primary/70" />
        </div>
        {events.map((e) => {
          const h = hourOf(e.timestamp);
          const t = toneStyles[priorityTone[e.priority]];
          const size = e.priority === "important" ? "size-4" : e.priority === "attention" ? "size-3.5" : "size-2.5";
          const dim = highlightCameraId && e.cameraId !== highlightCameraId;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e.id)}
              aria-label={`${e.title} at ${formatTime(e.timestamp)} - ${e.priority}`}
              title={`${formatTime(e.timestamp)} · ${e.title}`}
              className={cn("group absolute top-[26px] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-surface transition-transform hover:scale-125 focus-visible:scale-125", size, t.dot, dim && "opacity-45")}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              <span className="pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-md border border-border-strong bg-surface-2/95 px-2 py-1 text-[11px] text-text shadow-lg group-hover:block group-focus-visible:block">
                {formatTime(e.timestamp)} · {e.title}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-text-3">
        {labels.map((l, i) => (
          <span key={i} className={cn(i === labels.length - 1 && "text-primary font-semibold")}>
            {i === labels.length - 1 ? "Live" : l}
          </span>
        ))}
      </div>
    </div>
  );
}

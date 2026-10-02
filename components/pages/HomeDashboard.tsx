"use client";

import { useNewItems } from "@/hooks/useNewItems";
import { matanApi } from "@/lib/api/matan";
import { ApiError } from "@/lib/api/client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Camera,
  Maximize2,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  VolumeX,
  ShieldCheck,
  CalendarDays,
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  Search,
  MessageSquare,
  Package,
  Bell,
  Shield,
  Activity,
  Send,
  Video,
  Mail,
  Plus,
  Sparkles,
  Zap,
  BarChart3,
} from "lucide-react";
import { useAppData } from "@/components/layout/AppDataProvider";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/components/ui/Toast";
import { LiveCameraFrame } from "@/components/matan/CameraCard";
import { RingBadge, MatanBot } from "@/components/matan/Brand";
import { StatTile, TrendDelta } from "@/components/matan/MetricCard";
import { EventCard } from "@/components/matan/EventCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { DeviceMini } from "@/components/matan/DeviceCard";
import { QuickAction } from "@/components/matan/QuickAction";
import { DonutChart } from "@/components/charts/DonutChart";
import { images } from "@/lib/mock/images";
import { chartColors } from "@/lib/utils/tones";
import { greetingFor, useClock } from "@/hooks/useClock";
import { TIME_ZONE } from "@/lib/mock/clock";
import { useExperience } from "@/components/experience/experience-provider";
import { SourceBadge } from "@/components/experience/source-badge";
import { RingLivePlayer } from "@/components/devices/ring-live-player";
import { Radio, Clock as ClockIcon, Cpu } from "lucide-react";

const quickIcons = [Search, MessageSquare, Package, Bell, Shield, Activity];

function useLiveClock() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: TIME_ZONE }).format(now).replace(",", ",");
}

export function HomeDashboard() {
  const { data, loading, error, refresh, mode } = useAppData();
  const { ring, openConnect } = useExperience();
  const isRing = mode === "ring";
  const ringLive = ring.state === "connected" || ring.state === "expiring";
  const featuredRing = isRing ? ring.connected.find((d) => d.id === data?.featuredCameraId) ?? ring.connected[0] : undefined;
  const { hour } = useClock();
  const router = useRouter();
  const newIds = useNewItems(mode === "ring" && data ? data.latestEvents.map((e) => e.id) : []);
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [paused, setPaused] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [micOn, setMicOn] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [sendingReport, setSendingReport] = React.useState(false);
  const heroRef = React.useRef<HTMLDivElement>(null);
  const liveClock = useLiveClock();

  const ask = (q: string) => {
    if (!q.trim()) return;
    router.push(`/assistant?q=${encodeURIComponent(q.trim())}`);
  };

  const fullscreen = () => {
    const el = heroRef.current;
    if (el && document.fullscreenEnabled) {
      void el.requestFullscreen().catch(() => toast.info("Fullscreen isn't available here"));
    } else {
      toast.info("Fullscreen isn't available in this browser");
    }
  };

  const sendReport = async () => {
    setSendingReport(true);
    try {
      if (!isRing) {
        // Demo Mode: simulated only - no email is sent from demo data.
        await new Promise((r) => setTimeout(r, 900));
        toast.info("Demo report simulated", "In Real Mode this emails today's real Ring summary to your alert address.");
        return;
      }
      const r = await matanApi.sendReport();
      if (r.status === "sent") toast.success("Report sent", `Today's summary (${r.total ?? 0} events) was emailed via ${r.provider === "smtp" ? "email (SMTP)" : "Amazon SES"}.`);
      else if (r.status === "duplicate") toast.info("Report already sent", "You can send another report in a few minutes.");
      else if (r.status === "skipped") toast.info("Report not sent", r.reason);
      else toast.error("Report failed", r.code);
    } catch (e) {
      const p = (e as ApiError).payload as { reason?: string; code?: string; status?: string } | undefined;
      if (p?.status === "duplicate") toast.info("Report already sent", "You can send another report in a few minutes.");
      else if (p?.status === "skipped") toast.info("Report not sent", p.reason);
      else toast.error("Report failed", p?.code ?? "Please try again.");
    } finally {
      setSendingReport(false);
    }
  };

  const firstName = data?.user.firstName ?? "";

  return (
    <>
      <Topbar
        title={
          <>
            {greetingFor(hour)}, {firstName}! <span aria-hidden>👋</span>
          </>
        }
        subtitle={isRing ? "Matan AI is connected to your Ring Simulator." : "Here's your Matan AI demo environment. Matan AI is watching and thinking for you."}
        banner="full"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search anything…",
        }}
        actions={
          search.trim() ? (
            <Button variant="subtle" size="sm" onClick={() => router.push(`/events?search=${encodeURIComponent(search.trim())}`)}>
              Search events
            </Button>
          ) : null
        }
      />

      {error && !data ? (
        <ErrorState onRetry={() => void refresh()} message={error} />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
            {/* Left column */}
            <div className="min-w-0 space-y-5 xl:col-span-7">
              {isRing && featuredRing ? (
                <RingLivePlayer key={featuredRing.id} device={featuredRing} sessionLive={ringLive} onReconnect={() => openConnect()} />
              ) : isRing && !loading ? (
                <div className="card-hero relative flex aspect-video flex-col items-center justify-center p-8 text-center">
                  <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Radio className="size-8" /></span>
                  <h2 className="mt-4 text-[20px] font-bold text-text">No Ring devices connected yet</h2>
                  <p className="mt-1 max-w-md text-[14px] text-text-2">Connect the Ring Developer Playground to stream the simulator device here.</p>
                  <Button className="mt-5" leftIcon={<Plus className="size-4" />} onClick={() => openConnect()}>Connect Ring</Button>
                </div>
              ) : loading || !data ? (
                <Skeleton className="aspect-video w-full rounded-hero" />
              ) : (
                (() => {
                  const cam = data.devices.find((d) => d.id === data.featuredCameraId) ?? data.devices[0];
                  return (
                    <div ref={heroRef} className="rounded-hero">
                      <LiveCameraFrame device={cam} imageUrl={cam.previewUrl ?? images.frontDoor} timestamp={liveClock || "—"} priority topRight={<RingBadge />}>
                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5 sm:p-4">
                          <button
                            type="button"
                            onClick={() => setPaused((p) => !p)}
                            className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-bg/60 pl-1.5 pr-4 text-[15px] font-semibold text-text backdrop-blur-md transition-colors hover:bg-bg/80"
                            aria-pressed={paused}
                            aria-label={paused ? "Resume live view" : "Pause live view"}
                          >
                            <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-3 text-text">{paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}</span>
                            {paused ? "Paused" : "Live"}
                          </button>
                          <div className="flex items-center gap-2">
                            <IconButton label={micOn ? "Mute microphone" : "Talk through camera"} variant="glass" size="lg" active={micOn} onClick={() => setMicOn((m) => !m)} className="rounded-full">
                              {micOn ? <Mic /> : <MicOff />}
                            </IconButton>
                            <IconButton label={muted ? "Unmute audio" : "Mute audio"} variant="glass" size="lg" onClick={() => setMuted((m) => !m)} className="rounded-full">
                              {muted ? <VolumeX /> : <Volume2 />}
                            </IconButton>
                            <IconButton label="Take snapshot" variant="glass" size="lg" onClick={() => toast.success("Snapshot saved", "Front Door · added to your gallery")} className="rounded-full">
                              <Camera />
                            </IconButton>
                            <IconButton label="Fullscreen" variant="glass" size="lg" onClick={fullscreen} className="rounded-full">
                              <Maximize2 />
                            </IconButton>
                          </div>
                          <Button href={`/live?camera=${cam.id}`} size="md" leftIcon={<Video className="size-4" />} className="hidden sm:inline-flex">
                            View Live
                          </Button>
                        </div>
                      </LiveCameraFrame>
                    </div>
                  );
                })()
              )}

              <section className="card p-4 sm:p-5" aria-labelledby="latest-events">
                <SectionHeader icon={<Camera />} title={<span id="latest-events">Latest Intelligence Events</span>} href="/events" />
                {loading || !data ? (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 [&>*]:min-w-0">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonCard key={i} lines={2} />
                    ))}
                  </div>
                ) : data.latestEvents.length === 0 ? (
                  <div className="card-inset p-6 text-center">
                    <p className="text-[15px] font-semibold text-text">No Ring events recorded yet</p>
                    <p className="mt-1 text-[13px] text-text-3">Trigger a Package, Vehicle or Motion simulation in the Ring Playground, then refresh.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 [&>*]:min-w-0">
                    {data.latestEvents.map((e) => (
                      <EventCard key={e.id} event={e} isNew={newIds.has(e.id)} onClick={(ev) => router.push(`/events/${ev.id}`)} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right column */}
            <div className="min-w-0 space-y-5 xl:col-span-5">
              {loading || !data ? (
                <SkeletonCard lines={4} className="min-h-[280px]" />
              ) : (
                <section className="card-hero p-5" aria-labelledby="status-title">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                        <Image src="/brand/matan-ai-logo.png" alt="" width={44} height={44} />
                      </span>
                      <div>
                        <h2 id="status-title" className="text-[22px] font-bold leading-tight text-text">
                          {isRing ? (ring.connected.length ? "Ring Simulator connected" : "Waiting for Ring devices") : data.todayCounts.important > 0 ? "Everything looks normal" : "Everything is normal"}
                        </h2>
                        <p className="mt-0.5 text-[14px] text-text-2">
                          {isRing ? (
                            <>{data.historyCount ?? data.latestEvents.length} Ring {(data.historyCount ?? data.latestEvents.length) === 1 ? "event" : "events"} on record. New Ring events are analyzed automatically by Matan AI (Nova Pro → Matan Decision Engine).</>
                          ) : (
                            <>
                              Matan AI has analyzed your home activity.
                              {data.todayCounts.important > 0 && <span className="text-warning"> {data.todayCounts.important} event is worth a review.</span>}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    {isRing ? (
                      <SourceBadge source={ring.state === "connected" ? "ring" : ring.state === "expiring" ? "ring-expiring" : "ring-expired"} size="md" className="shrink-0" />
                    ) : (
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone="success" size="md" className="h-9 px-3.5 text-[13px]" icon={<ShieldCheck className="size-4" />}>
                          Protected
                        </Badge>
                        <SourceBadge source="demo" size="xs" />
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr] [&>*]:min-w-0">
                    {isRing ? (
                      <>
                        <StatTile icon={<CalendarDays />} value={data.todayCounts.total} label="Events today" tone="primary" onClick={() => router.push("/events?range=today")} />
                        <StatTile icon={<Cpu />} value={data.devices.some((d) => d.statusStale) ? "—" : `${data.devices.filter((d) => d.status === "online").length}/${data.devices.length}`} label={data.devices.some((d) => d.statusStale) ? "Status unknown (reconnect)" : "Devices online"} tone={data.devices.some((d) => d.statusStale) ? "neutral" : "success"} onClick={() => router.push("/devices")} />
                        <StatTile icon={<ClockIcon />} value={data.latestEvents.filter((e) => e.analysis === "pending").length} label="Awaiting AI" tone="neutral" onClick={() => router.push("/events")} />
                        <StatTile icon={<Radio />} value={ring.state === "connected" || ring.state === "expiring" ? ring.countdownLabel : "—"} label={ring.state === "connected" || ring.state === "expiring" ? "Session left" : "Session expired"} tone={ring.state === "connected" ? "primary" : ring.state === "expiring" ? "warning" : "danger"} onClick={() => openConnect()} />
                      </>
                    ) : (
                      <>
                        <StatTile icon={<CalendarDays />} value={data.todayCounts.total} label="Events analyzed" tone="primary" onClick={() => router.push("/events?range=today")} />
                        <StatTile icon={<CircleCheck />} value={data.todayCounts.normal} label="Normal" tone="success" onClick={() => router.push("/events?range=today&priority=normal")} />
                        <StatTile icon={<CircleAlert />} value={data.todayCounts.attention} label="Attention" tone="warning" onClick={() => router.push("/events?range=today&priority=attention")} />
                        <StatTile icon={<TriangleAlert />} value={data.todayCounts.important} label="Important" tone="danger" onClick={() => router.push("/events?range=today&priority=important")} />
                      </>
                    )}
                  </div>
                  <div className="relative mt-3 overflow-hidden rounded-2xl border border-border min-h-[104px]">
                    <SafeImage src={images.coastline} alt="" sizes="480px" />
                    <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/75 to-bg/30" aria-hidden />
                    <blockquote className="relative p-4">
                      <p className="max-w-[260px] text-[15px] font-medium leading-snug text-text">“Ring sees the event. Matan understands what it means.”</p>
                      <footer className="mt-1.5 text-[13px] text-primary">— Matan AI</footer>
                    </blockquote>
                  </div>
                </section>
              )}

              <section className="card p-5" aria-labelledby="ask-title">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <MatanBot size={52} />
                    <div>
                      <h2 id="ask-title" className="text-[21px] font-bold leading-tight text-text">
                        Ask Matan AI
                      </h2>
                      <p className="text-[14px] text-text-2">Get instant answers from your home events.</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => ask(data?.quickQuestions[1] ?? "Summarize today's activity")} leftIcon={<Sparkles className="size-4" />}>
                    Try example
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 [&>*]:min-w-0">
                  {(data?.quickQuestions ?? Array.from({ length: 6 }).map(() => "")).map((q, i) => {
                    const Icon = quickIcons[i % quickIcons.length];
                    return q ? (
                      <button
                        key={q}
                        type="button"
                        onClick={() => ask(q)}
                        className="card-inset flex items-center gap-2.5 px-3.5 py-3 text-left text-[13.5px] font-medium text-text transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-2/70"
                      >
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        <span className="truncate">{q}</span>
                      </button>
                    ) : (
                      <Skeleton key={i} className="h-12" />
                    );
                  })}
                </div>
                <form
                  className="mt-3 flex items-center gap-2 rounded-2xl border border-primary/40 bg-bg/50 p-1.5 focus-within:border-primary/70 focus-within:shadow-[0_0_0_3px_rgba(18,168,255,0.15)] transition-[border-color,box-shadow]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(question);
                  }}
                >
                  <IconButton label="Voice input (future integration)" variant="primary" type="button" onClick={() => toast.info("Voice input is a future integration", "Type your question for now - Matan AI answers from your real Ring events.")} className="rounded-xl">
                    <Mic />
                  </IconButton>
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask Matan AI anything…"
                    aria-label="Ask Matan AI"
                    className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm text-text placeholder:text-text-3 outline-none"
                  />
                  <IconButton label="Send" variant="primary" type="submit" disabled={!question.trim()} className="rounded-xl">
                    <Send />
                  </IconButton>
                </form>
              </section>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-5 grid gap-5 lg:grid-cols-12 [&>*]:min-w-0">
            <section className="min-w-0 card p-5 lg:col-span-5" aria-labelledby="devices-title">
              <SectionHeader icon={<Video />} title={<span id="devices-title">Device Status</span>} href="/devices" linkLabel="View all devices" />
              {loading || !data ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 [&>*]:min-w-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-[118px]" />
                  ))}
                </div>
              ) : data.devices.length === 0 ? (
                <div className="card-inset p-5 text-center text-[13px] text-text-3">No Ring devices connected. <button type="button" onClick={() => openConnect()} className="font-semibold text-primary hover:text-primary-2">Connect Ring →</button></div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 [&>*]:min-w-0">
                  {data.devices.slice(0, 5).map((d) => (
                    <DeviceMini key={d.id} device={d} onClick={() => router.push(`/devices/${d.id}`)} />
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 card p-5 lg:col-span-3" aria-labelledby="quick-title">
              <SectionHeader icon={<Zap />} title={<span id="quick-title">Quick Actions</span>} iconTone="warning" />
              <div className="grid grid-cols-2 gap-2.5 [&>*]:min-w-0">
                <QuickAction icon={<Video />} label="View Live" href="/live" primary />
                <QuickAction icon={<ShieldCheck />} label="Security Mode" href="/security-modes" description={data?.activeModeName} />
                <QuickAction icon={<Mail />} label="Send Report" onClick={() => void sendReport()} loading={sendingReport} />
                <QuickAction icon={<Plus />} label="Add Automation" href="/automations?create=1" />
              </div>
              <div className="mt-3 flex justify-end">
                <SourceBadge source={isRing ? "ring" : "demo"} size="xs" short />
              </div>
            </section>

            <section className="min-w-0 card p-5 lg:col-span-4" aria-labelledby="activity-title">
              <SectionHeader icon={<BarChart3 />} title={<span id="activity-title">Today&apos;s Activity</span>} href="/insights?range=today" linkLabel="View details" />
              {loading || !data ? (
                <div className="flex items-center gap-5">
                  <Skeleton className="h-24 w-28" />
                  <Skeleton className="size-[132px] rounded-full" />
                </div>
              ) : (
                (() => {
                  const c = data.todayCounts.byType;
                  const slices = [
                    { name: "People", value: c.person, color: chartColors.people },
                    { name: "Packages", value: c.package, color: chartColors.packages },
                    { name: "Vehicles", value: c.vehicle, color: chartColors.vehicles },
                    { name: "Others", value: c.animal + c.doorbell + c.other + c.unusual, color: chartColors.others },
                  ];
                  if (isRing && data.todayCounts.total === 0) {
                    return <p className="text-[13.5px] text-text-3">No Ring events today yet. Counts here come from Ring event history only.</p>;
                  }
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-[40px] font-bold leading-none tabular-nums text-text">{data.todayCounts.total}</div>
                        <div className="mt-1 text-[13px] text-text-2">Total events</div>
                        <div className="mt-2 flex flex-col">
                          <TrendDelta value={data.todayVsYesterdayPct} invert className="text-[13px]" />
                          <span className="text-[11.5px] text-text-3">vs yesterday</span>
                        </div>
                      </div>
                      <DonutChart data={slices} size={132} thickness={20} ariaLabel="Today's events by type" />
                      <ul className="space-y-1.5 text-[13px]">
                        {slices.map((s) => (
                          <li key={s.name} className="flex items-center justify-between gap-6">
                            <span className="flex items-center gap-2 text-text-2">
                              <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                              {s.name}
                            </span>
                            <span className="font-semibold tabular-nums text-text">{s.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

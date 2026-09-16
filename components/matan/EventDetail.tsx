"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Maximize2,
  Download,
  Share2,
  Video,
  Sparkles,
  Clock,
  Lightbulb,
  CircleCheck,
  Circle,
  Star,
  StarOff,
  Flag,
  CheckCheck,
  FilePlus2,
  Trash2,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Menu } from "@/components/ui/Menu";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatusDot } from "@/components/ui/StatusDot";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon, eventTypeIcon } from "@/components/ui/Icon";
import { RiskBadge } from "./RiskBadge";
import { eventsApi } from "@/lib/api/events";
import { eventTypeTone, toneStyles } from "@/lib/utils/tones";
import { formatDate, formatDuration, formatTime, formatTimeWithSeconds, relativeDay } from "@/lib/utils/format";
import type { RingEvent } from "@/lib/types";
import { SourceBadge } from "@/components/experience/source-badge";

function useMockPlayer(duration = 15) {
  const [playing, setPlaying] = React.useState(false);
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((v) => {
        if (v + 0.25 >= duration) {
          setPlaying(false);
          return duration;
        }
        return v + 0.25;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, duration]);
  const toggle = () => {
    if (t >= duration) setT(0);
    setPlaying((p) => !p);
  };
  return { playing, t, toggle, seek: setT };
}

export function EventDetail({
  event,
  onChange,
  onDeleted,
  className,
  compact,
}: {
  event: RingEvent;
  onChange: (e: RingEvent) => void;
  onDeleted?: (id: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const player = useMockPlayer(event.clipDuration ?? 15);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const t = toneStyles[eventTypeTone[event.type]];

  React.useEffect(() => {
    player.seek(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const patch = async (p: Parameters<typeof eventsApi.update>[1], msg?: string) => {
    try {
      const updated = await eventsApi.update(event.id, p);
      onChange(updated);
      if (msg) toast.success(msg);
    } catch {
      toast.error();
    }
  };

  const toggleAction = async (id: string) => {
    setBusyAction(id);
    await patch({ actionId: id });
    setBusyAction(null);
  };

  const fullscreen = () => {
    if (frameRef.current && document.fullscreenEnabled) void frameRef.current.requestFullscreen().catch(() => toast.info("Fullscreen isn't available here"));
    else toast.info("Fullscreen isn't available in this browser");
  };

  const share = async () => {
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: event.summary, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", "Share it with a family member.");
    } catch {
      toast.info("Link ready", url);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Delete this event?",
      description: "The clip and Matan AI analysis will be removed from your history. This can't be undone.",
      confirmLabel: "Delete event",
    });
    if (!ok) return;
    try {
      await eventsApi.remove(event.id);
      toast.success("Event deleted");
      onDeleted?.(event.id);
    } catch {
      toast.error();
    }
  };

  const timeline = event.timeline ?? [];
  const actions = event.recommendedActions ?? [];
  const isRing = event.source === "ring";
  const pending = event.analysis === "pending";

  if (isRing) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-xl border", t.bg, t.border, t.text)}>
              <Icon name={eventTypeIcon[event.type]} className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold leading-tight text-text">{event.title}</h2>
              <p className="text-[13px] text-text-2">
                {relativeDay(event.timestamp)}, {formatDate(event.timestamp)} · {formatTimeWithSeconds(event.timestamp)}
              </p>
            </div>
          </div>
          <RiskBadge priority={event.priority} pending={pending} size="md" />
        </div>

        <dl className="grid gap-2.5 sm:grid-cols-2">
          {[
            ["Source", <SourceBadge key="s" source="ring" size="xs" short />],
            ["Event", `${event.title}${event.ringEventType ? ` (${event.ringEventType.replace(/_/g, " ")})` : ""}`],
            ["Device", event.location],
            ["Duration", event.clipDuration !== undefined ? formatDuration(event.clipDuration) : "Not available"],
          ].map(([k, v]) => (
            <div key={String(k)} className="card-inset p-3">
              <dt className="text-[11px] uppercase tracking-wide text-text-3">{k}</dt>
              <dd className="mt-1 text-[14px] font-semibold text-text">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="card-inset p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-3/60 text-text-3">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-text-3">Matan AI</p>
              <p className="text-[15px] font-semibold text-text">Awaiting analysis</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">
                This event was recorded by the Ring Simulator. Priority, confidence and recommended actions will appear once the Matan AI (Amazon Bedrock) pipeline has actually processed it - Matan never claims an analysis that hasn&apos;t run.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <Badge key={tag} tone={tag === "Ring Simulator" ? "primary" : "neutral"} size="md">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        {timeline.length > 0 && (
          <section className="card-inset p-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-text">
              <Clock className="size-4 text-primary" aria-hidden /> Ring timeline
            </h3>
            <ol className="mt-3 space-y-2">
              {timeline.map((step, i) => (
                <li key={i} className="flex items-center gap-3 text-[13.5px]">
                  <span className="size-1.5 shrink-0 rounded-full bg-text-3" aria-hidden />
                  <span className="w-[70px] shrink-0 tabular-nums text-text-3">{formatTimeWithSeconds(step.time).replace(/ (AM|PM)$/, "")}</span>
                  <span className="text-text-2">{step.label}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button href={`/live?camera=ring:${event.cameraId}`} leftIcon={<Play className="size-4 fill-current" />} className="flex-1 min-w-[140px]">
            Ring live view
          </Button>
          <Button variant="secondary" leftIcon={<Video className="size-4" />} onClick={() => router.push(`/devices/${event.cameraId}`)} className="flex-1 min-w-[140px]">
            Device details
          </Button>
        </div>
        <p className="text-[12px] text-text-3">Clip download, sharing and edits are not available for Ring history events in this preview.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-xl border", t.bg, t.border, t.text)}>
            <Icon name={eventTypeIcon[event.type]} className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[20px] font-bold leading-tight text-text">{event.title}</h2>
            <p className="text-[13px] text-text-2">
              {relativeDay(event.timestamp)}, {formatDate(event.timestamp)} · {formatTimeWithSeconds(event.timestamp)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RiskBadge priority={event.priority} label={event.badgeLabel} size="md" />
          <Menu
            label="Event options"
            items={[
              { label: event.starred ? "Remove star" : "Star event", icon: event.starred ? <StarOff /> : <Star />, onSelect: () => void patch({ starred: !event.starred }, event.starred ? "Star removed" : "Event starred") },
              {
                label: event.priority === "important" ? "Mark as normal" : "Mark important",
                icon: <Flag />,
                onSelect: () => void patch({ priority: event.priority === "important" ? "normal" : "important" }, event.priority === "important" ? "Event marked normal" : "Event marked important"),
              },
              { label: event.reviewed ? "Mark as unreviewed" : "Mark as reviewed", icon: <CheckCheck />, onSelect: () => void patch({ reviewed: !event.reviewed }, event.reviewed ? "Marked unreviewed" : "Marked as reviewed") },
              { label: "Add to report", icon: <FilePlus2 />, onSelect: () => toast.success("Added to report", "Included in your next daily summary.") },
              "separator",
              { label: "Delete event", icon: <Trash2 />, tone: "danger", onSelect: () => void remove() },
            ]}
          />
        </div>
      </div>

      {/* Media */}
      <div ref={frameRef} className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface-2">
        <SafeImage src={event.imageUrl} alt={`${event.title} clip`} sizes="(max-width: 1024px) 100vw, 40vw" grayscale={event.priority === "important"} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/50 via-transparent to-bg/80" aria-hidden />
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-bg/60 px-3 py-1 text-[13px] font-medium text-text backdrop-blur">
          <StatusDot tone="success" />
          {event.location} Camera
        </div>
        <div className="absolute right-3 top-3 rounded-lg border border-white/10 bg-bg/60 px-2.5 py-1 text-[12.5px] tabular-nums text-text backdrop-blur">
          {formatDate(event.timestamp)} · {formatTimeWithSeconds(event.timestamp)}
        </div>
        {!player.playing && (
          <button type="button" onClick={player.toggle} aria-label="Play clip" className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full border border-white/20 bg-bg/55 text-text backdrop-blur transition-transform hover:scale-105">
            <Play className="size-7 fill-current pl-0.5" />
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-3 pb-3">
          <IconButton label={player.playing ? "Pause" : "Play"} variant="glass" onClick={player.toggle}>
            {player.playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </IconButton>
          <span className="text-[12.5px] tabular-nums text-text">
            {formatDuration(Math.floor(player.t))} / {formatDuration(event.clipDuration ?? 15)}
          </span>
          <input
            type="range"
            min={0}
            max={event.clipDuration ?? 15}
            step={0.25}
            value={player.t}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label="Seek"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-primary [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow"
          />
          <IconButton label="Fullscreen" variant="glass" onClick={fullscreen}>
            <Maximize2 />
          </IconButton>
          <IconButton label="Download clip" variant="glass" onClick={() => toast.success("Clip download started", `${event.id}.mp4 · ${formatDuration(event.clipDuration ?? 15)}`)}>
            <Download />
          </IconButton>
        </div>
      </div>

      {/* AI analysis */}
      <section className="card-inset p-4" aria-labelledby={`ai-${event.id}`}>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-primary text-white shadow-[0_6px_18px_rgba(154,113,255,0.35)]">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`ai-${event.id}`} className="text-[15px] font-semibold text-text">
                AI Analysis <span className="font-normal text-text-3">(Amazon Nova)</span>
              </h3>
              {typeof event.confidence === "number" && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-text-2">
                  {Math.round(event.confidence * 100)}% confident
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <CircleCheck className="size-3.5" />
                  </span>
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{event.aiAssessment ?? event.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.tags.map((tag) => {
                const good = /normal|recogni|known|collected|answered/i.test(tag);
                const bad = /unrecogni|repeated|quiet|review|lingering|unattended/i.test(tag);
                return (
                  <Badge key={tag} tone={good ? "success" : bad ? (event.priority === "important" ? "danger" : "warning") : "primary"} size="md">
                    {tag}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline + recommended */}
      <div className={cn("grid gap-4", !compact && "md:grid-cols-2")}>
        <section className="card-inset p-4" aria-labelledby={`tl-${event.id}`}>
          <h3 id={`tl-${event.id}`} className="flex items-center gap-2 text-[15px] font-semibold text-text">
            <Clock className="size-4 text-primary" aria-hidden />
            Event Timeline
          </h3>
          {timeline.length ? (
            <ol className="mt-3 space-y-2">
              {(showAll ? timeline : timeline.slice(0, 4)).map((step, i) => (
                <li key={i} className="flex items-center gap-3 text-[13.5px]">
                  <span className={cn("size-1.5 shrink-0 rounded-full", i === timeline.length - 1 ? "bg-primary" : "bg-text-3")} aria-hidden />
                  <span className="w-[70px] shrink-0 tabular-nums text-text-3">{formatTimeWithSeconds(step.time).replace(/ (AM|PM)$/, "")}</span>
                  <span className="text-text-2">{step.label}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-[13.5px] text-text-3">
              Single detection at {formatTime(event.timestamp)}. No follow-up movement recorded.
            </p>
          )}
          {timeline.length > 4 && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-2">
              {showAll ? "Show less" : `Show ${timeline.length - 4} more`}
              {showAll ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          )}
        </section>

        <section className="card-inset p-4" aria-labelledby={`ra-${event.id}`}>
          <h3 id={`ra-${event.id}`} className="flex items-center gap-2 text-[15px] font-semibold text-text">
            <Lightbulb className="size-4 text-warning" aria-hidden />
            Recommended Action
          </h3>
          <ul className="mt-3 space-y-2">
            {actions.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => void toggleAction(a.id)}
                  disabled={busyAction === a.id}
                  aria-pressed={a.done}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left text-[13.5px] transition-colors hover:bg-surface-2/70"
                >
                  {a.done ? <CircleCheck className="size-[18px] shrink-0 text-success" aria-hidden /> : <Circle className="size-[18px] shrink-0 text-text-3" aria-hidden />}
                  <span className={cn(a.done ? "text-text-2" : "text-text")}>{a.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button href={`/live?camera=${event.cameraId ?? "cam-front"}`} leftIcon={<Play className="size-4 fill-current" />} className="flex-1 min-w-[140px]">
          View Live
        </Button>
        <Button variant="secondary" leftIcon={<Download className="size-4" />} onClick={() => toast.success("Clip download started", `${event.id}.mp4`)} className="flex-1 min-w-[140px]">
          Download Clip
        </Button>
        <Button variant="secondary" leftIcon={<Share2 className="size-4" />} onClick={() => void share()} className="flex-1 min-w-[110px]">
          Share
        </Button>
        <IconButton label="Open camera page" variant="outline" size="lg" onClick={() => router.push(`/devices/${event.cameraId ?? "cam-front"}`)}>
          <Video />
        </IconButton>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-text-3">
        <MapPin className="size-3.5" aria-hidden />
        {event.location} · Event ID {event.id}
        {event.reviewed && <Badge tone="success" size="xs" className="ml-1">Reviewed</Badge>}
        {event.starred && <Badge tone="warning" size="xs" className="ml-1">Starred</Badge>}
      </p>
    </div>
  );
}

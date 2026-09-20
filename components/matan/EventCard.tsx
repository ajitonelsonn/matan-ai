"use client";

import * as React from "react";
import { Clock, MapPin, Play, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SafeImage } from "@/components/ui/SafeImage";
import { Icon, eventTypeIcon } from "@/components/ui/Icon";
import { RiskBadge } from "./RiskBadge";
import { eventTypeTone, toneStyles } from "@/lib/utils/tones";
import { formatDuration, formatTime, relativeDayTime } from "@/lib/utils/format";
import type { RingEvent } from "@/lib/types";
import { eventStage, notificationText, notificationTone, stageView } from "@/lib/matan/event-state";
import { Badge } from "@/components/ui/Badge";
import { CircleCheck, Loader2, TriangleAlert, Bell, BellOff, Camera } from "lucide-react";

function priorityAccent(priority: RingEvent["priority"]) {
  return priority === "important" ? "border-danger/50 glow-danger" : priority === "attention" ? "border-warning/40" : "border-border";
}

/** Badge props for the event's current Matan stage (Ring events only). */
function stageProps(event: RingEvent) {
  const stage = eventStage(event);
  return { pending: stage === "new", capturing: stage === "capturing", analyzing: stage === "analyzing", failed: stage === "failed" };
}

/** "✓ AI analysis complete · ✓ Notification sent" style status lines under a Ring event. */
export function EventStatusLines({ event, compact }: { event: RingEvent; compact?: boolean }) {
  if (event.source !== "ring") return null;
  const view = stageView(event);
  const note = notificationText(event);
  const tone = notificationTone(event);
  const size = compact ? "text-[11.5px]" : "text-[12.5px]";
  return (
    <div className={cn("space-y-0.5", size)} aria-live="polite" aria-atomic="true">
      <p className={cn("flex items-center gap-1.5", view.stage === "complete" ? "text-success" : view.stage === "failed" ? "text-danger" : view.active ? "text-primary" : "text-text-3")}>
        {view.stage === "complete" ? <CircleCheck className="size-3.5" aria-hidden /> : view.stage === "failed" ? <TriangleAlert className="size-3.5" aria-hidden /> : view.stage === "capturing" ? <Camera className="size-3.5" aria-hidden /> : view.active ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> : <span className="size-3.5 inline-flex items-center justify-center"><span className="size-1.5 rounded-full bg-text-3" /></span>}
        {view.stage === "complete" ? "AI analysis complete" : view.label}
      </p>
      {note && (
        <p className={cn("flex items-center gap-1.5", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "primary" ? "text-primary" : "text-text-3")}>
          {tone === "success" ? <Bell className="size-3.5" aria-hidden /> : tone === "danger" ? <TriangleAlert className="size-3.5" aria-hidden /> : <BellOff className="size-3.5" aria-hidden />}
          {note}
        </p>
      )}
    </div>
  );
}

/** Subtle highlight + "New" badge for a Ring event that just arrived via polling. Respects prefers-reduced-motion. */
export const newEventClass = "border-primary/60 shadow-[0_0_0_1px_rgba(18,168,255,0.35),0_0_28px_-6px_rgba(18,168,255,0.45)] motion-safe:animate-fade-in";

/** Compact tile (Home → Latest intelligence events). */
export function EventCard({ event, onClick, className, isNew }: { event: RingEvent; onClick?: (e: RingEvent) => void; className?: string; isNew?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick ? () => onClick(event) : undefined}
      className={cn("card hover-lift flex flex-col p-3.5 text-left transition-[border-color,box-shadow] duration-500", priorityAccent(event.priority), onClick && "hover:border-border-strong", isNew && newEventClass, className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-border">
          <SafeImage src={event.imageUrl} alt={event.title} sizes="120px" grayscale={event.priority === "important"} />
        </div>
        <span className="flex items-center gap-1.5">
          {isNew && <Badge tone="primary" size="xs" uppercase>New</Badge>}
          <RiskBadge priority={event.priority} label={event.badgeLabel} size="xs" {...stageProps(event)} />
        </span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-text leading-tight">{event.title}</h3>
      <dl className="mt-2 space-y-1 text-[12.5px] text-text-2">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-text-3" aria-hidden />
          <dd>{relativeDayTime(event.timestamp)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-text-3" aria-hidden />
          <dd>{event.location}</dd>
        </div>
      </dl>
      <p className={cn("mt-2.5 text-[12.5px] leading-relaxed", event.priority === "normal" ? "text-text-3" : "text-text-2")}>{eventStage(event) === "new" ? `${event.summary} Awaiting Matan AI analysis.` : event.summary}</p>
      {event.source === "ring" && <div className="mt-2.5 border-t border-border pt-2"><EventStatusLines event={event} compact /></div>}
    </Tag>
  );
}

/** List row (Events page). Selectable, keyboard focusable. */
export function EventRow({ event, selected, onSelect, className, isNew, ...rest }: { event: RingEvent; selected?: boolean; onSelect: (e: RingEvent) => void; className?: string; isNew?: boolean } & Record<`data-${string}`, unknown>) {
  const tone = eventTypeTone[event.type];
  const t = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      aria-pressed={selected}
      aria-label={`${event.title} at ${event.location}, ${relativeDayTime(event.timestamp)}, ${event.priority}`}
      {...rest}
      className={cn(
        "card group flex w-full items-center gap-4 p-3 text-left transition-[border-color,box-shadow,background-color] duration-500 hover:border-border-strong hover:bg-surface-2/60",
        selected && "border-primary/60 glow-strong bg-surface-2/70",
        !selected && event.priority === "important" && "border-danger/35",
        isNew && !selected && newEventClass,
        className,
      )}
    >
      <div className="relative h-[72px] w-[124px] shrink-0 overflow-hidden rounded-xl border border-border hidden sm:block">
        <SafeImage src={event.imageUrl} alt="" sizes="140px" grayscale={event.priority === "important"} />
        {event.clipDuration && (
          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-bg/75 px-1.5 py-0.5 text-[10px] font-semibold text-text backdrop-blur">
            <Play className="size-2.5 fill-current" aria-hidden />
            {formatDuration(event.clipDuration)}
          </span>
        )}
      </div>
      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border sm:size-11", t.bg, t.border, t.text)}>
        <Icon name={eventTypeIcon[event.type]} className="size-5" />
      </span>
      <div className="min-w-0 flex-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)] items-center">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-text">{event.title}</h3>
          <p className="truncate text-[13px] text-text-2">{event.location}</p>
          <p className="text-[12.5px] text-text-3">{relativeDayTime(event.timestamp)}</p>
        </div>
        <div className="hidden sm:block min-w-0">
          <p className="text-[13.5px] leading-snug text-text-2 line-clamp-2">{event.summary}</p>
          {event.source === "ring" && <div className="mt-1"><EventStatusLines event={event} compact /></div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isNew && <Badge tone="primary" size="xs" uppercase>New</Badge>}
        <RiskBadge priority={event.priority} label={event.badgeLabel} {...stageProps(event)} />
        <ChevronRight className={cn("size-4 text-text-3 transition-transform group-hover:translate-x-0.5", selected && "text-primary")} aria-hidden />
      </div>
    </button>
  );
}

/** Minimal line used in lists (Business recent events, assistant references). */
export function EventLine({ event, onClick, className, showDay }: { event: Pick<RingEvent, "id" | "title" | "location" | "timestamp" | "type" | "priority"> & { analysis?: RingEvent["analysis"] }; onClick?: () => void; className?: string; showDay?: boolean }) {
  const t = toneStyles[eventTypeTone[event.type]];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors", onClick && "hover:bg-surface-2/70", className)}>
      <span className="w-[76px] shrink-0 whitespace-pre-line text-[12.5px] tabular-nums text-text-3 leading-tight">
        {showDay ? relativeDayTime(event.timestamp).replace(", ", "\n") : formatTime(event.timestamp)}
      </span>
      <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg border", t.bg, t.border, t.text)}>
        <Icon name={eventTypeIcon[event.type]} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", event.priority === "important" ? "font-semibold text-text" : "text-text")}>{event.title}</span>
        <span className="block truncate text-xs text-text-3">{event.location}</span>
      </span>
      <RiskBadge priority={event.priority} size="xs" variant="soft" pending={event.analysis === "pending"} capturing={event.analysis === "capturing"} analyzing={event.analysis === "analyzing"} failed={event.analysis === "failed"} />
    </Tag>
  );
}

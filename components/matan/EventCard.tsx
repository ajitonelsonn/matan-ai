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

function priorityAccent(priority: RingEvent["priority"]) {
  return priority === "important" ? "border-danger/50 glow-danger" : priority === "attention" ? "border-warning/40" : "border-border";
}

/** Compact tile (Home → Latest intelligence events). */
export function EventCard({ event, onClick, className }: { event: RingEvent; onClick?: (e: RingEvent) => void; className?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick ? () => onClick(event) : undefined}
      className={cn("card hover-lift flex flex-col p-3.5 text-left transition-[border-color]", priorityAccent(event.priority), onClick && "hover:border-border-strong", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-border">
          <SafeImage src={event.imageUrl} alt={event.title} sizes="120px" grayscale={event.priority === "important"} />
        </div>
        <RiskBadge priority={event.priority} label={event.badgeLabel} size="xs" pending={event.analysis === "pending"} analyzing={event.analysis === "analyzing"} />
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
      <p className={cn("mt-2.5 text-[12.5px] leading-relaxed", event.priority === "normal" ? "text-text-3" : "text-text-2")}>{event.analysis === "pending" ? `${event.summary} Awaiting Matan AI analysis.` : event.summary}</p>
    </Tag>
  );
}

/** List row (Events page). Selectable, keyboard focusable. */
export function EventRow({ event, selected, onSelect, className, ...rest }: { event: RingEvent; selected?: boolean; onSelect: (e: RingEvent) => void; className?: string } & Record<`data-${string}`, unknown>) {
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
        "card group flex w-full items-center gap-4 p-3 text-left transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong hover:bg-surface-2/60",
        selected && "border-primary/60 glow-strong bg-surface-2/70",
        !selected && event.priority === "important" && "border-danger/35",
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
        <p className="hidden sm:block text-[13.5px] leading-snug text-text-2 line-clamp-2">{event.summary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RiskBadge priority={event.priority} label={event.badgeLabel} pending={event.analysis === "pending"} analyzing={event.analysis === "analyzing"} />
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
      <RiskBadge priority={event.priority} size="xs" variant="soft" pending={event.analysis === "pending"} analyzing={event.analysis === "analyzing"} />
    </Tag>
  );
}

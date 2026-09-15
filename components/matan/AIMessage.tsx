"use client";

import * as React from "react";
import { ThumbsUp, ThumbsDown, Copy, MoreHorizontal, CircleCheck, CircleAlert, TriangleAlert, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import { formatTime } from "@/lib/utils/format";
import { MatanBot } from "./Brand";
import type { AssistantMessage, RingEvent } from "@/lib/types";
import { EventLine } from "./EventCard";

const bannerIcons = { success: CircleCheck, warning: CircleAlert, danger: TriangleAlert, primary: Info };

export function AIMessage({
  message,
  user,
  events,
  onSuggestion,
  onOpenEvent,
  onFeedback,
  onCopy,
}: {
  message: AssistantMessage;
  user?: { name: string; avatarUrl?: string };
  events?: Record<string, RingEvent>;
  onSuggestion?: (text: string) => void;
  onOpenEvent?: (id: string) => void;
  onFeedback?: (kind: "up" | "down") => void;
  onCopy?: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex items-end justify-end gap-3 animate-fade-up">
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-br-md bg-gradient-to-b from-primary-2 to-primary px-4 py-2.5 text-[14.5px] text-white shadow-[0_8px_24px_rgba(18,168,255,0.3)]">{message.content}</div>
          <p className="mt-1 text-right text-[11px] text-text-3">{formatTime(message.timestamp)}</p>
        </div>
        {user && <Avatar name={user.name} src={user.avatarUrl} size="md" />}
      </div>
    );
  }

  const related = message.relatedEventIds?.map((id) => events?.[id]).filter((e): e is RingEvent => Boolean(e)) ?? [];
  const Banner = message.banner ? bannerIcons[message.banner.tone] : null;

  return (
    <div className="flex items-start gap-3 animate-fade-up">
      <MatanBot size={40} className="mt-1" />
      <div className="min-w-0 max-w-[92%] flex-1">
        <div className="card-inset rounded-2xl rounded-tl-md px-4 py-3.5 text-[14.5px] leading-relaxed text-text">
          {message.content.split("\n").map((line, i) => (
            <p key={i} className={i > 0 ? "mt-1" : undefined}>
              {line}
            </p>
          ))}
          {message.chips && message.chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.chips.map((c) => {
                const t = toneStyles[(c.tone as Tone) ?? "primary"];
                return (
                  <span key={c.label} className="inline-flex min-w-[84px] flex-col items-center gap-1 rounded-xl border border-border bg-surface-2/70 px-3 py-2">
                    <span className={cn("inline-flex items-center gap-1.5 text-lg font-bold leading-none tabular-nums", t.text)}>
                      <Icon name={c.icon} className="size-4" />
                      {c.value}
                    </span>
                    <span className="text-[11px] text-text-3">{c.label}</span>
                  </span>
                );
              })}
            </div>
          )}
          {message.banner && Banner && (
            <div className={cn("mt-3 flex items-start gap-3 rounded-xl border px-3.5 py-3", toneStyles[message.banner.tone].bg, toneStyles[message.banner.tone].border)}>
              <Banner className={cn("mt-0.5 size-5 shrink-0", toneStyles[message.banner.tone].text)} aria-hidden />
              <div>
                <p className="text-[14px] font-semibold text-text">{message.banner.title}</p>
                {message.banner.subtitle && <p className={cn("text-[13px]", toneStyles[message.banner.tone].text)}>{message.banner.subtitle}</p>}
              </div>
            </div>
          )}
          {message.highlights && message.highlights.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] font-semibold text-text-2">Key highlights:</p>
              <ul className="mt-1.5 space-y-1 text-[13.5px] text-text-2">
                {message.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[9px] size-1 shrink-0 rounded-full bg-text-3" aria-hidden />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {related.length > 0 && (
            <div className="mt-3 space-y-1 rounded-xl border border-border bg-bg/40 p-1.5">
              {related.map((e) => (
                <EventLine key={e.id} event={e} onClick={onOpenEvent ? () => onOpenEvent(e.id) : undefined} showDay />
              ))}
            </div>
          )}
          {message.suggestions && message.suggestions.length > 0 && onSuggestion && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => onSuggestion(s)} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/8 px-3 py-1.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-primary/16">
                  {s}
                  <ChevronRight className="size-3" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="text-[11px] text-text-3">{formatTime(message.timestamp)}</span>
          <div className="flex items-center gap-0.5 text-text-3">
            <button type="button" aria-label="Helpful" onClick={() => onFeedback?.("up")} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-surface-3 hover:text-success transition-colors">
              <ThumbsUp className="size-3.5" />
            </button>
            <button type="button" aria-label="Not helpful" onClick={() => onFeedback?.("down")} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-surface-3 hover:text-danger transition-colors">
              <ThumbsDown className="size-3.5" />
            </button>
            <button type="button" aria-label="Copy message" onClick={onCopy} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-surface-3 hover:text-text transition-colors">
              <Copy className="size-3.5" />
            </button>
            <button type="button" aria-label="More" className="inline-flex size-7 items-center justify-center rounded-md hover:bg-surface-3 hover:text-text transition-colors">
              <MoreHorizontal className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in" aria-live="polite" aria-label="Matan AI is thinking">
      <MatanBot size={40} />
      <div className="card-inset flex items-center gap-1.5 rounded-2xl rounded-tl-md px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} aria-hidden />
        ))}
        <span className="ml-1 text-[13px] text-text-3">Matan is thinking…</span>
      </div>
    </div>
  );
}

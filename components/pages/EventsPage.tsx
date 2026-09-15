"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  SlidersHorizontal,
  Users,
  Package,
  Car,
  PawPrint,
  Bell,
  LayoutGrid,
  MoreHorizontal,
  Play,
  Download,
  Share2,
  Video,
  Maximize2,
  Sparkles,
  Clock,
  Lightbulb,
  Star,
  CheckCheck,
  Trash2,
  TriangleAlert,
  CircleCheck,
  Inbox,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useAppData } from "@/components/layout/AppDataProvider";
import { Tabs } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Menu } from "@/components/ui/Menu";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import { Icon, eventTypeIcon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EventRow } from "@/components/matan/EventCard";
import { RiskBadge } from "@/components/matan/RiskBadge";
import { ActivityTimeline } from "@/components/matan/ActivityTimeline";
import { eventsApi, type EventListResponse } from "@/lib/api/events";
import { useDebounce } from "@/hooks/useDebounce";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { rangeLabel } from "@/lib/mock/insights";
import { cn } from "@/lib/utils/cn";
import { eventTypeTone, toneStyles, priorityLabel } from "@/lib/utils/tones";
import { formatDuration, formatTime, formatTimeWithSeconds, formatWeekdayDate, relativeDay } from "@/lib/utils/format";
import type { EventPriority, InsightRange, RingEvent } from "@/lib/types";

const categoryTabs = [
  { value: "all", label: "All Events", icon: <LayoutGrid /> },
  { value: "people", label: "People", icon: <Users /> },
  { value: "packages", label: "Packages", icon: <Package /> },
  { value: "vehicles", label: "Vehicles", icon: <Car /> },
  { value: "animals", label: "Animals", icon: <PawPrint /> },
  { value: "doorbell", label: "Doorbell", icon: <Bell /> },
  { value: "others", label: "Others", icon: <MoreHorizontal /> },
];

const rangeOptions: { value: InsightRange; label: string }[] = [
  { value: "today", label: rangeLabel("today") },
  { value: "7d", label: rangeLabel("7d") },
  { value: "30d", label: rangeLabel("30d") },
  { value: "custom", label: rangeLabel("custom") },
];

const sortOptions = [
  { value: "priority", label: "Smart", description: "What matters first, then newest" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
] as const;

type Sort = (typeof sortOptions)[number]["value"];

const PAGE_SIZE = 12;

export function EventsPage({ initialEventId }: { initialEventId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: app, refresh: refreshApp } = useAppData();
  const isWide = useMediaQuery("(min-width: 1280px)");

  const [search, setSearch] = React.useState(params.get("search") ?? "");
  const debouncedSearch = useDebounce(search, 250);
  const [category, setCategory] = React.useState(params.get("category") ?? "all");
  const [range, setRange] = React.useState<InsightRange>((params.get("range") as InsightRange) ?? "7d");
  const [priorities, setPriorities] = React.useState<EventPriority[]>((params.get("priority")?.split(",").filter(Boolean) as EventPriority[]) ?? []);
  const [cameraId, setCameraId] = React.useState<string>(params.get("cameraId") ?? "");
  const [sort, setSort] = React.useState<Sort>((params.get("sort") as Sort) ?? "priority");

  const [items, setItems] = React.useState<RingEvent[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [meta, setMeta] = React.useState<EventListResponse["meta"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(initialEventId ?? null);
  const [detail, setDetail] = React.useState<RingEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const seq = React.useRef(0);

  const query = React.useMemo(
    () => ({ search: debouncedSearch, category, range, priority: priorities, cameraId: cameraId || undefined, sort, pageSize: PAGE_SIZE }),
    [debouncedSearch, category, range, priorities, cameraId, sort],
  );

  const load = React.useCallback(
    async (page: number, append: boolean) => {
      const id = ++seq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await eventsApi.list({ ...query, page });
        if (id !== seq.current) return;
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setCounts(res.categoryCounts);
        setMeta(res.meta);
      } catch (e) {
        if (id === seq.current) setError(e instanceof Error ? e.message : "Failed to load events");
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query],
  );

  React.useEffect(() => {
    void load(1, false);
  }, [load]);

  // Keep a selection: the initial id, else the first visible event.
  React.useEffect(() => {
    if (loading) return;
    if (selectedId && items.some((e) => e.id === selectedId)) return;
    if (selectedId && initialEventId === selectedId && !detail) return; // will be fetched below
    if (items.length && isWide) setSelectedId(items[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading, isWide]);

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const local = items.find((e) => e.id === selectedId);
    if (local) {
      setDetail(local);
      return;
    }
    let cancelled = false;
    eventsApi
      .get(selectedId)
      .then((e) => !cancelled && setDetail(e))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [selectedId, items]);

  const select = (e: RingEvent) => {
    setSelectedId(e.id);
    if (!isWide) setDrawerOpen(true);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `/events/${e.id}`);
  };

  const updateEvent = (updated: RingEvent) => {
    setItems((list) => list.map((e) => (e.id === updated.id ? updated : e)));
    setDetail((d) => (d?.id === updated.id ? updated : d));
  };

  const toggleAction = async (event: RingEvent, actionId: string) => {
    const optimistic = { ...event, recommendedActions: event.recommendedActions?.map((a) => (a.id === actionId ? { ...a, done: !a.done } : a)) };
    updateEvent(optimistic);
    try {
      const saved = await eventsApi.update(event.id, { actionId });
      updateEvent(saved);
    } catch {
      updateEvent(event);
      toast.error();
    }
  };

  const setPriority = async (event: RingEvent, priority: EventPriority) => {
    try {
      const saved = await eventsApi.update(event.id, { priority });
      updateEvent(saved);
      toast.success(priority === "important" ? "Event marked important" : `Event marked as ${priorityLabel[priority].toLowerCase()}`);
      void refreshApp();
    } catch {
      toast.error();
    }
  };

  const toggleStar = async (event: RingEvent) => {
    try {
      const saved = await eventsApi.update(event.id, { starred: !event.starred });
      updateEvent(saved);
      toast.success(saved.starred ? "Added to starred events" : "Removed from starred events");
    } catch {
      toast.error();
    }
  };

  const markReviewed = async (event: RingEvent) => {
    try {
      const saved = await eventsApi.update(event.id, { reviewed: true });
      updateEvent(saved);
      toast.success("Event marked as reviewed");
    } catch {
      toast.error();
    }
  };

  const remove = async (event: RingEvent) => {
    const ok = await confirm({
      title: "Delete this event?",
      description: `"${event.title}" at ${event.location} will be removed from your history. This can't be undone.`,
      confirmLabel: "Delete event",
    });
    if (!ok) return;
    try {
      await eventsApi.remove(event.id);
      setItems((list) => list.filter((e) => e.id !== event.id));
      setSelectedId(null);
      setDrawerOpen(false);
      toast.success("Event deleted");
      void refreshApp();
    } catch {
      toast.error();
    }
  };

  const share = async (event: RingEvent) => {
    const url = `${window.location.origin}/events/${event.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", "Share it with a family member.");
    } catch {
      toast.info("Share link", url);
    }
  };

  const download = (event: RingEvent) => toast.success("Clip download started", `${event.title} · ${formatDuration(event.clipDuration ?? 15)}`);

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setPriorities([]);
    setCameraId("");
    setRange("7d");
    setSort("priority");
  };

  const hasFilters = Boolean(search || category !== "all" || priorities.length || cameraId || range !== "7d");
  const activeFilterCount = priorities.length + (cameraId ? 1 : 0);

  const tabs = categoryTabs.map((t) => ({ ...t, count: counts[t.value] ?? 0 }));

  const detailProps = detail
    ? {
        event: detail,
        onToggleAction: (id: string) => void toggleAction(detail, id),
        onSetPriority: (p: EventPriority) => void setPriority(detail, p),
        onStar: () => void toggleStar(detail),
        onReviewed: () => void markReviewed(detail),
        onDelete: () => void remove(detail),
        onShare: () => void share(detail),
        onDownload: () => download(detail),
      }
    : null;

  return (
    <>
      <Topbar
        title="Events"
        subtitle="Intelligent events, not just motion. Matan AI understands the full story."
        search={{ value: search, onChange: setSearch, placeholder: "Search events…" }}
        actions={
          <>
            <Select value={range} onChange={setRange} options={rangeOptions} label="Date range" prefix={undefined} buttonClassName="min-w-[13rem]" align="end" />
            <FilterButton
              priorities={priorities}
              onPriorities={setPriorities}
              cameraId={cameraId}
              onCamera={setCameraId}
              cameras={(app?.devices ?? []).filter((d) => d.kind === "camera" || d.kind === "doorbell").map((d) => ({ value: d.id, label: d.name }))}
              count={activeFilterCount}
            />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={tabs} value={category} onChange={setCategory} aria-label="Event categories" className="max-w-full" />
        <Select value={sort} onChange={setSort} options={[...sortOptions]} prefix="Sort by" size="sm" align="end" label="Sort events" />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="xl:col-span-7 2xl:col-span-7" aria-label="Event list">
          {error ? (
            <ErrorState onRetry={() => void load(1, false)} message={error} />
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[98px] rounded-card" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Inbox />}
                title="No events match your filters"
                description="Try a wider date range or clear your search. Matan AI only shows events that were actually analyzed."
                action={
                  hasFilters ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <ul className="space-y-3" role="list">
                {items.map((e) => (
                  <li key={e.id}>
                    <EventRow event={e} selected={e.id === selectedId} onSelect={select} />
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-text-3">
                <span>
                  Showing {items.length} of {meta?.total ?? items.length} events
                </span>
                {meta?.hasMore && (
                  <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => void load((meta?.page ?? 1) + 1, true)} rightIcon={<ChevronDown className="size-4" />}>
                    Load more
                  </Button>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="hidden xl:block xl:col-span-5" aria-label="Event details">
          <div className="sticky top-6">
            {detailProps ? (
              <EventDetail {...detailProps} />
            ) : loading ? (
              <Skeleton className="h-[560px] rounded-card" />
            ) : (
              <div className="card">
                <EmptyState icon={<Sparkles />} title="Select an event" description="Pick an event from the list to see Matan's analysis, timeline and recommended actions." compact />
              </div>
            )}
          </div>
        </aside>
      </div>

      <Drawer open={drawerOpen && !isWide} onClose={() => setDrawerOpen(false)} width="max-w-xl" className="[&>div]:p-4">
        {detailProps && <EventDetail {...detailProps} />}
      </Drawer>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Filter popover
--------------------------------------------------------------------------- */
function FilterButton({
  priorities,
  onPriorities,
  cameraId,
  onCamera,
  cameras,
  count,
}: {
  priorities: EventPriority[];
  onPriorities: (p: EventPriority[]) => void;
  cameraId: string;
  onCamera: (id: string) => void;
  cameras: { value: string; label: string }[];
  count: number;
}) {
  const { open, setOpen, rootRef, triggerRef } = usePopover();
  const toggle = (p: EventPriority) => onPriorities(priorities.includes(p) ? priorities.filter((x) => x !== p) : [...priorities, p]);
  return (
    <div ref={rootRef} className="relative">
      <Button ref={triggerRef} variant="secondary" leftIcon={<SlidersHorizontal className="size-4" />} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
        Filters
        {count > 0 && (
          <Badge tone="primary" variant="solid" size="xs" className="ml-1">
            {count}
          </Badge>
        )}
      </Button>
      <PopoverPanel open={open} align="end" width="18rem" className="p-4" role="dialog" aria-label="Filter events">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-3">Priority</p>
        <div className="mt-2 space-y-1.5">
          {(["normal", "attention", "important"] as EventPriority[]).map((p) => (
            <label key={p} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-3/60">
              <span className="flex items-center gap-2.5 text-sm text-text">
                <input type="checkbox" checked={priorities.includes(p)} onChange={() => toggle(p)} className="size-4 accent-[#12a8ff]" />
                {priorityLabel[p]}
              </span>
              <RiskBadge priority={p} size="xs" variant="soft" />
            </label>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-3">Camera</p>
        <div className="mt-2">
          <Select value={cameraId || "all"} onChange={(v) => onCamera(v === "all" ? "" : v)} options={[{ value: "all", label: "All cameras" }, ...cameras]} size="sm" fullWidth label="Camera" />
        </div>
        <div className="mt-4 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onPriorities([]);
              onCamera("");
            }}
          >
            Reset
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverPanel>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Detail panel
--------------------------------------------------------------------------- */
export function EventDetail({
  event,
  onToggleAction,
  onSetPriority,
  onStar,
  onReviewed,
  onDelete,
  onShare,
  onDownload,
  compact,
}: {
  event: RingEvent;
  onToggleAction: (id: string) => void;
  onSetPriority: (p: EventPriority) => void;
  onStar: () => void;
  onReviewed: () => void;
  onDelete: () => void;
  onShare: () => void;
  onDownload: () => void;
  compact?: boolean;
}) {
  const t = toneStyles[eventTypeTone[event.type]];
  const toast = useToast();
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const duration = event.clipDuration ?? 15;

  React.useEffect(() => {
    setPlaying(false);
    setProgress(0);
  }, [event.id]);

  React.useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= duration) {
          setPlaying(false);
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playing, duration]);

  const camera = event.location.replace(/^(.*?)(\s+Camera)?$/, "$1");

  const menuItems = [
    { label: event.starred ? "Remove star" : "Star event", icon: <Star />, onSelect: onStar },
    { label: "Mark as reviewed", icon: <CheckCheck />, onSelect: onReviewed, disabled: event.reviewed },
    "separator" as const,
    ...(event.priority !== "important" ? [{ label: "Mark important", icon: <TriangleAlert />, onSelect: () => onSetPriority("important") }] : []),
    ...(event.priority !== "attention" ? [{ label: "Mark for attention", icon: <Clock />, onSelect: () => onSetPriority("attention") }] : []),
    ...(event.priority !== "normal" ? [{ label: "Mark as normal", icon: <CircleCheck />, onSelect: () => onSetPriority("normal") }] : []),
    "separator" as const,
    { label: "Delete event", icon: <Trash2 />, onSelect: onDelete, tone: "danger" as const },
  ];

  return (
    <article className={cn("card-hero p-4 sm:p-5 animate-fade-in", event.priority === "important" && "border-danger/40")} key={event.id}>
      <header className="flex items-start gap-3">
        <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-xl border", t.bg, t.border, t.text)}>
          <Icon name={eventTypeIcon[event.type]} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[22px] font-bold leading-tight text-text">{event.title}</h2>
            {event.starred && <Star className="size-4 shrink-0 fill-warning text-warning" aria-label="Starred" />}
            {event.reviewed && (
              <Badge tone="neutral" size="xs">
                Reviewed
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13.5px] text-text-2">
            {relativeDay(event.timestamp)}, {formatWeekdayDate(event.timestamp).replace(/^\w+,\s/, "")} · {formatTimeWithSeconds(event.timestamp)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RiskBadge priority={event.priority} label={event.badgeLabel} size="md" />
          <Menu items={menuItems} label="Event options" />
        </div>
      </header>

      <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl border border-border bg-surface-2">
        <SafeImage src={event.imageUrl} alt={`${event.title} at ${event.location}`} sizes="(max-width: 1280px) 100vw, 40vw" grayscale={event.priority === "important"} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/50 via-transparent to-bg/80" aria-hidden />
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-bg/60 px-3 py-1 text-[13px] font-semibold text-text backdrop-blur">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          {camera} Camera
        </div>
        <div className="absolute right-3 top-3 rounded-lg bg-bg/60 px-2.5 py-1 text-[12.5px] tabular-nums text-text backdrop-blur">
          {formatWeekdayDate(event.timestamp).replace(/^\w+,\s/, "")} · {formatTimeWithSeconds(event.timestamp)}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-3">
          <IconButton label={playing ? "Pause clip" : "Play clip"} variant="glass" onClick={() => setPlaying((p) => !p)} className="rounded-full">
            {playing ? <span className="flex gap-0.5"><span className="h-3.5 w-1 rounded-sm bg-current" /><span className="h-3.5 w-1 rounded-sm bg-current" /></span> : <Play className="fill-current" />}
          </IconButton>
          <span className="text-[12.5px] tabular-nums text-text">
            {formatDuration(progress)} / {formatDuration(duration)}
          </span>
          <div className="relative h-1.5 flex-1 rounded-full bg-white/20" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={duration} aria-label="Clip progress">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(progress / duration) * 100}%` }} />
          </div>
          <IconButton label="Fullscreen" variant="glass" size="sm" onClick={() => toast.info("Fullscreen playback isn't available for demo clips")} className="rounded-full">
            <Maximize2 />
          </IconButton>
          <IconButton label="Download clip" variant="glass" size="sm" onClick={onDownload} className="rounded-full">
            <Download />
          </IconButton>
        </div>
      </div>

      <section className="mt-4 flex items-start gap-3" aria-labelledby={`ai-${event.id}`}>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-primary text-white">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 id={`ai-${event.id}`} className="text-[15px] font-semibold text-text">
              AI Analysis <span className="font-normal text-text-3">(Amazon Nova)</span>
            </h3>
            {typeof event.confidence === "number" && (
              <span className="flex items-center gap-1.5 text-[13px] text-text-2">
                {Math.round(event.confidence * 100)}% confident
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <ChevronRight className="size-3 rotate-90" />
                </span>
              </span>
            )}
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-text-2">{event.aiAssessment ?? event.summary}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {event.tags.map((tag) => {
              const positive = /normal|recognised|known|collected|answered/i.test(tag);
              return (
                <Badge key={tag} tone={positive ? "success" : "neutral"} size="md" className={positive ? "" : "bg-surface-3/70 text-text-2"}>
                  {tag}
                </Badge>
              );
            })}
          </div>
        </div>
      </section>

      <div className={cn("mt-4 grid gap-3", !compact && "sm:grid-cols-2")}>
        <section className="card-inset p-4" aria-labelledby={`tl-${event.id}`}>
          <h3 id={`tl-${event.id}`} className="mb-3 flex items-center gap-2 text-[14.5px] font-semibold text-text">
            <Clock className="size-4 text-primary" aria-hidden />
            Event Timeline
          </h3>
          {event.timeline?.length ? (
            <ActivityTimeline compact items={event.timeline.map((s, i) => ({ id: `${event.id}-${i}`, time: formatTimeWithSeconds(s.time).replace(/\s?(AM|PM)$/, ""), title: s.label, tone: i === event.timeline!.length - 1 ? "primary" : "neutral" }))} />
          ) : (
            <ActivityTimeline compact items={[{ id: "single", time: formatTime(event.timestamp), title: event.title, tone: "primary" }]} />
          )}
        </section>
        <section className="card-inset p-4" aria-labelledby={`ra-${event.id}`}>
          <h3 id={`ra-${event.id}`} className="mb-3 flex items-center gap-2 text-[14.5px] font-semibold text-text">
            <Lightbulb className="size-4 text-warning" aria-hidden />
            Recommended Action
          </h3>
          <ul className="space-y-1.5">
            {(event.recommendedActions ?? []).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={a.done}
                  onClick={() => onToggleAction(a.id)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2/70"
                >
                  <span className={cn("mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors", a.done ? "border-success bg-success text-bg" : "border-border-strong bg-transparent")}>
                    {a.done && <CircleCheck className="size-3.5" />}
                  </span>
                  <span className={cn("text-[13.5px] leading-snug", a.done ? "text-text-2" : "text-text")}>{a.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <Button href={`/live?camera=${event.cameraId ?? ""}`} leftIcon={<Video className="size-4" />} className="flex-1 min-w-[140px]">
          View Live
        </Button>
        <Button variant="secondary" leftIcon={<Download className="size-4" />} onClick={onDownload} className="flex-1 min-w-[140px]">
          Download Clip
        </Button>
        <Button variant="secondary" leftIcon={<Share2 className="size-4" />} onClick={onShare} className="flex-1 min-w-[110px]">
          Share
        </Button>
        <Menu items={menuItems} label="More actions" triggerVariant="solid" />
      </footer>
    </article>
  );
}

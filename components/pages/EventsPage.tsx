"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Filter, LayoutGrid, Users, Package, Car, PawPrint, Bell, MoreHorizontal, ListFilter, Inbox } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import { Toggle } from "@/components/ui/Toggle";
import { EventRow } from "@/components/matan/EventCard";
import { EventDetail } from "@/components/matan/EventDetail";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDataSource } from "@/lib/data/get-data-source";
import { SourceBadge } from "@/components/experience/source-badge";
import { useExperience } from "@/components/experience/experience-provider";
import type { EventPriority, InsightRange, RingEvent } from "@/lib/types";
import { lastDaysLabel } from "@/lib/mock/clock";
import { priorityLabel, priorityTone } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";

type Category = "all" | "people" | "packages" | "vehicles" | "animals" | "doorbell" | "others";
type Sort = "newest" | "oldest" | "priority";

const rangeOptions = [
  { value: "today" as InsightRange, label: "Today" },
  { value: "7d" as InsightRange, label: lastDaysLabel(7), description: "Last 7 days" },
  { value: "30d" as InsightRange, label: "Last 30 days" },
];

const sortOptions = [
  { value: "newest" as Sort, label: "Newest" },
  { value: "oldest" as Sort, label: "Oldest" },
  { value: "priority" as Sort, label: "Priority" },
];

const PAGE = 12;

export function EventsPage({ initialEventId }: { initialEventId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const ds = useDataSource();
  const { openConnect, ring } = useExperience();
  const isRing = ds.mode === "ring";

  const [search, setSearch] = React.useState(params.get("search") ?? "");
  const debounced = useDebounce(search, 250);
  const [category, setCategory] = React.useState<Category>((params.get("category") as Category) ?? "all");
  const [range, setRange] = React.useState<InsightRange>((params.get("range") as InsightRange) ?? "7d");
  const [priorities, setPriorities] = React.useState<EventPriority[]>(() => (params.get("priority")?.split(",").filter(Boolean) as EventPriority[]) ?? []);
  const [sort, setSort] = React.useState<Sort>("newest");
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<RingEvent[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialEventId ?? null);
  const [drawerOpen, setDrawerOpen] = React.useState(Boolean(initialEventId));
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setPage(1), [debounced, category, range, priorities, sort]);

  const q = useApi(() => ds.getEvents({ search: debounced, category, range, priority: priorities, sort, page, pageSize: PAGE }), [debounced, category, range, priorities.join(","), sort, page, ds.mode]);

  React.useEffect(() => {
    if (!q.data) return;
    const fetched = q.data;
    // Only merge data that belongs to the current page (the effect also fires when `page`
    // changes before the new page has loaded), and never keep duplicate ids.
    if (fetched.meta.page !== page) return;
    setItems((prev) => {
      const merged = page === 1 ? fetched.items : [...prev, ...fetched.items];
      const seen = new Set<string>();
      return merged.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    });
  }, [q.data, page]);
  // Never mix sources: clear the list + selection when the mode changes.
  React.useEffect(() => {
    setItems([]);
    setSelectedId(null);
    setPage(1);
  }, [ds.mode]);

  // Real Mode: poll Ring history so new events and automatic analyses land without a click.
  const anyAnalyzing = items.some((e) => e.analysis === "analyzing");
  React.useEffect(() => {
    if (!isRing) return;
    const id = setInterval(() => {
      if (page === 1) void q.refetch({ silent: true });
      if (selectedId) void detailQ.refetch({ silent: true });
    }, anyAnalyzing ? 6000 : 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRing, anyAnalyzing, page, selectedId]);

  // Keep a valid selection: the deep-linked event, else the first item.
  const detailQ = useApi(() => (selectedId ? ds.getEvent(selectedId) : Promise.resolve(null)), [selectedId, ds.mode]);
  React.useEffect(() => {
    if (!selectedId && items.length) setSelectedId(items[0].id);
  }, [items, selectedId]);

  const selected = React.useMemo(() => detailQ.data ?? items.find((e) => e.id === selectedId) ?? null, [detailQ.data, items, selectedId]);

  const select = (e: RingEvent) => {
    setSelectedId(e.id);
    if (!isDesktop) setDrawerOpen(true);
    window.history.replaceState(null, "", `/events/${e.id}`);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = items.findIndex((x) => x.id === selectedId);
    const next = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (items[next]) {
      select(items[next]);
      (listRef.current?.querySelectorAll<HTMLButtonElement>("[data-row]")[next])?.focus();
    }
  };

  const onChanged = (updated: RingEvent) => {
    setItems((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    detailQ.setData(updated);
  };
  const onDeleted = (id: string) => {
    setItems((list) => list.filter((x) => x.id !== id));
    setSelectedId(null);
    setDrawerOpen(false);
  };

  const counts = q.data?.categoryCounts ?? {};
  const tabs = [
    { value: "all" as Category, label: "All Events", icon: <LayoutGrid />, count: counts.all },
    { value: "people" as Category, label: "People", icon: <Users />, count: counts.people },
    { value: "packages" as Category, label: "Packages", icon: <Package />, count: counts.packages },
    { value: "vehicles" as Category, label: "Vehicles", icon: <Car />, count: counts.vehicles },
    { value: "animals" as Category, label: "Animals", icon: <PawPrint />, count: counts.animals },
    { value: "doorbell" as Category, label: "Doorbell", icon: <Bell />, count: counts.doorbell },
    { value: "others" as Category, label: "Others", icon: <MoreHorizontal />, count: counts.others },
  ];

  const filters = usePopover();
  const togglePriority = (p: EventPriority) => setPriorities((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  const initialLoading = q.loading && page === 1;

  return (
    <>
      <Topbar
        title={<span className="flex flex-wrap items-center gap-3">Events <SourceBadge source={isRing ? (ring.state === "connected" || ring.state === "expiring" ? "ring" : "ring-expired") : "demo"} short /></span>}
        subtitle={isRing ? "Events recorded by the Ring Developer Playground. Matan AI analysis runs with the Bedrock milestone." : "Intelligent events, not just motion. Matan AI understands the full story."}
        search={{ value: search, onChange: setSearch, placeholder: "Search events…" }}
        actions={
          <>
            <Select value={range} onChange={setRange} options={rangeOptions} label="Date range" buttonClassName="min-w-[200px]" prefix={undefined} />
            <div ref={filters.rootRef} className="relative">
              <Button ref={filters.triggerRef} variant="secondary" leftIcon={<Filter className="size-4" />} onClick={() => filters.setOpen((o) => !o)} aria-expanded={filters.open} aria-haspopup="dialog">
                Filters
                {priorities.length > 0 && (
                  <Badge tone="primary" size="xs" variant="solid" className="ml-1">
                    {priorities.length}
                  </Badge>
                )}
              </Button>
              <PopoverPanel open={filters.open} align="end" width="17rem" className="p-3" role="dialog" aria-label="Filters">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Priority</p>
                <ul className="space-y-1.5">
                  {(["normal", "attention", "important"] as EventPriority[]).map((p) => (
                    <li key={p} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-3/60">
                      <Badge tone={priorityTone[p]} size="sm" uppercase>
                        {priorityLabel[p]}
                      </Badge>
                      <Toggle size="sm" checked={priorities.includes(p)} onChange={() => togglePriority(p)} label={`Filter ${priorityLabel[p]}`} />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <Button variant="ghost" size="xs" onClick={() => setPriorities([])} disabled={!priorities.length}>
                    Clear
                  </Button>
                  <Button size="xs" onClick={() => filters.setOpen(false)}>
                    Done
                  </Button>
                </div>
              </PopoverPanel>
            </div>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={tabs} value={category} onChange={setCategory} aria-label="Event categories" className="max-w-full" />
        <Select value={sort} onChange={setSort} options={sortOptions} prefix="Sort by" size="sm" align="end" label="Sort events" />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* List */}
        <div className="lg:col-span-7 xl:col-span-7" ref={listRef} onKeyDown={onListKey}>
          {q.error && !items.length ? (
            <ErrorState onRetry={() => void q.refetch()} message={q.error} />
          ) : initialLoading && !items.length ? (
            <div className="relative space-y-3 min-h-[420px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[98px] rounded-card" />
              ))}
              <LoadingOverlay label="Loading events" />
            </div>
          ) : items.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Inbox />}
                title={isRing && !debounced && category === "all" && !priorities.length ? "No Ring events recorded yet" : "No events match these filters"}
                description={isRing && !debounced && category === "all" && !priorities.length ? "Trigger a Package, Vehicle or Motion simulation in the Ring Playground, then refresh. Ring event history appears here as it is recorded." : "Try a wider date range, another category, or clear the priority filter."}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setCategory("all");
                      setPriorities([]);
                      setRange("7d");
                    }}
                    leftIcon={<ListFilter className="size-4" />}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="relative">
              <ul className={cn("space-y-3", q.loading && "opacity-70 transition-opacity")} role="listbox" aria-label="Events" aria-activedescendant={selectedId ?? undefined}>
                {items.map((e) => (
                  <li key={e.id} id={e.id} role="option" aria-selected={e.id === selectedId}>
                    <EventRow event={e} selected={e.id === selectedId} onSelect={select} data-row />
                  </li>
                ))}
              </ul>
              {q.data?.meta.hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button variant="secondary" onClick={() => setPage((p) => p + 1)} loading={q.loading && page > 1}>
                    Load more ({q.data.meta.total - items.length} remaining)
                  </Button>
                </div>
              )}
              {!q.data?.meta.hasMore && items.length > 0 && (
                <p className="mt-4 text-center text-[12.5px] text-text-3">
                  Showing all {items.length} events · <CalendarDays className="inline size-3.5 -mt-0.5" /> {rangeOptions.find((r) => r.value === range)?.label}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Detail (desktop) */}
        <aside className="hidden lg:block lg:col-span-5 xl:col-span-5">
          <div className="card sticky top-6 p-5">
            {selected ? (
              <EventDetail key={selected.id} event={selected} onChange={onChanged} onDeleted={onDeleted} compact />
            ) : detailQ.loading || initialLoading ? (
              <div className="relative min-h-[520px] space-y-4">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="aspect-video w-full rounded-2xl" />
                <Skeleton className="h-24 w-full" />
                <LoadingOverlay label="Loading event" />
              </div>
            ) : (
              <EmptyState title="Select an event" description="Choose an event from the list to see Matan AI's analysis, timeline and recommended actions." compact />
            )}
          </div>
        </aside>
      </div>

      {/* Detail (mobile / tablet drawer) */}
      <Drawer open={drawerOpen && !isDesktop} onClose={() => setDrawerOpen(false)} title={selected?.title ?? "Event"} description={selected ? selected.location : undefined} width="max-w-xl">
        {selected && <EventDetail key={selected.id} event={selected} onChange={onChanged} onDeleted={onDeleted} compact />}
      </Drawer>
    </>
  );
}

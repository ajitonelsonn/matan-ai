"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Video, Users, Package, Car, PawPrint, CircleAlert, TriangleAlert, TrendingUp, Clock, Sparkles, FileText, Target, Lightbulb, ChevronRight, Activity } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { MetricCard } from "@/components/matan/MetricCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { AIInsightCard, AICallout } from "@/components/matan/AIInsightCard";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { HBarList } from "@/components/charts/HBarList";
import { TimeOfDayHeatmap } from "@/components/charts/Heatmap";
import { useApi } from "@/hooks/useApi";
import { useDataSource } from "@/lib/data/get-data-source";
import { SourceBadge } from "@/components/experience/source-badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useExperience } from "@/components/experience/experience-provider";
import { chartColors } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";
import type { InsightRange } from "@/lib/types";
import { isoDate, lastDaysLabel } from "@/lib/mock/clock";
import { matanApi, matanErrorFrom } from "@/lib/api/matan";
import { ApiError } from "@/lib/api/client";
import { formatTime } from "@/lib/utils/format";

const EventTrendsChart = dynamic(() => import("@/components/charts/StackedBarChart").then((m) => m.EventTrendsChart), { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> });
const DonutChart = dynamic(() => import("@/components/charts/DonutChart").then((m) => m.DonutChart), { ssr: false, loading: () => <Skeleton className="size-[168px] rounded-full" /> });

const cameraColors = [chartColors.people, chartColors.packages, chartColors.vehicles, chartColors.animals, chartColors.security, chartColors.others];

const rangeTabs = [
  { value: "today" as InsightRange, label: "Today" },
  { value: "7d" as InsightRange, label: "7 Days" },
  { value: "30d" as InsightRange, label: "30 Days" },
  { value: "custom" as InsightRange, label: "Custom" },
];

export function InsightsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [range, setRange] = React.useState<InsightRange>((params.get("range") as InsightRange) ?? "7d");
  const [search, setSearch] = React.useState("");
  const [customOpen, setCustomOpen] = React.useState(false);
  const [custom, setCustom] = React.useState({ from: isoDate(-13), to: isoDate(0) });
  const [generating, setGenerating] = React.useState(false);
  const [regenerated, setRegenerated] = React.useState(false);

  const ds = useDataSource();
  const { ring, openConnect } = useExperience();
  const isRing = ds.mode === "ring";
  const [applied, setApplied] = React.useState<{ from: string; to: string } | null>(null);
  const q = useApi(() => ds.getInsights(range, range === "custom" && isRing && applied ? applied : undefined), [range, ds.mode, applied?.from, applied?.to]);
  const d = q.data;
  const [aiSummary, setAiSummary] = React.useState<{ text: string; model: string | null; generatedAt: string; cached: boolean } | null>(null);
  React.useEffect(() => setAiSummary(null), [range, ds.mode, applied?.from, applied?.to]);
  const thinHistory = isRing && d && (d.totalHistory ?? d.counts.total) < 10;

  React.useEffect(() => {
    window.history.replaceState(null, "", range === "7d" ? "/insights" : `/insights?range=${range}`);
  }, [range]);

  const onRange = (r: InsightRange) => {
    if (r === "custom") setCustomOpen(true);
    else setRange(r);
  };

  const generate = async () => {
    setGenerating(true);
    if (!isRing) {
      // Demo Mode has no AI behind it - make that explicit instead of pretending.
      await new Promise((res) => setTimeout(res, 1300));
      setGenerating(false);
      setRegenerated(true);
      toast.info("Demo summary simulated", "Switch to Real Mode to have Matan AI (Nova) write a summary of your Ring events.");
      return;
    }
    try {
      const r = await matanApi.insightsSummary(range, range === "custom" && applied ? applied : undefined);
      setAiSummary({ text: r.summary, model: r.model, generatedAt: r.generatedAt, cached: r.cached });
      setRegenerated(true);
      if (r.model) toast.success(r.cached ? "Summary (cached)" : "Summary generated", `Matan AI (${r.model}) summarized ${r.analyzedCount} analyzed of ${r.eventCount} events.`);
      else toast.info("Nothing to summarize yet", r.summary);
    } catch (e) {
      const m = matanErrorFrom(e);
      toast.error(m?.title ?? "Summary failed", m?.message ?? (e instanceof ApiError ? e.message : "Please try again."));
    } finally {
      setGenerating(false);
    }
  };

  const match = (s: string) => !search.trim() || s.toLowerCase().includes(search.trim().toLowerCase());

  const metrics = d
    ? [
        { icon: <Video />, label: "Total Events", value: d.counts.total, delta: d.deltas.total, tone: "primary" as const },
        { icon: <Users />, label: "People", value: d.counts.byType.person, delta: d.deltas.person, tone: "primary" as const },
        { icon: <Package />, label: "Packages", value: d.counts.byType.package, delta: d.deltas.package, tone: "success" as const },
        { icon: <Car />, label: "Vehicles", value: d.counts.byType.vehicle, delta: d.deltas.vehicle, tone: "purple" as const },
        { icon: <PawPrint />, label: "Animals", value: d.counts.byType.animal, delta: d.deltas.animal, tone: "warning" as const },
        { icon: <CircleAlert />, label: "Attention", value: d.counts.attention, delta: d.deltas.attention, tone: "warning" as const, invert: true },
        { icon: <TriangleAlert />, label: "Important", value: d.counts.important, delta: d.deltas.important, tone: "danger" as const, invert: true },
      ]
    : [];

  return (
    <>
      <Topbar
        title={<span className="flex flex-wrap items-center gap-3">AI Insights <SourceBadge source={isRing ? (ring.state === "connected" || ring.state === "expiring" ? "ring" : "ring-expired") : "demo"} short /></span>}
        subtitle={isRing ? "Trends computed from your real Ring events and Matan AI analyses." : "From Ring events to meaningful insights."}
        search={{ value: search, onChange: setSearch, placeholder: "Search insights…" }}
        actions={
          <Button variant="secondary" leftIcon={<CalendarDays className="size-4" />} onClick={() => setCustomOpen(true)} className="font-medium">
            {d?.rangeLabel ?? lastDaysLabel(7)}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-text-3">
          Showing <span className="font-semibold text-text-2">{d?.counts.total ?? "…"}</span> events · {d?.rangeLabel}
        </p>
        <Tabs items={rangeTabs} value={range} onChange={onRange} variant="segmented" size="sm" aria-label="Time range" />
      </div>

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : thinHistory ? (
        <div className="card-hero relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
          <EmptyState
            icon={<Sparkles />}
            title="Building your insights"
            description="Matan AI needs more Ring events to create meaningful trends. Trigger simulations in the Ring Playground and come back - real analytics are never filled with fake numbers."
            action={
              <div className="flex flex-col items-center gap-3">
                <span className="text-[28px] font-bold tabular-nums text-text">{d?.totalHistory ?? d?.counts.total ?? 0} <span className="text-[14px] font-medium text-text-3">events currently recorded</span></span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => void q.refetch()}>Refresh</Button>
                  <Button href="/events">View Ring events</Button>
                </div>
              </div>
            }
            className="relative py-16"
          />
        </div>
      ) : (
        <div className="relative">
          {/* Metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {q.loading || !d
              ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-card" />)
              : metrics.map((m) => <MetricCard key={m.label} icon={m.icon} label={m.label} value={m.value} delta={m.delta} invertDelta={m.invert} tone={m.tone} compact />)}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-12">
            {/* Left 8 */}
            <div className="space-y-5 xl:col-span-8">
              <div className="grid gap-5 lg:grid-cols-8">
                <section className="card p-5 lg:col-span-5" aria-labelledby="trends">
                  <SectionHeader icon={<TrendingUp />} title={<span id="trends">Event Trends</span>} subtitle="Daily event count by type" />
                  {q.loading || !d ? <Skeleton className="h-[260px]" /> : <EventTrendsChart data={d.trends} />}
                </section>
                <section className="card p-5 lg:col-span-3" aria-labelledby="bycam">
                  <SectionHeader icon={<Video />} title={<span id="bycam">Activity by Camera</span>} subtitle="Which cameras see the most activity" />
                  {q.loading || !d ? (
                    <Skeleton className="h-[260px]" />
                  ) : (
                    <div className="flex flex-col items-center gap-5 2xl:flex-row 2xl:items-center">
                      <DonutChart
                        data={d.byCamera.map((c, i) => ({ name: c.name, value: c.count, color: cameraColors[i % cameraColors.length] }))}
                        size={168}
                        thickness={24}
                        center={
                          <>
                            <span className="text-[26px] font-bold leading-none text-text tabular-nums">{d.counts.total}</span>
                            <span className="text-xs text-text-3">Events</span>
                          </>
                        }
                        ariaLabel="Events per camera"
                      />
                      <ul className="w-full space-y-2 text-[13px]">
                        {d.byCamera.map((c, i) => (
                          <li key={c.cameraId} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-text-2">
                              <span className="size-2.5 rounded-full" style={{ background: cameraColors[i % cameraColors.length] }} aria-hidden />
                              {c.name}
                            </span>
                            <span className="tabular-nums text-text">
                              {c.count} <span className="text-text-3">({c.pct}%)</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="card p-5" aria-labelledby="common">
                  <SectionHeader icon={<Activity />} title={<span id="common">Common Activities</span>} subtitle="Most frequent event types" />
                  {q.loading || !d ? <Skeleton className="h-[240px]" /> : <HBarList rows={d.activities.filter((a) => match(a.label))} />}
                </section>
                <section className="card p-5" aria-labelledby="tod">
                  <SectionHeader icon={<Clock />} title={<span id="tod">Time of Day</span>} subtitle="When activity typically happens" />
                  {q.loading || !d ? <Skeleton className="h-[240px]" /> : <TimeOfDayHeatmap cells={d.heatmap} />}
                </section>
              </div>
            </div>

            {/* Right 4 */}
            <div className="space-y-5 xl:col-span-4">
              <section className="card p-5" aria-labelledby="findings">
                <SectionHeader icon={<Sparkles />} title={<span id="findings">AI Findings</span>} subtitle="Matan AI's analysis of your activity" iconTone="purple" />
                {q.loading || !d ? (
                  <Skeleton className="h-[170px]" />
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center">
                        <ProgressRing value={d.findings.normalPct} size={96} stroke={9} tone="success" label={`${d.findings.normalPct}% normal`}>
                          <span className="text-center leading-tight">
                            <span className="block text-[20px] font-bold text-text tabular-nums">{d.findings.normalPct}%</span>
                            <span className="block text-[11px] text-success">Normal</span>
                          </span>
                        </ProgressRing>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-3 text-center">
                        <CircleAlert className="size-5 text-warning" aria-hidden />
                        <span className="mt-1 text-[20px] font-bold tabular-nums text-text">{d.findings.attentionPct}%</span>
                        <span className="text-[11px] text-warning">Attention</span>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-3 text-center">
                        <TriangleAlert className="size-5 text-danger" aria-hidden />
                        <span className="mt-1 text-[20px] font-bold tabular-nums text-text">{d.findings.importantPct}%</span>
                        <span className="text-[11px] text-danger">Important</span>
                      </div>
                    </div>
                    <AICallout tone="warning" icon={<Lightbulb />} title={d.findingNote.split(".")[0] + "."} description={d.findingNote.split(".").slice(1).join(".").trim()} className="mt-4" />
                  </>
                )}
              </section>

              <section className="card p-5" aria-labelledby="summary">
                <SectionHeader
                  icon={<FileText />}
                  title={<span id="summary">Matan&apos;s Summary</span>}
                  subtitle="AI-generated summary for this period"
                  action={
                    <Button size="sm" onClick={() => void generate()} loading={generating}>
                      Generate
                    </Button>
                  }
                />
                {q.loading || !d ? (
                  <Skeleton className="h-28" />
                ) : (
                  <div className="relative min-h-[96px]">
                    <p className={cn("text-[14px] leading-relaxed text-text-2 transition-opacity", generating && "opacity-30")}>{aiSummary?.text ?? d.summary}</p>
                    {generating && <LoadingOverlay size="sm" label="Generating summary" className="bg-transparent backdrop-blur-0" />}
                    {regenerated && !generating && (
                      <Badge tone="success" size="xs" className="mt-3">
                        {aiSummary?.model ? `Written by ${aiSummary.model}${aiSummary.cached ? " · cached" : ""} · ${formatTime(aiSummary.generatedAt)}` : isRing ? "Checked just now" : "Regenerated just now (demo)"}
                      </Badge>
                    )}
                  </div>
                )}
              </section>

              <section className="card p-5" aria-labelledby="recs">
                <SectionHeader icon={<Target />} title={<span id="recs">Recommendations</span>} subtitle="Based on AI analysis" href="/automations" />
                {q.loading || !d ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {d.recommendations
                      .filter((r) => match(r.title) || match(r.description))
                      .map((r) => (
                        <li key={r.id}>
                          <AIInsightCard
                            icon={r.icon}
                            title={r.title}
                            description={r.description}
                            tone={r.tone}
                            onClick={() => (r.href === "#connect-ring" ? openConnect() : router.push(r.href ?? (r.id === "rec-1" ? "/events?range=today" : r.id === "rec-2" ? "/automations?create=1&trigger=Package%20detected" : "/settings?tab=notifications")))}
                            trailing={<ChevronRight className="size-4 text-text-3" />}
                          />
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {q.loading && d && <LoadingOverlay label="Updating insights" className="rounded-hero" />}
        </div>
      )}

      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="Custom date range"
        description="Pick the period Matan AI should analyze."
        icon={<CalendarDays />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (custom.from > custom.to) {
                  toast.error("Invalid range", "The start date must be before the end date.");
                  return;
                }
                setApplied({ from: custom.from, to: custom.to });
                setRange("custom");
                setCustomOpen(false);
                toast.success("Range applied", `${custom.from} → ${custom.to}`);
              }}
            >
              Apply range
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="from">
            <Input id="from" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} data-autofocus />
          </Field>
          <Field label="To" htmlFor="to">
            <Input id="to" type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-text-3">{isRing ? "Real Mode: the range is applied to your Ring event history (up to 90 days, ending today at the latest)." : `Demo data covers ${lastDaysLabel(30)}. Custom ranges use the last 14 days.`}</p>
      </Modal>
    </>
  );
}

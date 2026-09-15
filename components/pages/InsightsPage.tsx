"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Video, Users, Package, Car, PawPrint, TriangleAlert, Siren, TrendingUp, Sparkles, FileText, Target, Lightbulb, Clock, Activity } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { ProgressRing } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { MetricCard } from "@/components/matan/MetricCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { AIInsightCard, AICallout } from "@/components/matan/AIInsightCard";
import { HBarList } from "@/components/charts/HBarList";
import { TimeOfDayHeatmap } from "@/components/charts/Heatmap";
import { useApi } from "@/hooks/useApi";
import { insightsApi } from "@/lib/api/insights";
import { chartColors } from "@/lib/utils/tones";
import type { InsightRange } from "@/lib/types";

const EventTrendsChart = dynamic(() => import("@/components/charts/StackedBarChart").then((m) => m.EventTrendsChart), { ssr: false, loading: () => <Skeleton className="h-[290px]" /> });
const DonutChart = dynamic(() => import("@/components/charts/DonutChart").then((m) => m.DonutChart), { ssr: false, loading: () => <Skeleton className="size-[168px] rounded-full" /> });

const rangeTabs: { value: InsightRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "custom", label: "Custom" },
];

const cameraColors = [chartColors.people, chartColors.packages, chartColors.vehicles, chartColors.animals, "#26c6ff", chartColors.others];

export function InsightsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [range, setRange] = React.useState<InsightRange>((params.get("range") as InsightRange) ?? "7d");
  const [search, setSearch] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const q = useApi(() => insightsApi.get(range), [range]);
  const d = q.data;

  const changeRange = (r: InsightRange) => {
    setRange(r);
    window.history.replaceState(null, "", r === "7d" ? "/insights" : `/insights?range=${r}`);
  };

  const generate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1200));
    setGenerating(false);
    toast.success("Summary regenerated", "Matan re-read the period and refreshed its summary.");
  };

  const s = search.trim().toLowerCase();
  const recs = (d?.recommendations ?? []).filter((r) => !s || `${r.title} ${r.description}`.toLowerCase().includes(s));
  const acts = (d?.activities ?? []).filter((a) => !s || a.label.toLowerCase().includes(s));

  return (
    <>
      <Topbar
        title="AI Insights"
        subtitle="From Ring events to meaningful insights."
        search={{ value: search, onChange: setSearch, placeholder: "Search insights…" }}
        actions={
          <div className="inline-flex h-10.5 items-center gap-2 rounded-control border border-border bg-surface-2/80 px-3.5 text-sm font-medium text-text">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            {d?.rangeLabel ?? <Skeleton className="h-3.5 w-28" />}
          </div>
        }
      />

      <div className="mb-4 flex justify-end">
        <Tabs items={rangeTabs} value={range} onChange={changeRange} variant="segmented" size="sm" aria-label="Insight range" />
      </div>

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
            {q.loading || !d ? (
              Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-card" />)
            ) : (
              <>
                <MetricCard compact icon={<Video />} label="Total Events" value={d.counts.total} delta={d.deltas.total} deltaLabel="vs last period" tone="primary" />
                <MetricCard compact icon={<Users />} label="People" value={d.counts.byType.person} delta={d.deltas.person} tone="primary" />
                <MetricCard compact icon={<Package />} label="Packages" value={d.counts.byType.package} delta={d.deltas.package} tone="primary" />
                <MetricCard compact icon={<Car />} label="Vehicles" value={d.counts.byType.vehicle} delta={d.deltas.vehicle} tone="primary" />
                <MetricCard compact icon={<PawPrint />} label="Animals" value={d.counts.byType.animal} delta={d.deltas.animal} tone="primary" />
                <MetricCard compact icon={<TriangleAlert />} label="Attention" value={d.counts.attention} delta={d.deltas.attention} invertDelta tone="warning" />
                <MetricCard compact icon={<Siren />} label="Important" value={d.counts.important} delta={d.deltas.important} invertDelta tone="danger" />
              </>
            )}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-12">
            <div className="space-y-5 xl:col-span-8">
              <div className="grid gap-5 2xl:grid-cols-[3fr_2fr]">
                <section className="card p-5" aria-labelledby="trends-title">
                  <SectionHeader icon={<TrendingUp />} title={<span id="trends-title">Event Trends</span>} subtitle="Daily event count by type" className="mb-2" />
                  {q.loading || !d ? <Skeleton className="h-[290px]" /> : d.trends.length ? <EventTrendsChart data={d.trends} height={range === "today" ? 200 : 260} /> : <EmptyState compact title="No events in this period" />}
                </section>
                <section className="card p-5" aria-labelledby="camera-title">
                  <SectionHeader icon={<Video />} title={<span id="camera-title">Activity by Camera</span>} subtitle="Which cameras see the most activity" className="mb-2" />
                  {q.loading || !d ? (
                    <Skeleton className="h-[260px]" />
                  ) : (
                    <div className="flex flex-wrap items-center gap-5">
                      <DonutChart
                        data={d.byCamera.map((c, i) => ({ name: c.name, value: c.count, color: cameraColors[i % cameraColors.length] }))}
                        size={168}
                        thickness={24}
                        ariaLabel="Events per camera"
                        center={
                          <>
                            <span className="text-[26px] font-bold leading-none text-text">{d.counts.total}</span>
                            <span className="text-[12px] text-text-3">Events</span>
                          </>
                        }
                      />
                      <ul className="min-w-[170px] flex-1 space-y-2 text-[13.5px]">
                        {d.byCamera.map((c, i) => (
                          <li key={c.cameraId} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-text-2">
                              <span className="size-2.5 rounded-full" style={{ background: cameraColors[i % cameraColors.length] }} aria-hidden />
                              {c.name}
                            </span>
                            <span className="tabular-nums text-text">
                              <span className="font-semibold">{c.count}</span> <span className="text-text-3">({c.pct}%)</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <section className="card p-5" aria-labelledby="activities-title">
                  <SectionHeader icon={<Activity />} title={<span id="activities-title">Common Activities</span>} subtitle="Most frequent event types" className="mb-3" />
                  {q.loading || !d ? <Skeleton className="h-[240px]" /> : acts.length ? <HBarList rows={acts} /> : <EmptyState compact title="No matching activities" />}
                </section>
                <section className="card p-5" aria-labelledby="tod-title">
                  <SectionHeader icon={<Clock />} title={<span id="tod-title">Time of Day</span>} subtitle="When activity typically happens" className="mb-3" />
                  {q.loading || !d ? <Skeleton className="h-[240px]" /> : <TimeOfDayHeatmap cells={d.heatmap} />}
                </section>
              </div>
            </div>

            <div className="space-y-5 xl:col-span-4">
              <section className="card p-5" aria-labelledby="findings-title">
                <SectionHeader icon={<Sparkles />} title={<span id="findings-title">AI Findings</span>} subtitle="Matan AI's analysis of your activity" iconTone="purple" className="mb-4" />
                {q.loading || !d ? (
                  <Skeleton className="h-[170px]" />
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <ProgressRing value={d.findings.normalPct} size={96} stroke={9} tone="success" label={`${d.findings.normalPct}% normal`}>
                          <div className="text-center leading-none">
                            <div className="text-[20px] font-bold text-text">{d.findings.normalPct}%</div>
                            <div className="mt-0.5 text-[11px] text-success">Normal</div>
                          </div>
                        </ProgressRing>
                      </div>
                      <button type="button" onClick={() => router.push(`/events?range=${range}&priority=attention`)} className="card-inset flex flex-col items-center justify-center gap-1 py-3 text-center transition-colors hover:border-warning/40">
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-warning/15 text-warning">
                          <TriangleAlert className="size-3.5" />
                        </span>
                        <span className="text-[20px] font-bold leading-none text-text">{d.findings.attentionPct}%</span>
                        <span className="text-[11.5px] text-warning">Attention</span>
                      </button>
                      <button type="button" onClick={() => router.push(`/events?range=${range}&priority=important`)} className="card-inset flex flex-col items-center justify-center gap-1 py-3 text-center transition-colors hover:border-danger/40">
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-danger/15 text-danger">
                          <Siren className="size-3.5" />
                        </span>
                        <span className="text-[20px] font-bold leading-none text-text">{d.findings.importantPct}%</span>
                        <span className="text-[11.5px] text-danger">Important</span>
                      </button>
                    </div>
                    <AICallout tone="warning" icon={<Lightbulb />} title={d.findingNote.split(".")[0] + "."} description={d.findingNote.split(".").slice(1).join(".").trim()} className="mt-4" />
                  </>
                )}
              </section>

              <section className="card p-5" aria-labelledby="summary-title">
                <SectionHeader
                  icon={<FileText />}
                  title={<span id="summary-title">Matan&apos;s Summary</span>}
                  subtitle="AI-generated summary for this period"
                  action={
                    <Button size="sm" onClick={() => void generate()} loading={generating} leftIcon={<Sparkles className="size-4" />}>
                      Generate
                    </Button>
                  }
                  className="mb-3"
                />
                {q.loading || !d ? <Skeleton className="h-24" /> : <p className="text-[14.5px] leading-relaxed text-text-2">{d.summary}</p>}
              </section>

              <section className="card p-5" aria-labelledby="recs-title">
                <SectionHeader icon={<Target />} title={<span id="recs-title">Recommendations</span>} subtitle="Based on AI analysis" href="/automations" className="mb-3" />
                {q.loading || !d ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14" />
                    ))}
                  </div>
                ) : recs.length ? (
                  <ul className="space-y-2">
                    {recs.map((r) => (
                      <li key={r.id}>
                        <AIInsightCard
                          icon={r.icon}
                          title={r.title}
                          description={r.description}
                          tone={r.tone}
                          onClick={() => router.push(r.id === "rec-1" ? "/events?range=today" : r.id === "rec-2" ? "/automations?create=1&preset=package" : "/settings?tab=notifications")}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="No matching recommendations" />
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

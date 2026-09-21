"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Video, Users, MapPin, Clock, Sparkles, Plus, Package, Car, Mail, Lock, Building2, FileText, BarChart3, Store, Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { useToast } from "@/components/ui/Toast";
import { MetricCard } from "@/components/matan/MetricCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { EventLine } from "@/components/matan/EventCard";
import { HBarList } from "@/components/charts/HBarList";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useAppData } from "@/components/layout/AppDataProvider";
import { useExperience } from "@/components/experience/experience-provider";
import { useApi } from "@/hooks/useApi";
import { ringDataSource } from "@/lib/data/get-data-source";
import { matanApi, matanErrorFrom } from "@/lib/api/matan";
import { ApiError } from "@/lib/api/client";
import { SourceBadge } from "./source-badge";
import { ringKindLabel } from "@/components/devices/ring-device-card";
import { formatTime, timeAgo } from "@/lib/utils/format";
import type { RingEvent } from "@/lib/types";

/**
 * Business in Real Mode: the user's Ring devices as one location, 7-day business metrics
 * computed from real analyzed events, a Nova-written summary on demand, and the real daily
 * report email. Multi-location, team roles and third-party integrations are future work and
 * are listed as such - nothing is simulated.
 */
export function RealModeBusiness() {
  const router = useRouter();
  const toast = useToast();
  const { ring, openConnect } = useExperience();
  const { data: shell } = useAppData();
  const eventsQ = useApi(() => ringDataSource.getEvents({ range: "7d", pageSize: 400 }), []);
  const events = eventsQ.data?.items ?? [];
  const live = ring.state === "connected" || ring.state === "expiring";
  const online = ring.connected.filter((d) => d.status === "online").length;
  const [summary, setSummary] = React.useState<{ text: string; model: string | null; at: string } | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [sendingReport, setSendingReport] = React.useState(false);

  const deliveries = events.filter((e) => e.type === "package");
  const vehicles = events.filter((e) => e.type === "vehicle");
  const people = events.filter((e) => e.type === "person" || e.type === "doorbell");
  const attention = events.filter((e) => e.priority !== "normal");
  const hours = busiestHours(events);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await matanApi.insightsSummary("7d");
      setSummary({ text: r.summary, model: r.model, at: r.generatedAt });
      if (r.model) toast.success(r.cached ? "Summary (cached)" : "Summary generated", `Matan AI (${r.model}) · ${r.analyzedCount} analyzed events`);
      else toast.info("Nothing to summarize yet", r.summary);
    } catch (e) {
      const m = matanErrorFrom(e);
      toast.error(m?.title ?? "Summary failed", m?.message ?? (e instanceof ApiError ? e.message : "Please try again."));
    } finally {
      setGenerating(false);
    }
  };
  const sendReport = async () => {
    setSendingReport(true);
    try {
      const r = await matanApi.sendReport();
      if (r.status === "sent") toast.success("Daily report sent", `${r.total ?? 0} events today · via ${r.provider ?? "email"}`);
      else if (r.status === "duplicate") toast.info("Report already sent", "One report per 10 minutes.");
      else if (r.status === "skipped") toast.warning("Report not sent", r.reason);
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

  const future = [
    { icon: <Building2 />, label: "Multiple locations", why: "One Playground session = one site; multi-site accounts need Ring account linking per location." },
    { icon: <Users />, label: "Team access & roles", why: "Matan accounts are single-user today (Cognito per person); shared workspaces are not built." },
    { icon: <Store />, label: "POS / visitor analytics integrations", why: "No third-party connectors in this build." },
    { icon: <FileText />, label: "Scheduled PDF reports", why: "Today's report is emailed on demand; scheduling and PDF export are not built." },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-8">
        <div>
          <p className="mb-2 text-[12px] uppercase tracking-wide text-text-3">Last 7 days · from your Ring events</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Package />} label="Deliveries" value={deliveries.length} tone="success" />
            <MetricCard icon={<Car />} label="Vehicles" value={vehicles.length} tone="purple" />
            <MetricCard icon={<Users />} label="Visitors" value={people.length} tone="primary" />
            <MetricCard icon={<Bell />} label="Attention" value={attention.length} tone="warning" />
          </div>
        </div>

        <section className="card p-5" aria-labelledby="loc-real">
          <SectionHeader icon={<MapPin />} title={<span id="loc-real">Location Status</span>} subtitle="Your Ring devices, grouped as one business location." action={<SourceBadge source={live ? "ring" : "ring-expired"} size="xs" />} />
          {ring.connected.length === 0 ? (
            <p className="text-[13.5px] text-text-3">
              No Ring devices connected.{" "}
              <button type="button" onClick={() => openConnect()} className="font-semibold text-primary hover:text-primary-2">
                Connect Ring →
              </button>
            </p>
          ) : (
            <ul className="divide-y divide-border">
              <li className="flex items-center gap-3 py-2.5">
                <span className="inline-flex size-11 items-center justify-center rounded-lg border border-border bg-surface-2 text-primary">
                  <MapPin className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-text">Ring Simulator · Playground</span>
                  <span className="block text-[12px] text-text-3">{[ring.connected[0]?.region?.state, ring.connected[0]?.region?.country].filter(Boolean).join(", ") || "Region not available"}</span>
                </span>
                <span className="text-right">
                  <StatusDot tone={live ? (online ? "success" : "danger") : "neutral"} label={live ? `${online}/${ring.connected.length} online` : `Last known ${online}/${ring.connected.length} online · session expired`} />
                </span>
              </li>
              {ring.connected.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 pl-14">
                  <span className="min-w-0 flex-1 text-[13.5px] text-text-2">
                    {d.displayName} <span className="text-text-3">· {d.model ? `Ring ${d.model}` : ringKindLabel[d.deviceType]}</span>
                  </span>
                  <Badge tone={!live ? "neutral" : d.status === "online" ? "success" : d.status === "offline" ? "danger" : "neutral"} size="xs" dot>
                    {!live ? `last known ${d.status}${d.statusReportedAt ? ` · ${timeAgo(d.statusReportedAt, new Date().toISOString())}` : ""}` : d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5" aria-labelledby="hours-real">
            <SectionHeader icon={<BarChart3 />} title={<span id="hours-real">Busiest hours</span>} subtitle="Events per hour · last 7 days" />
            {eventsQ.loading ? <Skeleton className="h-40" /> : hours.length ? <HBarList rows={hours} /> : <p className="text-[13.5px] text-text-3">No events in the last 7 days.</p>}
          </section>
          <section className="card p-5" aria-labelledby="ev-real">
            <SectionHeader icon={<Clock />} title={<span id="ev-real">Recent Events</span>} subtitle="Ring event history for this location." href="/events" />
            {eventsQ.loading ? <Skeleton className="h-24" /> : events.length === 0 ? <p className="text-[13.5px] text-text-3">No Ring events on record yet.</p> : (
              <div className="space-y-0.5">
                {events.slice(0, 5).map((e) => (
                  <EventLine key={e.id} event={e} onClick={() => router.push(`/events/${e.id}`)} showDay />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="space-y-5 xl:col-span-4">
        <section className="card p-5" aria-labelledby="ins-real">
          <SectionHeader icon={<Sparkles />} title={<span id="ins-real">AI Business Summary</span>} subtitle="Written by Matan AI from this week's analyzed events" iconTone="purple" action={<Button size="sm" onClick={() => void generate()} loading={generating}>Generate</Button>} />
          <div className="relative min-h-[80px]">
            <p className="text-[14px] leading-relaxed text-text-2">{summary?.text ?? `${events.filter((e) => e.analysis === "done").length} of ${events.length} events this week have a Matan AI analysis. Press Generate for a written summary of deliveries, visitors and anything that needed attention.`}</p>
            {generating && <LoadingOverlay size="sm" label="Generating" className="bg-transparent backdrop-blur-0" />}
            {summary?.model && <Badge tone="success" size="xs" className="mt-3">Written by {summary.model} · {formatTime(summary.at)}</Badge>}
          </div>
        </section>

        <section className="card p-5" aria-labelledby="rep-real">
          <SectionHeader icon={<Mail />} title={<span id="rep-real">Reports</span>} subtitle="Today's summary to your alert email" />
          <Button fullWidth variant="secondary" leftIcon={<Mail className="size-4" />} onClick={() => void sendReport()} loading={sendingReport}>Email today's report</Button>
          <p className="mt-2 text-[11.5px] text-text-3">Uses the same SES → SMTP transport as alerts; one report per 10 minutes. <Link href="/security-modes" className="font-semibold text-primary hover:text-primary-2">Business Mode →</Link></p>
        </section>

        <section className="card p-5" aria-labelledby="team-real">
          <SectionHeader icon={<Users />} title={<span id="team-real">Team Access</span>} subtitle="Only your Matan account has access." action={<Badge tone="neutral" size="xs" icon={<Lock className="size-2.5" />}>Future</Badge>} />
          {shell && (
            <div className="flex items-center gap-3">
              <Avatar name={shell.user.name} src={shell.user.avatarUrl} size="lg" />
              <div>
                <p className="text-[15px] font-semibold text-text">{shell.user.name}</p>
                <p className="text-[12.5px] text-text-3">Owner · {shell.user.email}</p>
              </div>
            </div>
          )}
          <Button variant="secondary" size="sm" className="mt-4" leftIcon={<Plus className="size-4" />} onClick={() => toast.info("Team access is a future integration", "Matan accounts are single-user in this build.")}>Invite team</Button>
        </section>

        <section className="card p-5" aria-labelledby="biz-future">
          <SectionHeader icon={<Lock />} title={<span id="biz-future">Future integrations</span>} iconTone="purple" />
          <ul className="space-y-2">
            {future.map((f) => (
              <li key={f.label} className="card-inset flex items-start gap-3 p-3 opacity-80">
                <span className="mt-0.5 text-text-3 [&>svg]:size-4">{f.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-text">{f.label}</span>
                  <span className="block text-[12px] text-text-3">{f.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <p className="flex items-start gap-2 text-[11.5px] text-text-3"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> Metrics come from your Ring history and Matan's analyses; no visitor counts are estimated beyond what Ring detected.</p>
      </div>
    </div>
  );
}

function busiestHours(events: RingEvent[]) {
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true });
  const m = new Map<string, number>();
  for (const e of events) {
    const h = fmt.format(new Date(e.timestamp));
    m.set(h, (m.get(h) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ key: label, label, count, icon: "Clock", tone: "primary" as const }));
}

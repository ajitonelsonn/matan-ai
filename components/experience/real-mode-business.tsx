"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Video, Users, TriangleAlert, MapPin, Clock, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { MetricCard } from "@/components/matan/MetricCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { EventLine } from "@/components/matan/EventCard";
import { AIInsightCard } from "@/components/matan/AIInsightCard";
import { useAppData } from "@/components/layout/AppDataProvider";
import { useExperience } from "@/components/experience/experience-provider";
import { useApi } from "@/hooks/useApi";
import { ringDataSource } from "@/lib/data/get-data-source";
import { SourceBadge } from "./source-badge";
import { ringKindLabel } from "@/components/devices/ring-device-card";

/** Business in Real Mode: connected Ring devices + Ring event history + Matan business rules. Nothing invented. */
export function RealModeBusiness() {
  const router = useRouter();
  const { ring, openConnect } = useExperience();
  const { data: shell } = useAppData();
  const eventsQ = useApi(() => ringDataSource.getEvents({ range: "30d", pageSize: 50 }), []);
  const events = eventsQ.data?.items ?? [];
  const live = ring.state === "connected" || ring.state === "expiring";
  const online = ring.connected.filter((d) => d.status === "online").length;

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<ShieldCheck />} label="Business Locations" value={ring.connected.length ? 1 : 0} tone="success" />
          <MetricCard icon={<Video />} label="Ring Devices" value={ring.connected.length} tone="primary" />
          <MetricCard icon={<Users />} label="Team Members" value={1} tone="purple" />
          <MetricCard icon={<TriangleAlert />} label="Events on record" value={events.length} tone="warning" />
        </div>

        <section className="card p-5" aria-labelledby="loc-real">
          <SectionHeader icon={<MapPin />} title={<span id="loc-real">Location Status</span>} subtitle="Your Ring Simulator devices, grouped as one business location." action={<SourceBadge source={live ? "ring" : "ring-expired"} size="xs" />} />
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
                  <StatusDot tone={live ? (online ? "success" : "danger") : "neutral"} label={live ? `${online}/${ring.connected.length} online` : "Connection expired"} />
                </span>
              </li>
              {ring.connected.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 pl-14">
                  <span className="min-w-0 flex-1 text-[13.5px] text-text-2">
                    {d.displayName} <span className="text-text-3">· {d.model ? `Ring ${d.model}` : ringKindLabel[d.deviceType]}</span>
                  </span>
                  <Badge tone={d.status === "online" ? "success" : d.status === "offline" ? "danger" : "neutral"} size="xs" dot>
                    {d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5" aria-labelledby="ev-real">
          <SectionHeader icon={<Clock />} title={<span id="ev-real">Recent Events</span>} subtitle="Ring event history for this location." href="/events" />
          {eventsQ.loading ? <Skeleton className="h-24" /> : events.length === 0 ? <p className="text-[13.5px] text-text-3">No Ring events on record yet.</p> : (
            <div className="space-y-0.5">
              {events.slice(0, 6).map((e) => (
                <EventLine key={e.id} event={e} onClick={() => router.push(`/events/${e.id}`)} showDay />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="space-y-5 xl:col-span-4">
        <section className="card p-5" aria-labelledby="team-real">
          <SectionHeader icon={<Users />} title={<span id="team-real">Team Access</span>} subtitle="Only your Matan account has access." />
          {shell && (
            <div className="flex items-center gap-3">
              <Avatar name={shell.user.name} src={shell.user.avatarUrl} size="lg" />
              <div>
                <p className="text-[15px] font-semibold text-text">{shell.user.name}</p>
                <p className="text-[12.5px] text-text-3">Owner · {shell.user.email}</p>
              </div>
            </div>
          )}
          <Button variant="secondary" size="sm" className="mt-4" leftIcon={<Plus className="size-4" />} onClick={() => router.push("/business?tab=team")} disabled>
            Invite team (next milestone)
          </Button>
        </section>
        <section className="card p-5" aria-labelledby="ins-real">
          <SectionHeader icon={<Sparkles />} title={<span id="ins-real">AI Business Insights</span>} iconTone="purple" />
          <AIInsightCard icon="Clock" tone="neutral" title="Awaiting Matan AI analysis" description={`${events.length} Ring events on record. Foot-traffic and delivery insights appear once the Bedrock pipeline runs.`} />
        </section>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Heart, UserRound, ShieldCheck, Lock, BellRing, Siren, Moon, PhoneCall, MessageSquare, CalendarClock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { EventLine } from "@/components/matan/EventCard";
import { CareRulesPanel } from "@/components/care/CareRulesPanel";
import { useApi } from "@/hooks/useApi";
import { careApi } from "@/lib/api/care";
import { ringDataSource } from "@/lib/data/get-data-source";
import { useExperience } from "@/components/experience/experience-provider";
import { SourceBadge } from "./source-badge";
import { cn } from "@/lib/utils/cn";

/**
 * Care & Family in Real Mode. The care model is Matan's own per-user Care Context
 * (quiet hours, sensitivity, notification preferences) and Smart Rules, applied to real
 * Ring events. There are no synthetic family members and no identity inference: Ring
 * person detections are shown as "Person detected", never as a named relative.
 */
export function RealModeCare() {
  const router = useRouter();
  const { ring, openConnect } = useExperience();
  const live = ring.state === "connected" || ring.state === "expiring";
  const careQ = useApi(() => careApi.get(), []);
  const eventsQ = useApi(() => ringDataSource.getEvents({ range: "7d", pageSize: 400 }), []);
  const care = careQ.data?.context;
  const events = eventsQ.data?.items ?? [];
  const people = events.filter((e) => e.type === "person" || e.type === "doorbell");
  const decided = events.filter((e) => e.intelligence?.careDecision && "action" in e.intelligence.careDecision);
  const count = (a: string) => decided.filter((e) => (e.intelligence!.careDecision as { action: string }).action === a).length;
  const quietHits = decided.filter((e) => (e.intelligence!.careDecision as { facts?: { quietHoursActive?: boolean } }).facts?.quietHoursActive).length;
  const emailed = events.filter((e) => e.notification?.status === "sent").length;

  const future = [
    { icon: <Users />, label: "Family members & presence", why: "Ring's API/Playground provides no household-member mapping; Matan never guesses who a detected person is." },
    { icon: <PhoneCall />, label: "Call home / two-way talk", why: "Two-way audio is not exposed to partners." },
    { icon: <MessageSquare />, label: "Message on the camera speaker", why: "Speaker playback is not available for the Playground device." },
    { icon: <CalendarClock />, label: "Check-in routines", why: "Scheduled check-ins need presence data Ring does not provide today." },
  ];

  return (
    <div className="space-y-5">
      {/* Status row */}
      <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <section className={cn("card min-w-0 p-5 xl:col-span-7", care && !care.enabled && "border-warning/40")} aria-labelledby="care-status">
          <SectionHeader icon={<Heart />} title={<span id="care-status">Care status</span>} subtitle="How Matan is looking after your home this week, from your real Ring events." iconTone="danger" />
          {careQ.loading || eventsQ.loading ? (
            <Skeleton className="h-28" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={care?.enabled ? "success" : "warning"} size="md" icon={<ShieldCheck className="size-3.5" />}>{care?.enabled ? "Care Context on" : "Care Context off"}</Badge>
                {care?.quietHours.enabled && <Badge tone="purple" size="md" icon={<Moon className="size-3.5" />}>Quiet hours {care.quietHours.start}–{care.quietHours.end}</Badge>}
                {care && <Badge tone="neutral" size="md">{care.timezone}</Badge>}
                {!care?.enabled && <span className="text-[12.5px] text-text-3">Rules are not applied until Care Context is on - turn it on below.</span>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 [&>*]:min-w-0">
                {[
                  ["Events decided", decided.length, "primary"],
                  ["Notified", count("NOTIFY"), "warning"],
                  ["Escalated", count("ESCALATE"), "danger"],
                  ["During quiet hours", quietHits, "purple"],
                ].map(([k, v, tone]) => (
                  <div key={String(k)} className="card-inset p-3">
                    <dt className="text-[11px] uppercase tracking-wide text-text-3">{k}</dt>
                    <dd className={cn("mt-1 text-[22px] font-bold tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "purple" ? "text-purple" : "text-text")}>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[12.5px] text-text-3">
                {emailed} alert {emailed === 1 ? "email" : "emails"} sent in the last 7 days · <Link href="/automations" className="font-semibold text-primary hover:text-primary-2">rule activity →</Link>
              </p>
            </>
          )}
        </section>

        <section className="min-w-0 card p-5 xl:col-span-5" aria-labelledby="fam-real">
          <SectionHeader icon={<Users />} title={<span id="fam-real">Family members</span>} subtitle="Only associations you configure explicitly would be shown." action={<Badge tone="neutral" size="xs" icon={<Lock className="size-2.5" />}>Future</Badge>} />
          <EmptyState
            compact
            icon={<UserRound />}
            title="No verified family associations"
            description="Future integration - the Ring API/Playground does not provide household-member mapping, and Matan never infers who a person is from a generic detection. Person detections stay “Person detected”."
          />
        </section>
      </div>

      {/* Real care configuration (per user, DynamoDB) */}
      <section aria-labelledby="care-config">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="care-config" className="text-[17px] font-semibold text-text">Care Context</h2>
          <Button size="sm" variant="secondary" leftIcon={<Sparkles className="size-4" />} href="/settings?tab=care">Smart Rules in Settings</Button>
        </div>
        <CareRulesPanel match={(label) => label !== "smart rules"} />
      </section>

      {/* Person detections + future integrations */}
      <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <section className="min-w-0 card p-5 xl:col-span-7" aria-labelledby="person-events">
          <SectionHeader icon={<BellRing />} title={<span id="person-events">Person & doorbell detections</span>} subtitle="Last 7 days from Ring - shown as “Person detected”, never as a named family member." action={<SourceBadge source={live ? "ring" : "ring-expired"} size="xs" />} />
          {eventsQ.loading ? (
            <Skeleton className="h-24" />
          ) : !people.length ? (
            <p className="text-[13.5px] text-text-3">
              No person or doorbell detections in the last 7 days.{" "}
              {live ? "Trigger a Motion simulation in the Playground." : (
                <button type="button" onClick={() => openConnect()} className="font-semibold text-primary hover:text-primary-2">
                  Reconnect Ring to sync.
                </button>
              )}
            </p>
          ) : (
            <div className="space-y-0.5 rounded-xl border border-border bg-bg/40 p-1.5">
              {people.slice(0, 8).map((e) => (
                <EventLine key={e.id} event={e} onClick={() => router.push(`/events/${e.id}`)} showDay />
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 card p-5 xl:col-span-5" aria-labelledby="care-future">
          <SectionHeader icon={<Lock />} title={<span id="care-future">Future integrations</span>} subtitle="Care features Matan cannot run on Ring data today" iconTone="purple" />
          <ul className="space-y-2">
            {future.map((f) => (
              <li key={f.label} className="card-inset flex items-start gap-3 p-3 opacity-80" aria-disabled="true">
                <span className="mt-0.5 text-text-3 [&>svg]:size-4">{f.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-text">{f.label}</span>
                  <span className="block text-[12px] text-text-3">{f.why}</span>
                </span>
                <Badge tone="neutral" size="xs" icon={<Lock className="size-2.5" />}>Future</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-[11.5px] text-text-3"><Siren className="mt-0.5 size-3.5 shrink-0" /> What works today for care: quiet hours, sensitivity, the Repeated Activity and High Risk rules, and email alerts - all real, all configurable above.</p>
        </section>
      </div>
    </div>
  );
}

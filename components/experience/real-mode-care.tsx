"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Heart, UserRound, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { EventLine } from "@/components/matan/EventCard";
import { useApi } from "@/hooks/useApi";
import { familyApi } from "@/lib/api/family";
import { ringDataSource } from "@/lib/data/get-data-source";
import { useExperience } from "@/components/experience/experience-provider";
import { SourceBadge } from "./source-badge";
import { toneStyles } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";

/**
 * Care & Family in Real Mode. No synthetic family members and no identity
 * inference from generic Ring person detections - only "Person detected".
 */
export function RealModeCare() {
  const router = useRouter();
  const toast = useToast();
  const { ring, openConnect } = useExperience();
  const eventsQ = useApi(() => ringDataSource.getEvents({ category: "people", range: "30d", pageSize: 20 }), []);
  const featuresQ = useApi(() => familyApi.get(), []);
  const live = ring.state === "connected" || ring.state === "expiring";

  const setFeature = async (id: string, enabled: boolean) => {
    try {
      const res = await familyApi.setFeature(id, enabled);
      featuresQ.setData(res);
      toast.success(`${res.features.find((f) => f.id === id)?.label} ${enabled ? "enabled" : "disabled"}`, "Matan-level care policy");
    } catch {
      toast.error();
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <section className="card p-5 xl:col-span-7" aria-labelledby="fam-real">
        <SectionHeader icon={<Users />} title={<span id="fam-real">Family members</span>} subtitle="Only associations you configure explicitly are shown." />
        <EmptyState
          compact
          icon={<UserRound />}
          title="No verified family associations yet"
          description="Coming in a future integration - the current Ring API/Playground does not provide household-member mapping. Matan never infers who a person is from a generic Ring detection, and never calls people you configure here Ring family members."
          action={
            <Button variant="secondary" leftIcon={<Plus className="size-4" />} onClick={() => toast.info("Verified family mapping is part of a later milestone", "In Real Mode, Matan shows 'Person detected' rather than guessing a name.")}>
              Add family member
            </Button>
          }
        />
      </section>

      <section className="card p-5 xl:col-span-5" aria-labelledby="care-feat">
        <SectionHeader icon={<Heart />} title={<span id="care-feat">Care Features</span>} subtitle="Matan-level policies - active in both modes." iconTone="danger" />
        {featuresQ.loading ? (
          <Skeleton className="h-52" />
        ) : (
          <ul className="space-y-3">
            {(featuresQ.data?.features ?? []).map((f) => {
              const t = toneStyles[f.tone];
              return (
                <li key={f.id} className="flex items-start gap-3">
                  <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border", t.bg, t.border, t.text)}>
                    <Icon name={f.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-text">{f.label}</span>
                    <span className="block text-[12.5px] text-text-3">{f.description}</span>
                  </span>
                  <Toggle checked={f.enabled} onChange={(v) => void setFeature(f.id, v)} label={f.label} size="sm" className="mt-1" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-5 xl:col-span-12" aria-labelledby="person-events">
        <SectionHeader icon={<ShieldCheck />} title={<span id="person-events">Person detections from Ring</span>} subtitle="Shown as “Person detected” - never as a named family member." action={<SourceBadge source={live ? "ring" : "ring-expired"} size="xs" />} />
        {eventsQ.loading ? (
          <Skeleton className="h-24" />
        ) : !eventsQ.data?.items.length ? (
          <p className="text-[13.5px] text-text-3">
            No person detections in Ring history yet.{" "}
            {live ? "Trigger a Motion simulation in the Playground." : (
              <button type="button" onClick={() => openConnect()} className="font-semibold text-primary hover:text-primary-2">
                Reconnect Ring to sync.
              </button>
            )}
          </p>
        ) : (
          <div className="space-y-0.5 rounded-xl border border-border bg-bg/40 p-1.5">
            {eventsQ.data.items.slice(0, 8).map((e) => (
              <EventLine key={e.id} event={e} onClick={() => router.push(`/events/${e.id}`)} showDay />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import * as React from "react";
import { Check, Minus, HelpCircle, Lock, UserRound, Users, Radio, Speaker, CreditCard, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { capabilityRows, configurationRows, futureFeatures, regionLabel, type FutureFeature } from "@/lib/ring/capabilities";
import type { ConnectedRingDevice, RingAccount } from "@/lib/ring/types";
import { formatDate, formatTime } from "@/lib/utils/format";

/** Capability-aware matrix: ✓ only when Ring reported it; "— Unavailable" when Ring reported null; "?" when unknown. */
export function RingCapabilityMatrix({ device, compact }: { device: ConnectedRingDevice; compact?: boolean }) {
  const rows = capabilityRows(device.details);
  if (!rows.length) return <p className="text-[12.5px] text-text-3">Capabilities were not returned by Ring for this device.</p>;
  const primary = rows.filter((r) => ["video", "motion", "snapshot", "nightVision", "privacyZones", "audio", "battery"].includes(r.key));
  const sensors = rows.filter((r) => !primary.includes(r));
  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <li className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 odd:bg-surface-2/40">
      <span className="min-w-0">
        <span className={cn("text-[13px]", r.state === "yes" ? "text-text" : "text-text-3")}>{r.label}</span>
        {r.detail && r.state === "yes" && <span className="ml-2 text-[11.5px] text-text-3">{r.detail}</span>}
      </span>
      {r.state === "yes" ? (
        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-success"><Check className="size-3.5" aria-hidden /> Yes</span>
      ) : r.state === "no" ? (
        <span className="inline-flex items-center gap-1 text-[12.5px] text-text-3"><Minus className="size-3.5" aria-hidden /> Unavailable</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[12.5px] text-text-3" title="Ring did not return this capability resource"><HelpCircle className="size-3.5" aria-hidden /> Unknown</span>
      )}
    </li>
  );
  return (
    <div className="space-y-3">
      <ul className="space-y-0.5" aria-label="Device capabilities reported by Ring">
        {primary.map((r) => <Row key={r.key} r={r} />)}
      </ul>
      {!compact && (
        <details className="group">
          <summary className="cursor-pointer select-none text-[12px] text-text-3 hover:text-text-2">Sensor capabilities ({sensors.filter((r) => r.state === "yes").length} of {sensors.length} reported)</summary>
          <ul className="mt-1 space-y-0.5">{sensors.map((r) => <Row key={r.key} r={r} />)}</ul>
        </details>
      )}
      <p className="text-[11.5px] text-text-3">Read-only facts from the Ring Devices API · capability values do not indicate control functionality.</p>
    </div>
  );
}

/** Read-only configuration summary from GET /configurations (only what Ring returned). */
export function RingConfigurationSummary({ device }: { device: ConnectedRingDevice }) {
  const rows = configurationRows(device.configuration);
  if (!rows.length) return <p className="text-[12.5px] text-text-3">Configuration was not returned by Ring for this device.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-2 border-b border-border/60 py-1">
          <dt className="text-text-2">{r.label}</dt>
          <dd className="font-semibold text-text tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RingRegion({ device }: { device: ConnectedRingDevice }) {
  const region = regionLabel(device.region);
  return <span title="Coarse location from Ring (country / state) - never an address">{region ? `Region: ${region}` : "Region: not provided by Ring"}</span>;
}

/** The Ring account behind the current Playground session (GET /v1/users/me). */
export function RingAccountCard({ account, className }: { account: RingAccount | null | undefined; className?: string }) {
  return (
    <section className={cn("card p-5", className)} aria-labelledby="ring-account">
      <SectionHeader icon={<UserRound />} title={<span id="ring-account">Ring account</span>} subtitle="From GET /v1/users/me for this session." />
      {account ? (
        <dl className="space-y-2 text-[13.5px]">
          <div className="flex items-center justify-between gap-3"><dt className="text-text-3">Name</dt><dd className="font-semibold text-text">{[account.firstName, account.lastName].filter(Boolean).join(" ") || "—"}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-text-3">Email</dt><dd className="font-mono text-[12.5px] text-text-2">{account.emailMasked ?? "—"}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-text-3">Account ID</dt><dd className="max-w-[60%] truncate font-mono text-[11.5px] text-text-2" title={account.accountId}>{account.accountId.replace(/^ava1\.ring\.account\./, "…")}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-text-3">Fetched</dt><dd className="text-text-2">{formatDate(account.fetchedAt)} {formatTime(account.fetchedAt)}</dd></div>
        </dl>
      ) : (
        <p className="text-[13px] text-text-3">Account details load when you connect a Playground session.</p>
      )}
      <p className="mt-3 text-[11.5px] text-text-3">Subscription status: not available in the Playground (Ring answers 422 for this account).</p>
    </section>
  );
}

const featureIcon: Record<FutureFeature["key"], React.ReactNode> = { deviceControls: <SlidersHorizontal />, chimeControls: <Speaker />, family: <Users />, lifecycle: <Radio />, subscriptions: <CreditCard /> };

/** Honest "not yet" UX for Ring capabilities Matan cannot demonstrate with the Playground. Nothing here is interactive. */
export function RingFutureFeaturesCard({ devices, className }: { devices: Pick<ConnectedRingDevice, "details">[]; className?: string }) {
  const features = futureFeatures(devices);
  return (
    <section className={cn("card p-5", className)} aria-labelledby="ring-future">
      <SectionHeader icon={<Lock />} title={<span id="ring-future">Future Ring capabilities</span>} subtitle="Shown, never faked. Each item names why it isn't live yet." />
      <ul className="space-y-2.5">
        {features.map((f) => (
          <li key={f.key} className="rounded-xl border border-dashed border-border bg-surface-2/40 p-3" aria-disabled="true">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-3 [&>svg]:size-4">{featureIcon[f.key]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-text-2">{f.title}</p>
                  <Badge tone="neutral" size="xs">{f.headline}</Badge>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text-3">{f.message}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-text-3/80">{f.classification}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

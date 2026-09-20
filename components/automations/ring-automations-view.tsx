"use client";

import * as React from "react";
import Link from "next/link";
import { Zap, Plus, Pencil, Trash2, ScrollText, Lock, Lightbulb, Siren, DoorClosed, MessageSquareReply, Cable, ShieldAlert, HeartHandshake, CircleCheck, Clock, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Tabs } from "@/components/ui/Tabs";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { ActivityTimeline, type TimelineItem } from "@/components/matan/ActivityTimeline";
import { AutomationFlow } from "@/components/matan/AutomationCard";
import { AICallout } from "@/components/matan/AIInsightCard";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { SourceBadge } from "@/components/experience/source-badge";
import { ACTION_ICON, ACTION_TONE, RuleEditor } from "@/components/care/CareRulesPanel";
import { useApi } from "@/hooks/useApi";
import { careApi } from "@/lib/api/care";
import { getDataSource } from "@/lib/data/get-data-source";
import { describeConditions } from "@/lib/matan/rules/evaluate";
import type { MatanRule, RuleAction } from "@/lib/matan/rules/types";
import type { RingEvent } from "@/lib/types";
import { formatTime, relativeDay, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Real Mode Automations = Matan Smart Rules. Every analyzed Ring event is evaluated
 * against the rules and the matched rule ids are stored on the event's decision, so run
 * counts and the log here are derived from real events, never from a demo counter.
 * Actions the Ring Partner API cannot perform (lights, siren, locks, auto-reply,
 * third-party routines) are listed as future integrations instead of being simulated.
 */

type Filter = "all" | "builtin" | "custom";

interface RuleStats {
  runs7d: number;
  lastRunAt?: string;
  byAction: Partial<Record<RuleAction, number>>;
}

export function ruleStats(rules: MatanRule[], events: RingEvent[], nowMs = Date.now()): Record<string, RuleStats> {
  const out: Record<string, RuleStats> = {};
  for (const r of rules) out[r.id] = { runs7d: 0, byAction: {} };
  for (const e of events) {
    const d = e.intelligence?.careDecision;
    if (!d || !("matchedRuleIds" in d)) continue;
    if (nowMs - new Date(e.timestamp).getTime() > 7 * 86_400_000) continue;
    for (const id of d.matchedRuleIds) {
      const s = out[id];
      if (!s) continue;
      s.runs7d += 1;
      s.byAction[d.action] = (s.byAction[d.action] ?? 0) + 1;
      if (!s.lastRunAt || e.timestamp > s.lastRunAt) s.lastRunAt = e.timestamp;
    }
  }
  return out;
}

const RULE_ICON: Record<string, React.ReactNode> = { "high-risk": <ShieldAlert />, "low-confidence": <CircleCheck />, package: <Zap />, repeated: <Clock />, "quiet-hours": <Clock /> };

const FUTURE = [
  { label: "Turn on lights / siren", icon: <Lightbulb />, why: "Ring's Partner API exposes no device-control endpoints." },
  { label: "Lock or unlock doors", icon: <DoorClosed />, why: "No lock integration in the Ring Developer Playground." },
  { label: "Auto-reply at the doorbell", icon: <MessageSquareReply />, why: "Two-way audio is not exposed to partners." },
  { label: "Alexa / IFTTT routines", icon: <Cable />, why: "Third-party routine triggers are not part of this build." },
];

export function RingAutomationsView() {
  const toast = useToast();
  const confirm = useConfirm();
  const rulesQ = useApi(() => careApi.rules(), []);
  const careQ = useApi(() => careApi.get(), []);
  const eventsQ = useApi(() => getDataSource("ring").getEvents({ range: "7d", pageSize: 400 }), []);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<MatanRule | "new" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [logsRule, setLogsRule] = React.useState<string | null>(null);

  const rules = rulesQ.data?.rules ?? [];
  const events = eventsQ.data?.items ?? [];
  const care = careQ.data?.context;
  const stats = React.useMemo(() => ruleStats(rules, events), [rules, events]);
  const q = search.trim().toLowerCase();
  const visible = rules.filter((r) => (filter === "all" || (filter === "builtin" ? Boolean(r.builtin) : !r.builtin)) && (!q || r.name.toLowerCase().includes(q) || describeConditions(r).toLowerCase().includes(q)));
  const runsTotal = Object.values(stats).reduce((n, s) => n + s.runs7d, 0);

  const toggleRule = async (rule: MatanRule, enabled: boolean) => {
    setBusy(rule.id);
    try {
      const r = await careApi.updateRule(rule.id, { enabled });
      rulesQ.setData((d) => ({ rules: (d?.rules ?? []).map((x) => (x.id === rule.id ? r.rule : x)) }));
      toast.success(`${rule.name} ${enabled ? "enabled" : "paused"}`);
    } catch {
      toast.error("Not saved", "Please try again.");
    } finally {
      setBusy(null);
    }
  };
  const removeRule = async (rule: MatanRule) => {
    const ok = await confirm({ title: `Delete "${rule.name}"?`, description: "Events already decided keep their record; future events will no longer match this rule.", confirmLabel: "Delete rule" });
    if (!ok) return;
    try {
      await careApi.deleteRule(rule.id);
      rulesQ.setData((d) => ({ rules: (d?.rules ?? []).filter((x) => x.id !== rule.id) }));
      toast.success("Rule deleted", rule.name);
    } catch {
      toast.error("Not deleted", "Please try again.");
    }
  };
  const enableCare = async () => {
    try {
      const r = await careApi.save({ enabled: true });
      careQ.setData(() => r);
      toast.success("Care Context on", "Smart Rules now decide notifications for every event.");
    } catch {
      toast.error("Not saved", "Please try again.");
    }
  };

  // Log: every event whose decision matched at least one rule (newest first).
  const logItems: TimelineItem[] = events
    .filter((e) => {
      const d = e.intelligence?.careDecision;
      return d && "matchedRuleIds" in d && d.matchedRuleIds.length > 0 && (!logsRule || d.matchedRuleIds.includes(logsRule));
    })
    .slice(0, 40)
    .map((e) => {
      const d = e.intelligence!.careDecision as { action: RuleAction; matchedRuleIds: string[]; reason: string };
      const names = d.matchedRuleIds.map((id) => rules.find((r) => r.id === id)?.name ?? id).join(", ");
      return {
        id: e.id,
        time: (
          <>
            {relativeDay(e.timestamp, new Date().toISOString())}
            <br />
            {formatTime(e.timestamp)}
          </>
        ),
        title: `${names} → ${d.action}`,
        subtitle: `${e.title} · ${e.location}${e.notification?.status === "sent" ? ` · email sent via ${e.notification.provider ?? "email"}` : e.notification?.status === "failed" ? " · email failed" : ""}`,
        tone: ACTION_TONE[d.action] === "neutral" ? "primary" : ACTION_TONE[d.action],
        icon: ACTION_ICON[d.action],
        trailing: (
          <Link href={`/events/${e.id}`} className="text-[12px] font-semibold text-primary hover:text-primary-2">
            View
          </Link>
        ),
      };
    });

  const loading = rulesQ.loading || careQ.loading || eventsQ.loading;
  const error = rulesQ.error ?? careQ.error ?? eventsQ.error;

  return (
    <>
      <Topbar
        title={<span className="flex flex-wrap items-center gap-3">Automations <SourceBadge source="ring" short /></span>}
        subtitle="Matan Smart Rules are your automations: every Ring event is analyzed, evaluated against these rules, and the decision (Ignore / Monitor / Notify / Escalate) is recorded on the event."
        search={{ value: search, onChange: setSearch, placeholder: "Search rules…" }}
        actions={
          <>
            <Button variant="secondary" leftIcon={<ScrollText className="size-4" />} onClick={() => { setLogsRule(null); setLogsOpen(true); }}>
              Rule activity
            </Button>
            <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              Create rule
            </Button>
          </>
        }
      />

      <Tabs
        items={[
          { value: "all" as Filter, label: "All rules", count: rules.length },
          { value: "builtin" as Filter, label: "Built-in", count: rules.filter((r) => r.builtin).length },
          { value: "custom" as Filter, label: "Custom", count: rules.filter((r) => !r.builtin).length },
        ]}
        value={filter}
        onChange={setFilter}
        aria-label="Rule categories"
        className="mb-5"
      />

      {care && !care.enabled && (
        <AICallout
          tone="warning"
          icon={<HeartHandshake />}
          title="Care Context is off"
          description="Rules are only evaluated while Care Context is on; until then the alert level in Settings decides emails."
          className="mb-5"
          action={<Button size="sm" onClick={() => void enableCare()}>Turn on Care Context</Button>}
        />
      )}

      {error ? (
        <ErrorState onRetry={() => { void rulesQ.refetch(); void eventsQ.refetch(); void careQ.refetch(); }} message={error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-3.5 xl:col-span-8">
            {loading && !rules.length ? (
              <div className="relative min-h-[420px] space-y-3.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[120px] rounded-card" />
                ))}
                <LoadingOverlay label="Loading rules" />
              </div>
            ) : visible.length === 0 ? (
              <div className="card">
                <EmptyState icon={<Zap />} title={q ? "No rules match your search" : "No custom rules yet"} description="Create a rule: pick event types, risk levels, a time window or repeated activity, and what Matan should do." action={<Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Create rule</Button>} />
              </div>
            ) : (
              visible.map((r) => {
                const s = stats[r.id];
                return (
                  <article key={r.id} className={cn("card p-4", !r.enabled && "opacity-80")}>
                    <div className="flex items-start gap-3.5">
                      <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border [&>svg]:size-5", r.action.type === "ESCALATE" ? "border-danger/25 bg-danger/10 text-danger" : r.action.type === "NOTIFY" ? "border-warning/25 bg-warning/10 text-warning" : "border-primary/25 bg-primary/10 text-primary")}>
                        {RULE_ICON[r.builtin ?? ""] ?? <Zap />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button type="button" onClick={() => setEditing(r)} className="text-left text-[16.5px] font-semibold text-text transition-colors hover:text-primary-2">
                                {r.name}
                              </button>
                              <Badge tone={ACTION_TONE[r.action.type]} size="xs" uppercase icon={ACTION_ICON[r.action.type]}>{r.action.type}</Badge>
                              {r.builtin && <Badge tone="neutral" size="xs">Built-in</Badge>}
                            </div>
                            <p className="text-[13px] text-text-2">If {describeConditions(r)}{r.builtin === "high-risk" ? " · overrides quiet hours" : ""}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge tone={r.enabled ? "success" : "neutral"} size="md" className="hidden sm:inline-flex">{r.enabled ? "Active" : "Paused"}</Badge>
                            <Toggle checked={r.enabled} disabled={busy === r.id} onChange={(v) => void toggleRule(r, v)} label={`${r.enabled ? "Pause" : "Enable"} ${r.name}`} />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <AutomationFlow trigger="Ring event analyzed" condition={describeConditions(r)} action={`${r.action.type.charAt(0)}${r.action.type.slice(1).toLowerCase()}${r.action.type === "NOTIFY" || r.action.type === "ESCALATE" ? " · email" : ""}`} className="min-w-0 flex-1" />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-text-3">
                          <span>
                            <strong className="text-text">{s?.runs7d ?? 0}</strong> {s?.runs7d === 1 ? "match" : "matches"} in the last 7 days
                            {s?.lastRunAt ? ` · last ${timeAgo(s.lastRunAt, new Date().toISOString())}` : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <Button size="xs" variant="ghost" onClick={() => { setLogsRule(r.id); setLogsOpen(true); }} disabled={!s?.runs7d}>Activity</Button>
                            <Button size="xs" variant="ghost" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(r)}>Edit</Button>
                            {!r.builtin && <Button size="xs" variant="ghost" className="text-danger hover:bg-danger/10" leftIcon={<Trash2 className="size-3.5" />} onClick={() => void removeRule(r)}>Delete</Button>}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
            <p className="text-[11.5px] text-text-3">Precedence: low-confidence guard → high-risk escalation → your rules → repeated activity → quiet hours → sensitivity → Decision Engine default. Care Context, quiet hours and sensitivity live in <Link href="/settings?tab=care" className="text-primary hover:text-primary-2">Settings › Care &amp; Rules</Link>.</p>
          </div>

          <div className="space-y-5 xl:col-span-4">
            <section className="card p-5" aria-labelledby="ra-stats">
              <SectionHeader icon={<Zap />} title={<span id="ra-stats">This week</span>} subtitle="From your real Ring events" iconTone="warning" />
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Events evaluated", events.filter((e) => e.intelligence?.careDecision && "action" in e.intelligence.careDecision).length],
                  ["Rule matches", runsTotal],
                  ["Emails sent", events.filter((e) => e.notification?.status === "sent").length],
                  ["Care Context", care ? (care.enabled ? "On" : "Off") : "…"],
                ].map(([k, v]) => (
                  <div key={String(k)} className="card-inset p-3">
                    <dt className="text-[11px] uppercase tracking-wide text-text-3">{k}</dt>
                    <dd className="mt-1 text-[20px] font-bold tabular-nums text-text">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="card p-5" aria-labelledby="ra-log">
              <SectionHeader icon={<ScrollText />} title={<span id="ra-log">Recent rule activity</span>} subtitle="Latest decisions that matched a rule" action={<Button size="xs" variant="ghost" onClick={() => { setLogsRule(null); setLogsOpen(true); }}>View all <ChevronRight className="size-3.5" /></Button>} />
              {loading && !events.length ? <Skeleton className="h-40" /> : logItems.length ? <ActivityTimeline compact items={logItems.slice(0, 5)} /> : <p className="text-[13px] text-text-3">No rule has matched an event in the last 7 days yet.</p>}
            </section>

            <section className="card p-5" aria-labelledby="ra-future">
              <SectionHeader icon={<Lock />} title={<span id="ra-future">Future integrations</span>} subtitle="Actions Matan cannot run today" iconTone="purple" />
              <ul className="space-y-2">
                {FUTURE.map((f) => (
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
              <p className="mt-3 text-[11.5px] text-text-3">Siren and light capabilities are read-only values in the Ring API; nothing here is simulated in Real Mode.</p>
            </section>
          </div>
        </div>
      )}

      <RuleEditor
        rule={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={(saved, created) => {
          rulesQ.setData((d) => ({ rules: created ? [...(d?.rules ?? []), saved] : (d?.rules ?? []).map((x) => (x.id === saved.id ? saved : x)) }));
          setEditing(null);
        }}
      />

      <Drawer open={logsOpen} onClose={() => setLogsOpen(false)} title="Rule activity" description={logsRule ? `Decisions where "${rules.find((r) => r.id === logsRule)?.name ?? logsRule}" matched · last 7 days` : "Every decision in the last 7 days that matched a rule"} width="max-w-xl">
        {logItems.length ? <ActivityTimeline items={logItems} /> : <EmptyState icon={<ScrollText />} title="No matches yet" description="Rule matches appear here as Matan analyzes new Ring events." compact />}
      </Drawer>
    </>
  );
}

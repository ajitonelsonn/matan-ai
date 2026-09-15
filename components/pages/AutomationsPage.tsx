"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Shield, Package, KeyRound, Heart, Settings2, LayoutGrid, ScrollText, Plus, Filter, Cog, Sparkles, Pencil, Copy, Trash2, FileClock, ShieldCheck, ChevronRight, CircleCheck, SkipForward, TriangleAlert } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AutomationCard, AutomationFlow } from "@/components/matan/AutomationCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { AIInsightCard } from "@/components/matan/AIInsightCard";
import { ActivityTimeline } from "@/components/matan/ActivityTimeline";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { automationsApi } from "@/lib/api/automations";
import { cn } from "@/lib/utils/cn";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import { relativeDayTime, timeAgo } from "@/lib/utils/format";
import type { Automation, AutomationCategory, SuggestedAutomation } from "@/lib/types";

type Cat = "all" | AutomationCategory;

const tabs: { value: Cat; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All Automations", icon: <LayoutGrid /> },
  { value: "security", label: "Security", icon: <Shield /> },
  { value: "deliveries", label: "Deliveries", icon: <Package /> },
  { value: "access", label: "Access Control", icon: <KeyRound /> },
  { value: "care", label: "Care", icon: <Heart /> },
  { value: "custom", label: "Custom", icon: <Settings2 /> },
];

const categoryLabel: Record<AutomationCategory, string> = { security: "Security", deliveries: "Deliveries", access: "Access Control", care: "Care", custom: "Custom" };

export function AutomationsPage({ initialId }: { initialId?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi(() => automationsApi.list(), []);
  const [category, setCategory] = React.useState<Cat>("all");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 200);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [logsFilter, setLogsFilter] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Automation | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(initialId ?? null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const wizardRef = React.useRef<HTMLDivElement>(null);

  // Wizard state
  const [trigger, setTrigger] = React.useState<string | null>(null);
  const [condition, setCondition] = React.useState<string | null>(null);
  const [showCondition, setShowCondition] = React.useState(false);
  const [action, setAction] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (params.get("create")) {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (params.get("preset") === "package") {
        setTrigger("Package detected");
        setShowCondition(true);
        setCondition("Only if it happens 3+ times");
        setAction("Send notification");
        setName("Package left reminder");
      }
    }
  }, [params]);

  const items = q.data?.items ?? [];
  const visible = items.filter((a) => (category === "all" || a.category === category) && (!debounced || `${a.name} ${a.description} ${a.trigger} ${a.action}`.toLowerCase().includes(debounced.toLowerCase())));
  const counts = q.data?.counts ?? {};
  const detail = items.find((a) => a.id === detailId) ?? null;

  const patchLocal = (id: string, patch: Partial<Automation>) => q.setData((d) => (d ? { ...d, items: d.items.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : d));

  const toggle = async (a: Automation, enabled: boolean) => {
    patchLocal(a.id, { enabled });
    setBusyId(a.id);
    try {
      await automationsApi.update(a.id, { enabled });
      toast.success(enabled ? "Automation enabled" : "Automation disabled", a.name);
      void q.refetch({ silent: true });
    } catch {
      patchLocal(a.id, { enabled: !enabled });
      toast.error();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a: Automation) => {
    const ok = await confirm({ title: `Delete "${a.name}"?`, description: "This automation and its history will be removed. Events it would have handled will no longer trigger any action.", confirmLabel: "Delete automation" });
    if (!ok) return;
    try {
      await automationsApi.remove(a.id);
      toast.success("Automation deleted", a.name);
      setDetailId(null);
      void q.refetch({ silent: true });
    } catch {
      toast.error();
    }
  };

  const duplicate = async (a: Automation) => {
    try {
      await automationsApi.duplicate(a.id);
      toast.success("Automation duplicated", `${a.name} (copy)`);
      void q.refetch({ silent: true });
    } catch {
      toast.error();
    }
  };

  const create = async (payload: { name?: string; trigger: string; condition?: string; action: string; category?: AutomationCategory; icon?: string; tone?: Automation["tone"]; description?: string }) => {
    setCreating(true);
    try {
      const created = await automationsApi.create(payload);
      toast.success("Automation created", `${created.name} is now active.`);
      await q.refetch({ silent: true });
      setTrigger(null);
      setCondition(null);
      setShowCondition(false);
      setAction(null);
      setName("");
      setCategory("all");
    } catch {
      toast.error();
    } finally {
      setCreating(false);
    }
  };

  const addSuggested = (s: SuggestedAutomation) => void create({ name: s.name, trigger: s.trigger, action: s.action, category: s.category, icon: s.icon, tone: s.tone, description: s.description });

  const saveEdit = async (patch: Partial<Automation>) => {
    if (!editing) return;
    try {
      await automationsApi.update(editing.id, patch);
      toast.success("Automation updated", patch.name ?? editing.name);
      setEditing(null);
      void q.refetch({ silent: true });
    } catch {
      toast.error();
    }
  };

  const openDetail = (a: Automation) => {
    setDetailId(a.id);
    window.history.replaceState(null, "", `/automations/${a.id}`);
  };
  const closeDetail = () => {
    setDetailId(null);
    window.history.replaceState(null, "", "/automations");
  };

  const menuFor = (a: Automation) => (
    <Menu
      label={`Options for ${a.name}`}
      items={[
        { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(a) },
        { label: "Duplicate", icon: <Copy />, onSelect: () => void duplicate(a) },
        { label: "View logs", icon: <FileClock />, onSelect: () => { setLogsFilter(a.id); setLogsOpen(true); } },
        "separator",
        { label: "Delete", icon: <Trash2 />, onSelect: () => void remove(a), tone: "danger" },
      ]}
    />
  );

  const logs = (q.data?.logs ?? []).filter((l) => !logsFilter || l.automationId === logsFilter);

  return (
    <>
      <Topbar
        title="Automations"
        subtitle="Turn Ring events into intelligent actions. Let Matan AI handle the routine, so you can focus on what matters."
        search={{ value: search, onChange: setSearch, placeholder: "Search automations…" }}
        actions={
          <Button variant="secondary" leftIcon={<ScrollText className="size-4" />} onClick={() => { setLogsFilter(null); setLogsOpen(true); }}>
            Automation Logs
          </Button>
        }
      />

      <Tabs items={tabs.map((t) => ({ ...t, count: t.value === "all" ? counts.all ?? items.length : counts[t.value] ?? 0 }))} value={category} onChange={setCategory} aria-label="Automation categories" className="mb-4" />

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <section className="space-y-3 xl:col-span-8" aria-label="Automation list">
            {q.loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-card" />)
            ) : visible.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<Zap />}
                  title={debounced ? "No automations match your search" : category === "all" ? "No automations yet" : `No ${categoryLabel[category as AutomationCategory]} automations yet`}
                  description="Automations connect a Ring trigger to an action. Create one from the panel or pick a suggestion."
                  action={
                    <Button leftIcon={<Plus className="size-4" />} onClick={() => wizardRef.current?.scrollIntoView({ behavior: "smooth" })}>
                      Create automation
                    </Button>
                  }
                />
              </div>
            ) : (
              visible.map((a) => <AutomationCard key={a.id} automation={a} onToggle={(v) => void toggle(a, v)} menu={menuFor(a)} onOpen={() => openDetail(a)} busy={busyId === a.id} />)
            )}
          </section>

          <aside className="space-y-5 xl:col-span-4">
            <section ref={wizardRef} className="card-hero p-5 scroll-mt-6" aria-labelledby="create-title">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_6px_18px_rgba(18,168,255,0.35)]">
                  <Plus className="size-5" />
                </span>
                <div>
                  <h2 id="create-title" className="text-[19px] font-semibold text-text">
                    Create New Automation
                  </h2>
                  <p className="text-[13px] text-text-3">Set up a new automation with simple steps.</p>
                </div>
              </div>

              <WizardStep n={1} icon={<Zap />} title="Trigger" subtitle="Choose what starts the automation." tone="primary" done={Boolean(trigger)}>
                <Select value={trigger} onChange={setTrigger} options={(q.data?.options.triggers ?? []).map((t) => ({ value: t, label: t }))} placeholder="Select a trigger…" fullWidth label="Trigger" />
              </WizardStep>
              <WizardStep n={2} icon={<Filter />} title={<>Condition <span className="font-normal text-text-3">(Optional)</span></>} subtitle="Add conditions to make it smarter." tone="cyan" done={Boolean(condition)}>
                {showCondition ? (
                  <div className="flex items-center gap-2">
                    <Select value={condition} onChange={setCondition} options={(q.data?.options.conditions ?? []).map((c) => ({ value: c, label: c }))} placeholder="Select a condition…" fullWidth label="Condition" />
                    <Button variant="ghost" size="sm" onClick={() => { setShowCondition(false); setCondition(null); }}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button variant="subtle" fullWidth leftIcon={<Plus className="size-4" />} onClick={() => setShowCondition(true)}>
                    Add condition
                  </Button>
                )}
              </WizardStep>
              <WizardStep n={3} icon={<Cog />} title="Action" subtitle="Choose what Matan AI should do." tone="primary" done={Boolean(action)}>
                <Select value={action} onChange={setAction} options={(q.data?.options.actions ?? []).map((a) => ({ value: a, label: a }))} placeholder="Select an action…" fullWidth label="Action" />
              </WizardStep>
              <div className="mt-3">
                <Field label="Name (optional)" htmlFor="aut-name">
                  <Input id="aut-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={trigger && action ? `When ${trigger.toLowerCase()}` : "Give it a name"} />
                </Field>
              </div>
              {trigger && action && (
                <div className="mt-4 rounded-xl border border-border bg-bg/40 p-3 animate-fade-in">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Preview</p>
                  <AutomationFlow trigger={trigger} condition={condition ?? undefined} action={action} compact />
                </div>
              )}
              <Button fullWidth size="lg" className="mt-4" disabled={!trigger || !action} loading={creating} onClick={() => trigger && action && void create({ name: name || undefined, trigger, condition: condition ?? undefined, action })}>
                Create Automation
              </Button>
            </section>

            <section className="card p-5" aria-labelledby="suggested-title">
              <SectionHeader icon={<Sparkles />} title={<span id="suggested-title">Suggested Automations</span>} subtitle="Quick setup for common use cases." iconTone="purple" className="mb-3" />
              {q.loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : q.data?.suggested.length ? (
                <ul className="space-y-2">
                  {q.data.suggested.map((s) => (
                    <li key={s.id}>
                      <AIInsightCard icon={s.icon} title={s.name} description={s.description} tone={s.tone as Tone} onClick={() => addSuggested(s)} trailing={<Plus className="size-4 shrink-0 text-primary" aria-hidden />} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={<CircleCheck />} title="You've added every suggestion" description="Matan will suggest more as it learns your routine." />
              )}
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-success/25 bg-success/8 p-3.5">
                <ShieldCheck className="size-6 shrink-0 text-success" aria-hidden />
                <p className="text-[13px] leading-snug text-text-2">Automations help create safer homes and more peaceful communities.</p>
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* Logs drawer */}
      <Drawer open={logsOpen} onClose={() => setLogsOpen(false)} title="Automation Logs" description={logsFilter ? items.find((a) => a.id === logsFilter)?.name : "Everything Matan AI did on your behalf"} width="max-w-lg">
        {logsFilter && (
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => setLogsFilter(null)}>
            Show all automations
          </Button>
        )}
        {logs.length ? (
          <ActivityTimeline
            items={logs.map((l) => ({
              id: l.id,
              time: relativeDayTime(l.timestamp).replace(", ", "\n"),
              title: l.automationName,
              subtitle: l.message,
              tone: l.status === "success" ? "success" : l.status === "skipped" ? "neutral" : "danger",
              icon: l.status === "success" ? <CircleCheck /> : l.status === "skipped" ? <SkipForward /> : <TriangleAlert />,
            }))}
            className="[&_.whitespace-pre-line]:whitespace-pre-line"
          />
        ) : (
          <EmptyState compact icon={<FileClock />} title="No log entries yet" description="Runs will show here as automations fire." />
        )}
      </Drawer>

      {/* Edit modal */}
      <EditAutomationModal automation={editing} options={q.data?.options} onClose={() => setEditing(null)} onSave={saveEdit} />

      {/* Detail drawer */}
      <Drawer open={Boolean(detail)} onClose={closeDetail} title={detail?.name} description={detail?.description} width="max-w-xl">
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cn("inline-flex size-12 items-center justify-center rounded-xl border [&>svg]:size-6", toneStyles[detail.tone as Tone].bg, toneStyles[detail.tone as Tone].border, toneStyles[detail.tone as Tone].text)}>
                  <Icon name={detail.icon} />
                </span>
                <div>
                  <Badge tone="neutral" size="xs">
                    {categoryLabel[detail.category]}
                  </Badge>
                  <p className="mt-1 text-[13px] text-text-3">{detail.runsThisWeek} runs this week{detail.lastRunAt ? ` · last run ${timeAgo(detail.lastRunAt)}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-text-2">{detail.enabled ? "Active" : "Paused"}</span>
                <Toggle checked={detail.enabled} onChange={(v) => void toggle(detail, v)} label={`Toggle ${detail.name}`} />
              </div>
            </div>
            <div className="card-inset p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Rule</p>
              <AutomationFlow trigger={detail.trigger} condition={detail.condition} action={detail.action} />
            </div>
            {detail.exampleText && (
              <div className="card-inset p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-3">Example</p>
                <p className="text-[14px] text-text-2">{detail.exampleText}</p>
              </div>
            )}
            <div>
              <h3 className="mb-2 text-[14.5px] font-semibold text-text">Recent runs</h3>
              {(q.data?.logs ?? []).filter((l) => l.automationId === detail.id).length ? (
                <ActivityTimeline
                  compact
                  items={(q.data?.logs ?? [])
                    .filter((l) => l.automationId === detail.id)
                    .map((l) => ({ id: l.id, time: relativeDayTime(l.timestamp).replace(", ", "\n"), title: l.message, tone: l.status === "success" ? "success" : "neutral" }))}
                />
              ) : (
                <p className="text-[13px] text-text-3">No runs recorded yet.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" leftIcon={<Pencil className="size-4" />} onClick={() => setEditing(detail)}>
                Edit
              </Button>
              <Button variant="secondary" leftIcon={<Copy className="size-4" />} onClick={() => void duplicate(detail)}>
                Duplicate
              </Button>
              <Button variant="danger" leftIcon={<Trash2 className="size-4" />} onClick={() => void remove(detail)} className="ml-auto">
                Delete
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function WizardStep({ n, icon, title, subtitle, tone, done, children }: { n: number; icon: React.ReactNode; title: React.ReactNode; subtitle: string; tone: Tone; done?: boolean; children: React.ReactNode }) {
  const t = toneStyles[tone];
  return (
    <div className="mt-4 rounded-2xl border border-border bg-bg/30 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-4", done ? "bg-success/12 border-success/30 text-success" : cn(t.bg, t.border, t.text))} aria-hidden>
          {done ? <CircleCheck /> : icon}
          <span className="absolute -left-1.5 -top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-text-2 ring-2 ring-surface">{n}</span>
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-text">{title}</h3>
          <p className="text-[12.5px] text-text-3">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function EditAutomationModal({ automation, options, onClose, onSave }: { automation: Automation | null; options?: { triggers: string[]; conditions: string[]; actions: string[] }; onClose: () => void; onSave: (patch: Partial<Automation>) => Promise<void> }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [trigger, setTrigger] = React.useState<string | null>(null);
  const [condition, setCondition] = React.useState<string | null>(null);
  const [action, setAction] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (automation) {
      setName(automation.name);
      setDescription(automation.description);
      setTrigger(automation.trigger);
      setCondition(automation.condition ?? null);
      setAction(automation.action);
    }
  }, [automation]);

  const opt = (list: string[] | undefined, current: string | null) => {
    const base = list ?? [];
    const merged = current && !base.includes(current) ? [current, ...base] : base;
    return merged.map((v) => ({ value: v, label: v }));
  };

  return (
    <Modal
      open={Boolean(automation)}
      onClose={onClose}
      title="Edit automation"
      description="Adjust the trigger, condition or action. Changes apply immediately."
      icon={<Pencil />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!name.trim() || !trigger || !action}
            onClick={async () => {
              setSaving(true);
              await onSave({ name: name.trim(), description: description.trim(), trigger: trigger ?? undefined, condition: condition ?? undefined, action: action ?? undefined });
              setSaving(false);
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="edit-name">
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} data-autofocus />
        </Field>
        <Field label="Description" htmlFor="edit-desc">
          <Input id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Trigger">
          <Select value={trigger} onChange={setTrigger} options={opt(options?.triggers, trigger)} fullWidth label="Trigger" />
        </Field>
        <Field label="Condition (optional)">
          <Select value={condition ?? "none"} onChange={(v) => setCondition(v === "none" ? null : v)} options={[{ value: "none", label: "No condition" }, ...opt(options?.conditions, condition)]} fullWidth label="Condition" />
        </Field>
        <Field label="Action">
          <Select value={action} onChange={setAction} options={opt(options?.actions, action)} fullWidth label="Action" />
        </Field>
        {trigger && action && (
          <div className="rounded-xl border border-border bg-bg/40 p-3">
            <AutomationFlow trigger={trigger} condition={condition ?? undefined} action={action} compact />
          </div>
        )}
      </div>
    </Modal>
  );
}

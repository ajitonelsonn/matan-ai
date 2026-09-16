"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, ShieldCheck, Package, KeyRound, Heart, Settings2, ScrollText, Plus, Filter, Cog, Sparkles, ChevronRight, Pencil, Copy, Trash2, ListOrdered, CircleCheck, CircleSlash, TriangleAlert, LayoutGrid } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Field, Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AutomationCard, AutomationFlow } from "@/components/matan/AutomationCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { AICallout } from "@/components/matan/AIInsightCard";
import { ActivityTimeline } from "@/components/matan/ActivityTimeline";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useApi } from "@/hooks/useApi";
import { automationsApi } from "@/lib/api/automations";
import { useDebounce } from "@/hooks/useDebounce";
import { formatTime, relativeDay } from "@/lib/utils/format";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";
import type { Automation, AutomationCategory, SuggestedAutomation } from "@/lib/types";

type Cat = "all" | AutomationCategory;

const catMeta: { value: Cat; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All Automations", icon: <LayoutGrid /> },
  { value: "security", label: "Security", icon: <ShieldCheck /> },
  { value: "deliveries", label: "Deliveries", icon: <Package /> },
  { value: "access", label: "Access Control", icon: <KeyRound /> },
  { value: "care", label: "Care", icon: <Heart /> },
  { value: "custom", label: "Custom", icon: <Settings2 /> },
];

interface WizardState {
  name: string;
  trigger: string | null;
  condition: string | null;
  action: string | null;
  showCondition: boolean;
}

const emptyWizard: WizardState = { name: "", trigger: null, condition: null, action: null, showCondition: false };

export function AutomationsPage({ initialAutomationId }: { initialAutomationId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi(() => automationsApi.list(), []);
  const [cat, setCat] = React.useState<Cat>("all");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 200);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [wizard, setWizard] = React.useState<WizardState>({ ...emptyWizard, trigger: params.get("trigger") });
  const [creating, setCreating] = React.useState(false);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [logsFilter, setLogsFilter] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Automation | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<Automation>>({});
  const [saving, setSaving] = React.useState(false);
  const wizardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (params.get("create") && wizardRef.current) {
      wizardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      wizardRef.current.querySelector<HTMLElement>("button")?.focus();
    }
  }, [params]);

  React.useEffect(() => {
    if (initialAutomationId && q.data) {
      const a = q.data.items.find((x) => x.id === initialAutomationId);
      if (a) openEdit(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAutomationId, q.data]);

  const items = (q.data?.items ?? []).filter((a) => (cat === "all" || a.category === cat) && (!debounced || `${a.name} ${a.description} ${a.trigger} ${a.action}`.toLowerCase().includes(debounced.toLowerCase())));
  const counts = q.data?.counts ?? {};

  const setItems = (fn: (list: Automation[]) => Automation[]) => q.setData((d) => (d ? { ...d, items: fn(d.items), counts: recount(fn(d.items)) } : d));
  const recount = (list: Automation[]) => {
    const c: Record<string, number> = { all: list.length };
    list.forEach((a) => (c[a.category] = (c[a.category] ?? 0) + 1));
    return c;
  };

  const toggle = async (a: Automation, enabled: boolean) => {
    setBusy(a.id);
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, enabled } : x)));
    try {
      await automationsApi.update(a.id, { enabled });
      toast.success(enabled ? "Automation enabled" : "Automation disabled", a.name);
      void q.refetch({ silent: true });
    } catch {
      setItems((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: !enabled } : x)));
      toast.error();
    } finally {
      setBusy(null);
    }
  };

  const create = async (from?: SuggestedAutomation) => {
    const trigger = from?.trigger ?? wizard.trigger;
    const action = from?.action ?? wizard.action;
    if (!trigger || !action) {
      toast.warning("Choose a trigger and an action first");
      return;
    }
    setCreating(true);
    try {
      const a = await automationsApi.create({
        name: from?.name ?? (wizard.name.trim() || undefined),
        trigger,
        condition: from ? undefined : wizard.showCondition ? wizard.condition ?? undefined : undefined,
        action,
        category: from?.category,
        icon: from?.icon,
        tone: from?.tone,
        description: from?.description,
      });
      setItems((list) => [a, ...list]);
      q.setData((d) => (d ? { ...d, suggested: d.suggested.filter((s) => s.name !== a.name) } : d));
      setWizard(emptyWizard);
      toast.success("Automation created", `${a.name} is now active.`);
      setCat("all");
    } catch {
      toast.error();
    } finally {
      setCreating(false);
    }
  };

  const remove = async (a: Automation) => {
    const ok = await confirm({ title: `Delete “${a.name}”?`, description: "This automation will stop running immediately. You can create it again later.", confirmLabel: "Delete automation" });
    if (!ok) return;
    try {
      await automationsApi.remove(a.id);
      setItems((list) => list.filter((x) => x.id !== a.id));
      toast.success("Automation deleted", a.name);
      void q.refetch({ silent: true });
    } catch {
      toast.error();
    }
  };

  const duplicate = async (a: Automation) => {
    try {
      const copy = await automationsApi.duplicate(a.id);
      setItems((list) => {
        const idx = list.findIndex((x) => x.id === a.id);
        return [...list.slice(0, idx + 1), copy, ...list.slice(idx + 1)];
      });
      toast.success("Automation duplicated", copy.name);
    } catch {
      toast.error();
    }
  };

  const openEdit = (a: Automation) => {
    setEditing(a);
    setEditForm({ name: a.name, description: a.description, trigger: a.trigger, condition: a.condition, action: a.action });
    window.history.replaceState(null, "", `/automations/${a.id}`);
  };
  const closeEdit = () => {
    setEditing(null);
    window.history.replaceState(null, "", "/automations");
  };
  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await automationsApi.update(editing.id, { name: editForm.name, description: editForm.description, trigger: editForm.trigger, condition: editForm.condition ?? "", action: editForm.action });
      setItems((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      toast.success("Automation saved", updated.name);
      closeEdit();
    } catch {
      toast.error();
    } finally {
      setSaving(false);
    }
  };

  const options = q.data?.options;
  const toOpts = (arr?: string[]) => (arr ?? []).map((v) => ({ value: v, label: v }));
  const logs = (q.data?.logs ?? []).filter((l) => !logsFilter || l.automationId === logsFilter);

  return (
    <>
      <Topbar
        title="Automations"
        subtitle="Turn Ring events into intelligent actions. Let Matan AI handle the routine, so you can focus on what matters."
        search={{ value: search, onChange: setSearch, placeholder: "Search automations…" }}
        actions={
          <Button
            variant="secondary"
            leftIcon={<ScrollText className="size-4" />}
            onClick={() => {
              setLogsFilter(null);
              setLogsOpen(true);
            }}
          >
            Automation Logs
          </Button>
        }
      />

      <Tabs items={catMeta.map((c) => ({ ...c, count: counts[c.value] ?? 0 }))} value={cat} onChange={setCat} aria-label="Automation categories" className="mb-5" />

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-3.5 xl:col-span-8">
            {q.loading ? (
              <div className="relative space-y-3.5 min-h-[520px]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[132px] rounded-card" />
                ))}
                <LoadingOverlay label="Loading automations" />
              </div>
            ) : items.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<Zap />}
                  title={debounced ? "No automations match your search" : "No automations in this category yet"}
                  description="Create one with the wizard, or start from a suggested automation."
                  action={
                    <Button leftIcon={<Plus className="size-4" />} onClick={() => wizardRef.current?.scrollIntoView({ behavior: "smooth" })}>
                      Create automation
                    </Button>
                  }
                />
              </div>
            ) : (
              items.map((a) => (
                <AutomationCard
                  key={a.id}
                  automation={a}
                  busy={busy === a.id}
                  onToggle={(v) => void toggle(a, v)}
                  onOpen={() => openEdit(a)}
                  menu={
                    <Menu
                      label={`${a.name} options`}
                      items={[
                        { label: "Edit", icon: <Pencil />, onSelect: () => openEdit(a) },
                        { label: "Duplicate", icon: <Copy />, onSelect: () => void duplicate(a) },
                        {
                          label: "View logs",
                          icon: <ListOrdered />,
                          onSelect: () => {
                            setLogsFilter(a.id);
                            setLogsOpen(true);
                          },
                        },
                        "separator",
                        { label: "Delete", icon: <Trash2 />, tone: "danger", onSelect: () => void remove(a) },
                      ]}
                    />
                  }
                />
              ))
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-5 xl:col-span-4">
            <section ref={wizardRef} className="card-hero p-5 scroll-mt-6" aria-labelledby="create-title">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_6px_18px_rgba(18,168,255,0.35)]">
                  <Plus className="size-5" />
                </span>
                <div>
                  <h2 id="create-title" className="text-[19px] font-bold text-text">
                    Create New Automation
                  </h2>
                  <p className="text-[13px] text-text-3">Set up a new automation with simple steps.</p>
                </div>
              </div>

              <ol className="mt-5 space-y-3">
                <li className="card-inset p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary"><Zap className="size-4" /></span>
                    <div>
                      <p className="text-[14.5px] font-semibold text-text">Trigger</p>
                      <p className="text-[12px] text-text-3">Choose what starts the automation.</p>
                    </div>
                  </div>
                  <Select fullWidth className="mt-3" value={wizard.trigger} onChange={(v) => setWizard((w) => ({ ...w, trigger: v }))} options={toOpts(options?.triggers)} placeholder="Select a trigger…" label="Trigger" disabled={!options} />
                </li>
                <li className="card-inset p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-cyan/12 text-cyan"><Filter className="size-4" /></span>
                    <div>
                      <p className="text-[14.5px] font-semibold text-text">
                        Condition <span className="font-normal text-text-3">(Optional)</span>
                      </p>
                      <p className="text-[12px] text-text-3">Add conditions to make it smarter.</p>
                    </div>
                  </div>
                  {wizard.showCondition ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Select fullWidth value={wizard.condition} onChange={(v) => setWizard((w) => ({ ...w, condition: v }))} options={toOpts(options?.conditions)} placeholder="Select a condition…" label="Condition" />
                      <Button variant="ghost" size="sm" onClick={() => setWizard((w) => ({ ...w, showCondition: false, condition: null }))}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button variant="subtle" fullWidth className="mt-3" leftIcon={<Plus className="size-4" />} onClick={() => setWizard((w) => ({ ...w, showCondition: true }))}>
                      Add condition
                    </Button>
                  )}
                </li>
                <li className="card-inset p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-success/12 text-success"><Cog className="size-4" /></span>
                    <div>
                      <p className="text-[14.5px] font-semibold text-text">Action</p>
                      <p className="text-[12px] text-text-3">Choose what Matan AI should do.</p>
                    </div>
                  </div>
                  <Select fullWidth className="mt-3" value={wizard.action} onChange={(v) => setWizard((w) => ({ ...w, action: v }))} options={toOpts(options?.actions)} placeholder="Select an action…" label="Action" disabled={!options} />
                </li>
              </ol>
              <Field label="Name (optional)" className="mt-3" htmlFor="aut-name">
                <Input id="aut-name" value={wizard.name} onChange={(e) => setWizard((w) => ({ ...w, name: e.target.value }))} placeholder="e.g. Evening porch light" />
              </Field>
              {wizard.trigger && wizard.action && (
                <div className="mt-3 rounded-xl border border-border bg-bg/40 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">Preview</p>
                  <AutomationFlow trigger={wizard.trigger} condition={wizard.showCondition ? wizard.condition ?? undefined : undefined} action={wizard.action} compact />
                </div>
              )}
              <Button fullWidth size="lg" className="mt-4" onClick={() => void create()} loading={creating} disabled={!wizard.trigger || !wizard.action}>
                Create Automation
              </Button>
            </section>

            <section className="card p-5" aria-labelledby="sug-title">
              <SectionHeader icon={<Sparkles />} title={<span id="sug-title">Suggested Automations</span>} subtitle="Quick setup for common use cases." href="/insights" iconTone="purple" />
              {q.loading ? (
                <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : q.data?.suggested.length === 0 ? (
                <p className="text-[13.5px] text-text-3">You&apos;ve added all suggested automations. Nice work.</p>
              ) : (
                <ul className="space-y-2">
                  {q.data?.suggested.map((s) => {
                    const t = toneStyles[s.tone as Tone];
                    return (
                      <li key={s.id}>
                        <button type="button" onClick={() => void create(s)} disabled={creating} className="card-inset flex w-full items-center gap-3 p-3 text-left transition-[border-color,background-color] hover:border-border-strong hover:bg-surface-2/60 disabled:opacity-60">
                          <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border", t.bg, t.border, t.text)}>
                            <Icon name={s.icon} className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-semibold text-text">{s.name}</span>
                            <span className="block text-[12.5px] text-text-3">{s.description}</span>
                          </span>
                          <ChevronRight className="size-4 text-text-3" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <AICallout tone="success" icon={<ShieldCheck />} title="Automations help create safer homes" description="and more peaceful communities." />
          </div>
        </div>
      )}

      {/* Logs drawer */}
      <Drawer open={logsOpen} onClose={() => setLogsOpen(false)} title="Automation Logs" description={logsFilter ? q.data?.items.find((a) => a.id === logsFilter)?.name : "Everything Matan AI did on your behalf"} width="max-w-lg">
        {logsFilter && (
          <Button variant="ghost" size="xs" className="mb-3" onClick={() => setLogsFilter(null)}>
            Show all automations
          </Button>
        )}
        {logs.length === 0 ? (
          <EmptyState compact icon={<ScrollText />} title="No log entries" description="Runs will appear here as automations trigger." />
        ) : (
          <ActivityTimeline
            items={logs.map((l) => ({
              id: l.id,
              time: (
                <>
                  {relativeDay(l.timestamp)}
                  <br />
                  {formatTime(l.timestamp)}
                </>
              ),
              title: l.automationName,
              subtitle: l.message,
              tone: l.status === "success" ? "success" : l.status === "skipped" ? "neutral" : "danger",
              icon: l.status === "success" ? <CircleCheck /> : l.status === "skipped" ? <CircleSlash /> : <TriangleAlert />,
            }))}
          />
        )}
      </Drawer>

      {/* Edit modal */}
      <Modal
        open={Boolean(editing)}
        onClose={closeEdit}
        title={editing ? `Edit “${editing.name}”` : "Edit"}
        description="Change what triggers this automation and what Matan AI does."
        icon={<Pencil />}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={closeEdit}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="edit-name">
                <Input id="edit-name" value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} data-autofocus />
              </Field>
              <Field label="Category">
                <div className="flex h-10.5 items-center">
                  <Badge tone="primary" size="md">{catMeta.find((c) => c.value === editing.category)?.label}</Badge>
                </div>
              </Field>
            </div>
            <Field label="Description" htmlFor="edit-desc">
              <Input id="edit-desc" value={editForm.description ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Trigger">
                <Select fullWidth value={editForm.trigger ?? null} onChange={(v) => setEditForm((f) => ({ ...f, trigger: v }))} options={toOpts([...(options?.triggers ?? []), ...(editing.trigger && !options?.triggers.includes(editing.trigger) ? [editing.trigger] : [])])} />
              </Field>
              <Field label="Condition">
                <Select fullWidth value={editForm.condition ?? null} onChange={(v) => setEditForm((f) => ({ ...f, condition: v }))} options={[{ value: "", label: "No condition" }, ...toOpts([...(options?.conditions ?? []), ...(editing.condition && !options?.conditions.includes(editing.condition) ? [editing.condition] : [])])]} placeholder="No condition" />
              </Field>
              <Field label="Action">
                <Select fullWidth value={editForm.action ?? null} onChange={(v) => setEditForm((f) => ({ ...f, action: v }))} options={toOpts([...(options?.actions ?? []), ...(editing.action && !options?.actions.includes(editing.action) ? [editing.action] : [])])} />
              </Field>
            </div>
            {editForm.trigger && editForm.action && <AutomationFlow trigger={editForm.trigger} condition={editForm.condition || undefined} action={editForm.action} compact />}
            <p className="text-xs text-text-3">
              Ran {editing.runsThisWeek} times this week{editing.lastRunAt ? ` · last run ${relativeDay(editing.lastRunAt).toLowerCase()} at ${formatTime(editing.lastRunAt)}` : ""}.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

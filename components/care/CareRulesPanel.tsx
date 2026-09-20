"use client";

import * as React from "react";
import { HeartHandshake, Moon, Bell, SlidersHorizontal, Plus, Pencil, Trash2, ShieldAlert, Eye, BellRing, Siren, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useApi } from "@/hooks/useApi";
import { careApi } from "@/lib/api/care";
import { ApiError } from "@/lib/api/client";
import { describeConditions } from "@/lib/matan/rules/evaluate";
import { RULE_ACTIONS, RULE_EVENT_TYPES } from "@/lib/matan/rules/context";
import type { CareContext, MatanRule, RuleAction, RuleEventType, Sensitivity } from "@/lib/matan/rules/types";

const TIMEZONES = ["Asia/Dili", "Asia/Jakarta", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/Lisbon", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"];
const SENS: { value: Sensitivity; label: string }[] = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];
export const ACTION_TONE: Record<RuleAction, "neutral" | "primary" | "warning" | "danger"> = { IGNORE: "neutral", MONITOR: "primary", NOTIFY: "warning", ESCALATE: "danger" };
export const ACTION_ICON: Record<RuleAction, React.ReactNode> = { IGNORE: <Eye className="size-3.5" />, MONITOR: <Eye className="size-3.5" />, NOTIFY: <BellRing className="size-3.5" />, ESCALATE: <Siren className="size-3.5" /> };

const errMsg = (e: unknown) => ((e as ApiError)?.payload as { error?: { message?: string } } | undefined)?.error?.message ?? (e instanceof Error ? e.message : "Please try again.");

/**
 * Care & Smart Rules - Matan-owned configuration layered on real Ring events.
 * Everything here is application logic; nothing is presented as a Ring capability.
 */
export function CareRulesPanel({ match = () => true }: { match?: (label: string) => boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const careQ = useApi(() => careApi.get(), []);
  const rulesQ = useApi(() => careApi.rules(), []);
  const [editing, setEditing] = React.useState<MatanRule | "new" | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const care = careQ.data?.context;
  const rules = rulesQ.data?.rules ?? [];

  const saveCare = async (patch: Parameters<typeof careApi.save>[0], label: string) => {
    try {
      const r = await careApi.save(patch);
      careQ.setData(() => r);
      toast.success(label);
    } catch (e) {
      toast.error("Not saved", errMsg(e));
    }
  };

  const toggleRule = async (rule: MatanRule, enabled: boolean) => {
    setBusy(rule.id);
    try {
      const r = await careApi.updateRule(rule.id, { enabled });
      rulesQ.setData((d) => ({ rules: (d?.rules ?? []).map((x) => (x.id === rule.id ? r.rule : x)) }));
      toast.success(`${rule.name} ${enabled ? "enabled" : "disabled"}`);
    } catch (e) {
      toast.error("Not saved", errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const removeRule = async (rule: MatanRule) => {
    if (!(await confirm({ title: `Delete rule "${rule.name}"?`, description: "Events already analyzed keep their recorded decision. This cannot be undone.", confirmLabel: "Delete rule" }))) return;
    setBusy(rule.id);
    try {
      await careApi.deleteRule(rule.id);
      rulesQ.setData((d) => ({ rules: (d?.rules ?? []).filter((x) => x.id !== rule.id) }));
      toast.success("Rule deleted");
    } catch (e) {
      toast.error("Not deleted", errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (careQ.loading || rulesQ.loading) return <Skeleton className="h-[420px] rounded-card" />;
  if (!care) return <p className="text-sm text-danger">Care context could not be loaded.{careQ.error ? ` ${careQ.error}` : ""}</p>;

  return (
    <div className="space-y-5">
      {/* Care Context */}
      {match("care context") && (
        <section className="card p-5" aria-labelledby="care-ctx">
          <CardHeader icon={<HeartHandshake />} title={<span id="care-ctx">Care Context</span>} subtitle="Matan-level settings applied on top of real Ring events. Not a Ring feature." />
          <div className="space-y-1">
            <SettingRow icon={<HeartHandshake />} title="Care context" hint={care.enabled ? "Smart rules decide Ignore / Monitor / Notify / Escalate for every analyzed event." : "Off - actions follow the Matan Decision Engine only."} control={<Toggle checked={care.enabled} onChange={(v) => void saveCare({ enabled: v }, v ? "Care context on" : "Care context off")} label="Care context" />} />
            <SettingRow icon={<SlidersHorizontal />} title="Timezone" hint="Quiet hours and time windows are evaluated in this zone." control={<Select size="sm" value={care.timezone} onChange={(v) => void saveCare({ timezone: v }, `Timezone: ${v}`)} options={[...new Set([care.timezone, ...TIMEZONES])].map((z) => ({ value: z, label: z }))} align="end" label="Timezone" />} />
            <SettingRow icon={<Moon />} title="Quiet hours" hint={care.quietHours.enabled ? `${care.quietHours.start} → ${care.quietHours.end} · high-risk events still escalate` : "Off"} tone="purple" control={<Toggle checked={care.quietHours.enabled} onChange={(v) => void saveCare({ quietHours: { enabled: v } }, v ? "Quiet hours on" : "Quiet hours off")} label="Quiet hours" />} />
            <div className="grid grid-cols-2 gap-3 px-2 pb-1 pt-1">
              <Field label="Start" htmlFor="qh-start">
                <Input id="qh-start" type="time" value={care.quietHours.start} onChange={(e) => e.target.value && void saveCare({ quietHours: { start: e.target.value } }, `Quiet hours start ${e.target.value}`)} />
              </Field>
              <Field label="End" htmlFor="qh-end">
                <Input id="qh-end" type="time" value={care.quietHours.end} onChange={(e) => e.target.value && void saveCare({ quietHours: { end: e.target.value } }, `Quiet hours end ${e.target.value}`)} />
              </Field>
            </div>
          </div>
        </section>
      )}

      {/* Sensitivity + notification prefs */}
      {match("sensitivity") && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5" aria-labelledby="care-sens">
            <CardHeader icon={<SlidersHorizontal />} title={<span id="care-sens">Sensitivity</span>} subtitle="High notifies on any such event; low only monitors." />
            <div className="space-y-1">
              {(["motion", "person", "package", "vehicle"] as const).map((k) => (
                <SettingRow key={k} icon={<Sparkles />} title={k.charAt(0).toUpperCase() + k.slice(1)} hint={{ low: "Monitor unless a rule says otherwise", medium: "Follow the Decision Engine", high: "Notify on every event of this type" }[care.sensitivity[k]]} control={<Select size="sm" value={care.sensitivity[k]} onChange={(v) => void saveCare({ sensitivity: { [k]: v as Sensitivity } }, `${k} sensitivity: ${v}`)} options={SENS} align="end" label={`${k} sensitivity`} />} />
              ))}
            </div>
          </section>
          <section className="card p-5" aria-labelledby="care-ntf">
            <CardHeader icon={<Bell />} title={<span id="care-ntf">Notifications</span>} subtitle="Applies to Notify and Escalate decisions; delivery uses the existing email alerts." />
            <div className="space-y-1">
              <SettingRow icon={<Bell />} title="Email notifications" hint="Send Notify / Escalate decisions to your alert email address." control={<Toggle checked={care.notificationPreferences.email} onChange={(v) => void saveCare({ notificationPreferences: { email: v } }, v ? "Email notifications on" : "Email notifications off")} label="Email notifications" />} />
              <SettingRow icon={<Info />} title="Low confidence" hint={care.notificationPreferences.lowConfidence ? "Low-confidence analyses may notify." : "Low-confidence analyses are monitored, not notified."} control={<Toggle checked={care.notificationPreferences.lowConfidence} onChange={(v) => void saveCare({ notificationPreferences: { lowConfidence: v } }, v ? "Low-confidence alerts on" : "Low-confidence alerts off")} label="Low confidence" />} />
              <SettingRow icon={<ShieldAlert />} title="Repeated events" hint="Escalate when the same activity repeats within the configured window." tone="danger" control={<Toggle checked={care.notificationPreferences.repeatedEvents} onChange={(v) => void saveCare({ notificationPreferences: { repeatedEvents: v } }, v ? "Repeated-event escalation on" : "Repeated-event escalation off")} label="Repeated events" />} />
            </div>
          </section>
        </div>
      )}

      {/* Rules */}
      {match("smart rules") && (
        <section className="card p-5" aria-labelledby="care-rules">
          <CardHeader icon={<ShieldAlert />} title={<span id="care-rules">Smart Rules</span>} subtitle="Deterministic - evaluated in this order after every analysis. Nova interprets; rules decide." action={<Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Create rule</Button>} />
          <ol className="space-y-2.5">
            {rules.map((r) => (
              <li key={r.id} className={cn("rounded-xl border p-3.5 transition-colors", r.enabled ? "border-border bg-surface-2/40" : "border-border/60 opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14.5px] font-semibold text-text">{r.name}</p>
                      <Badge tone={ACTION_TONE[r.action.type]} size="xs" uppercase icon={ACTION_ICON[r.action.type]}>{r.action.type}</Badge>
                      {r.builtin && <Badge tone="neutral" size="xs">Built-in</Badge>}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-text-3">If {describeConditions(r)} → {r.action.type.charAt(0) + r.action.type.slice(1).toLowerCase()}{r.builtin === "high-risk" ? " · overrides quiet hours" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle size="sm" checked={r.enabled} disabled={busy === r.id} onChange={(v) => void toggleRule(r, v)} label={`${r.name} enabled`} />
                    <Button size="xs" variant="ghost" leftIcon={<Pencil className="size-3.5" />} onClick={() => setEditing(r)}>Edit</Button>
                    {!r.builtin && <Button size="xs" variant="ghost" className="text-danger hover:bg-danger/10" leftIcon={<Trash2 className="size-3.5" />} onClick={() => void removeRule(r)}>Delete</Button>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11.5px] text-text-3">Precedence: low-confidence guard → high-risk escalation → your rules → repeated activity → quiet hours → sensitivity → Decision Engine default. A high-risk escalation is never suppressed by quiet hours.</p>
        </section>
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
    </div>
  );
}

function SettingRow({ icon, title, hint, control, tone = "primary" }: { icon: React.ReactNode; title: string; hint: string; control?: React.ReactNode; tone?: "primary" | "danger" | "warning" | "success" | "purple" }) {
  const tones = { primary: "bg-primary/12 border-primary/25 text-primary", danger: "bg-danger/12 border-danger/25 text-danger", warning: "bg-warning/12 border-warning/25 text-warning", success: "bg-success/12 border-success/25 text-success", purple: "bg-purple/12 border-purple/25 text-purple" };
  return (
    <div className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left">
      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-[18px]", tones[tone])}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-text">{title}</span>
        <span className="block text-[12.5px] text-text-3">{hint}</span>
      </span>
      {control}
    </div>
  );
}

/** Create / edit modal. Intentionally small: type, risk, time window, confidence, repetition, action. */
export function RuleEditor({ rule, open, onClose, onSaved }: { rule: MatanRule | null; open: boolean; onClose: () => void; onSaved: (rule: MatanRule, created: boolean) => void }) {
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [action, setAction] = React.useState<RuleAction>("NOTIFY");
  const [priority, setPriority] = React.useState(100);
  const [types, setTypes] = React.useState<RuleEventType[]>([]);
  const [risks, setRisks] = React.useState<string[]>([]);
  const [windowOn, setWindowOn] = React.useState(false);
  const [start, setStart] = React.useState("22:00");
  const [end, setEnd] = React.useState("06:00");
  const [minConf, setMinConf] = React.useState("");
  const [repeatOn, setRepeatOn] = React.useState(false);
  const [within, setWithin] = React.useState(10);
  const [occ, setOcc] = React.useState(3);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const c = rule?.conditions;
    setName(rule?.name ?? "");
    setAction(rule?.action.type ?? "NOTIFY");
    setPriority(rule?.priority ?? 100);
    setTypes(c?.eventTypes ?? []);
    setRisks(c?.riskLevels ?? []);
    setWindowOn(Boolean(c?.timeWindow));
    setStart(c?.timeWindow?.start ?? "22:00");
    setEnd(c?.timeWindow?.end ?? "06:00");
    setMinConf(c?.minimumConfidence !== undefined ? String(Math.round(c.minimumConfidence * 100)) : "");
    setRepeatOn(Boolean(c?.repeatedWithinMinutes));
    setWithin(c?.repeatedWithinMinutes ?? 10);
    setOcc(c?.minimumOccurrences ?? 3);
    setError(null);
  }, [open, rule]);

  const builtin = rule?.builtin;
  const submit = async () => {
    setSaving(true);
    setError(null);
    const conditions = {
      eventTypes: types.length ? types : null,
      riskLevels: risks.length ? risks : null,
      timeWindow: windowOn ? { start, end } : null,
      minimumConfidence: minConf === "" ? null : Number(minConf) / 100,
      repeatedWithinMinutes: repeatOn ? within : null,
      minimumOccurrences: repeatOn ? occ : null,
    };
    try {
      const payload = { name, priority, action: { type: action }, conditions } as unknown as Partial<MatanRule>;
      const r = rule ? await careApi.updateRule(rule.id, payload) : await careApi.createRule(payload);
      onSaved(r.rule, !rule);
      toast.success(rule ? "Rule updated" : "Rule created");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Modal open={open} onClose={onClose} title={rule ? `Edit rule` : "Create rule"} description={builtin ? `Built-in rule "${rule?.name}" - thresholds and action are editable; its place in the order is fixed.` : "If all conditions match, Matan applies the action."} size="md" icon={<ShieldAlert />} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={() => void submit()}>{rule ? "Save changes" : "Create rule"}</Button></>}>
      <div className="space-y-4">
        {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Field label="Name" htmlFor="rule-name"><Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Packages while away" maxLength={60} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Action" htmlFor="rule-action">
            <Select value={action} onChange={(v) => setAction(v as RuleAction)} options={RULE_ACTIONS.map((a) => ({ value: a, label: a.charAt(0) + a.slice(1).toLowerCase() }))} label="Action" fullWidth />
          </Field>
          <Field label="Order (lower runs first)" htmlFor="rule-priority"><Input id="rule-priority" type="number" min={0} max={1000} value={priority} onChange={(e) => setPriority(Number(e.target.value))} disabled={Boolean(builtin && builtin !== "package")} /></Field>
        </div>
        {(!builtin || builtin === "package" || builtin === "repeated") && (
          <Field label="Event types (any = all)">
            <div className="flex flex-wrap gap-1.5">
              {RULE_EVENT_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setTypes(toggleIn(types, t))} aria-pressed={types.includes(t)} className={cn("rounded-full border px-2.5 py-1 text-[12.5px] capitalize transition-colors", types.includes(t) ? "border-primary/50 bg-primary/12 text-primary" : "border-border text-text-2 hover:bg-surface-2")}>{t}</button>
              ))}
            </div>
          </Field>
        )}
        {(!builtin || builtin === "package" || builtin === "high-risk") && (
          <Field label="Risk levels (any = all)">
            <div className="flex flex-wrap gap-1.5">
              {["normal", "low", "medium", "high"].map((r) => (
                <button key={r} type="button" onClick={() => setRisks(toggleIn(risks, r))} aria-pressed={risks.includes(r)} className={cn("rounded-full border px-2.5 py-1 text-[12.5px] capitalize transition-colors", risks.includes(r) ? "border-primary/50 bg-primary/12 text-primary" : "border-border text-text-2 hover:bg-surface-2")}>{r}</button>
              ))}
            </div>
          </Field>
        )}
        {(!builtin || builtin === "package") && (
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-text">Only within a time window</span><Toggle size="sm" checked={windowOn} onChange={setWindowOn} label="Time window" /></div>
            {windowOn && <div className="mt-2 grid grid-cols-2 gap-3"><Field label="Start" htmlFor="rw-start"><Input id="rw-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="End" htmlFor="rw-end"><Input id="rw-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field></div>}
          </div>
        )}
        {(builtin === "low-confidence" || !builtin) && (
          <Field label={builtin === "low-confidence" ? "Confidence below (%)" : "Minimum confidence (%)"} htmlFor="rule-conf" hint={builtin === "low-confidence" ? "Analyses under this confidence are monitored instead of notified." : "Leave empty to ignore confidence."}><Input id="rule-conf" type="number" min={0} max={100} value={minConf} onChange={(e) => setMinConf(e.target.value)} placeholder="e.g. 70" /></Field>
        )}
        {(!builtin || builtin === "repeated") && (
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-text">Repeated activity</span><Toggle size="sm" checked={repeatOn} onChange={setRepeatOn} label="Repeated activity" /></div>
            {repeatOn && <div className="mt-2 grid grid-cols-2 gap-3"><Field label="At least (events)" htmlFor="rw-occ"><Input id="rw-occ" type="number" min={2} max={100} value={occ} onChange={(e) => setOcc(Number(e.target.value))} /></Field><Field label="Within (minutes)" htmlFor="rw-min"><Input id="rw-min" type="number" min={1} max={1440} value={within} onChange={(e) => setWithin(Number(e.target.value))} /></Field></div>}
          </div>
        )}
        {builtin === "quiet-hours" && <p className="text-[12.5px] text-text-3">Quiet hours themselves are set in Care Context. This rule only chooses what happens to non-escalated events during them.</p>}
      </div>
    </Modal>
  );
}

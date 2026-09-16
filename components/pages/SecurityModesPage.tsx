"use client";

import * as React from "react";
import { Clock, Info, ExternalLink, Settings2, Video, Cctv, Bell, ShieldCheck, Pencil, Power, MoreHorizontal, CalendarDays } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useAppData } from "@/components/layout/AppDataProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SecurityModeCard, ModeIllustration } from "@/components/matan/SecurityModeCard";
import { ProtectionPill } from "@/components/matan/EventStatus";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { ActivityTimeline } from "@/components/matan/ActivityTimeline";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useApi } from "@/hooks/useApi";
import { securityModesApi } from "@/lib/api/securityModes";
import { formatTime, relativeDay, formatDate } from "@/lib/utils/format";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";
import type { SecurityMode, SecurityModeId } from "@/lib/types";
import { useAppMode } from "@/components/experience/experience-provider";
import { SourceBadge } from "@/components/experience/source-badge";

export function SecurityModesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { refresh: refreshShell, data: shell } = useAppData();
  const q = useApi(() => securityModesApi.get(), []);
  const appMode = useAppMode();
  const [viewId, setViewId] = React.useState<SecurityModeId | null>(null);
  const [activating, setActivating] = React.useState<SecurityModeId | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [learnOpen, setLearnOpen] = React.useState(false);
  const [sensitivity, setSensitivity] = React.useState<"Low" | "Medium" | "High">("Medium");

  const d = q.data;
  const activeId = d?.activeModeId;
  const view: SecurityMode | undefined = d?.modes.find((m) => m.id === (viewId ?? activeId));
  const isViewActive = view?.id === activeId;

  const activate = async (id: SecurityModeId) => {
    const mode = d?.modes.find((m) => m.id === id);
    if (!mode) return;
    if (id === "away") {
      const ok = await confirm({ title: "Switch to Away Mode?", description: "Every person who isn't a recognised family member will trigger an immediate alert.", confirmLabel: "Activate Away Mode", tone: "default", icon: <ShieldCheck /> });
      if (!ok) return;
    }
    setActivating(id);
    try {
      const res = await securityModesApi.activate(id);
      q.setData(res);
      setViewId(id);
      toast.success(`${mode.name} activated`, `Alert level: ${mode.alertLevel}. Matan AI adapted your monitoring.`);
      void refreshShell();
    } catch {
      toast.error();
    } finally {
      setActivating(null);
    }
  };

  const setSetting = async (key: string, enabled: boolean) => {
    if (!view) return;
    q.setData((s) => (s ? { ...s, modes: s.modes.map((m) => (m.id === view.id ? { ...m, settings: m.settings.map((x) => (x.key === key ? { ...x, enabled } : x)) } : m)) } : s));
    try {
      await securityModesApi.setSetting(view.id, key, enabled);
      const label = view.settings.find((s) => s.key === key)?.label ?? "Setting";
      toast.success(`${label} ${enabled ? "enabled" : "disabled"}`, `${view.name}${isViewActive ? " · applied now" : ""}`);
    } catch {
      toast.error();
      void q.refetch({ silent: true });
    }
  };

  const setSchedule = async (id: string, enabled: boolean) => {
    try {
      q.setData(await securityModesApi.setSchedule(id, enabled));
      toast.success(enabled ? "Schedule enabled" : "Schedule disabled");
    } catch {
      toast.error();
    }
  };

  const setScheduleMaster = async (enabled: boolean) => {
    if (!enabled) {
      const ok = await confirm({ title: "Turn off automatic mode switching?", description: "Matan AI will stop switching modes on schedule. Your current mode stays active until you change it.", confirmLabel: "Turn off" });
      if (!ok) return;
    }
    try {
      q.setData(await securityModesApi.setScheduleEnabled(enabled));
      toast.success(enabled ? "Automatic switching on" : "Automatic switching off");
    } catch {
      toast.error();
    }
  };

  const level = shell?.todayCounts.important ? "review" : "protected";

  return (
    <>
      <Topbar title={<span className="flex flex-wrap items-center gap-3">Security Modes <SourceBadge source={appMode === "ring" ? "ring" : "demo"} short /></span>} subtitle={appMode === "ring" ? "Matan-level policies applied to Ring-derived events. Choose the right mode for your lifestyle." : "Matan-level policies applied to simulated events. Choose the right mode for your lifestyle."} status={<ProtectionPill modeName={d?.status.activeModeName ?? shell?.activeModeName} level={level} className="hidden md:inline-flex" />} />

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-9">
            {/* Mode cards */}
            {q.loading || !d ? (
              <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 min-h-[340px]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[330px] rounded-card" />
                ))}
                <LoadingOverlay label="Loading security modes" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {d.modes.map((m) => (
                  <SecurityModeCard key={m.id} mode={m} active={m.id === activeId} busy={activating === m.id} onActivate={() => void activate(m.id)} onCustomize={() => setViewId(m.id)} className={cn(view?.id === m.id && m.id !== activeId && "border-border-strong")} />
                ))}
              </div>
            )}

            {/* Selected mode detail */}
            {view && (
              <section className="card p-5" aria-labelledby="mode-detail">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <ModeIllustration mode={view} size="sm" className="!size-16 rounded-2xl [&_span]:size-10 [&_span>svg]:size-5" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 id="mode-detail" className="text-[24px] font-bold text-text">
                          {view.name}
                        </h2>
                        {isViewActive ? (
                          <Badge tone="success" size="md" variant="solid" icon={<ShieldCheck className="size-3.5" />}>
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="neutral" size="md">
                            Not active
                          </Badge>
                        )}
                        <Badge tone={view.alertLevel === "Strict" ? "danger" : view.alertLevel === "Elevated" ? "warning" : "primary"} size="md" variant="outline">
                          {view.alertLevel} alerts
                        </Badge>
                      </div>
                      <p className="mt-1 text-[15px] text-text-2">{view.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isViewActive && (
                      <Button onClick={() => void activate(view.id)} loading={activating === view.id} leftIcon={<Power className="size-4" />}>
                        Activate
                      </Button>
                    )}
                    <Button variant="secondary" leftIcon={<Settings2 className="size-4" />} onClick={() => setEditOpen(true)}>
                      Edit Mode Settings
                    </Button>
                  </div>
                </div>

                <h3 className="mt-5 text-[16px] font-semibold text-text">Mode Settings</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {view.settings.map((s) => (
                    <div key={s.key} className={cn("card-inset flex items-center gap-3 p-3.5 transition-colors", !s.enabled && "opacity-75")}>
                      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border", s.enabled ? "bg-primary/12 border-primary/25 text-primary" : "bg-surface-3/60 border-border text-text-3")}>
                        <Icon name={s.icon} className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-text">{s.label}</p>
                        <p className="truncate text-[12.5px] text-text-3">{s.enabled ? s.hint : "Disabled"}</p>
                      </div>
                      <Toggle checked={s.enabled} onChange={(v) => void setSetting(s.key, v)} label={`${s.label} in ${view.name}`} size="sm" />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-bg/40 p-4">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-text-2">
                    <Info className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-text">How it works</p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-text-2">{view.howItWorks}</p>
                  </div>
                  <Button variant="secondary" leftIcon={<ExternalLink className="size-4" />} onClick={() => setLearnOpen(true)}>
                    Learn More
                  </Button>
                </div>
              </section>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-5 xl:col-span-3">
            <section className="card p-5" aria-labelledby="sched-title">
              <SectionHeader icon={<Clock />} title={<span id="sched-title">Schedule & Automation</span>} subtitle="Let Matan AI switch modes automatically." action={d ? <Toggle checked={d.scheduleEnabled} onChange={(v) => void setScheduleMaster(v)} label="Automatic mode switching" /> : <Skeleton className="h-6 w-11 rounded-full" />} />
              {q.loading || !d ? (
                <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
              ) : (
                <ul className={cn("space-y-2 transition-opacity", !d.scheduleEnabled && "opacity-60")}>
                  {d.schedules.map((s) => {
                    const mode = d.modes.find((m) => m.id === s.modeId);
                    const t = toneStyles[(mode?.tone as Tone) ?? "primary"];
                    return (
                      <li key={s.id} className="card-inset flex items-center gap-3 p-3">
                        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl border", t.bg, t.border, t.text)}>
                          <Icon name={s.id === "sch-custom" ? "CalendarDays" : mode?.icon ?? "Clock"} className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-text">{s.label}</span>
                          <span className="block truncate text-[12.5px] text-text-3">{s.window}</span>
                        </span>
                        <Menu
                          triggerSize="sm"
                          triggerVariant="ghost"
                          label={`${s.label} options`}
                          items={[
                            { label: s.enabled ? "Disable schedule" : "Enable schedule", icon: <Power />, onSelect: () => void setSchedule(s.id, !s.enabled) },
                            { label: "Edit times", icon: <Pencil />, onSelect: () => toast.info("Schedule editor", "Custom times are part of a later phase; toggle schedules on/off here.") },
                            { label: "Activate now", icon: <ShieldCheck />, onSelect: () => void activate(s.modeId), disabled: s.modeId === activeId },
                          ]}
                          trigger={
                            <button type="button" aria-label={`${s.label} options`} className="inline-flex size-8 items-center justify-center rounded-lg text-text-3 hover:bg-surface-3 hover:text-text">
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card p-5" aria-labelledby="status-title">
              <SectionHeader
                icon={<ShieldCheck />}
                title={<span id="status-title">Current Status</span>}
                iconTone="success"
                action={
                  <Badge tone={level === "protected" ? "success" : "warning"} size="sm" icon={<ShieldCheck className="size-3" />}>
                    {level === "protected" ? "All Secure" : "Review"}
                  </Badge>
                }
              />
              {q.loading || !d ? (
                <Skeleton className="h-24" />
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="card-inset flex flex-col items-center gap-1 p-3 text-center">
                    <Video className="size-5 text-primary" aria-hidden />
                    <span className="text-[22px] font-bold leading-none text-text tabular-nums">{d.status.camerasOnline}</span>
                    <span className="text-[11px] text-text-3">{d.status.camerasTotal} Cameras<br />Online</span>
                  </div>
                  <div className="card-inset flex flex-col items-center gap-1 p-3 text-center">
                    <Cctv className="size-5 text-primary" aria-hidden />
                    <span className="text-[22px] font-bold leading-none text-text tabular-nums">{d.status.devicesOnline}</span>
                    <span className="text-[11px] text-text-3">{d.status.devicesTotal} Devices<br />Online</span>
                  </div>
                  <div className="card-inset flex flex-col items-center gap-1 p-3 text-center">
                    <Bell className="size-5 text-warning" aria-hidden />
                    <span className={cn("text-[15px] font-bold leading-tight", d.status.alertLevel === "Strict" ? "text-danger" : d.status.alertLevel === "Elevated" ? "text-warning" : "text-warning")}>{d.status.alertLevel}</span>
                    <span className="text-[11px] text-text-3">Alert Level<br />{d.status.activeModeName}</span>
                  </div>
                </div>
              )}
            </section>

            <section className="card p-5" aria-labelledby="recent-title">
              <SectionHeader title={<span id="recent-title">Recent Mode Activity</span>} href="/events?category=others" />
              {q.loading || !d ? (
                <Skeleton className="h-40" />
              ) : (
                <ActivityTimeline
                  compact
                  items={d.activity.slice(0, 5).map((a) => {
                    const mode = d.modes.find((m) => m.id === a.modeId);
                    return {
                      id: a.id,
                      time: (
                        <>
                          {relativeDay(a.timestamp) === "Today" || relativeDay(a.timestamp) === "Yesterday" ? relativeDay(a.timestamp) : formatDate(a.timestamp).slice(0, 6)}
                          <br />
                          {formatTime(a.timestamp)}
                        </>
                      ),
                      title: a.label,
                      subtitle: a.source,
                      tone: (mode?.tone as Tone) ?? "primary",
                      icon: <Icon name={mode?.icon ?? "ShieldCheck"} />,
                    };
                  })}
                />
              )}
            </section>
          </div>
        </div>
      )}

      {/* Edit settings drawer */}
      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title={view ? `${view.name} settings` : "Mode settings"} description="Fine-tune how Matan AI monitors in this mode." width="max-w-md">
        {view && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-text-2">Detection sensitivity</p>
              <Select fullWidth value={sensitivity} onChange={(v) => { setSensitivity(v); toast.success("Sensitivity updated", `${view.name} · ${v}`); }} options={[{ value: "Low", label: "Low", description: "Fewer alerts, only clear detections" }, { value: "Medium", label: "Medium", description: "Balanced (recommended)" }, { value: "High", label: "High", description: "Catch everything, more alerts" }]} />
            </div>
            <ul className="space-y-2">
              {view.settings.map((s) => (
                <li key={s.key} className="card-inset flex items-center gap-3 p-3">
                  <Icon name={s.icon} className={cn("size-5 shrink-0", s.enabled ? "text-primary" : "text-text-3")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-text">{s.label}</span>
                    <span className="block text-[12px] text-text-3">{s.hint}</span>
                  </span>
                  <Toggle size="sm" checked={s.enabled} onChange={(v) => void setSetting(s.key, v)} label={s.label} />
                </li>
              ))}
            </ul>
            <Button fullWidth onClick={() => { setEditOpen(false); toast.success("Mode settings saved", view.name); }}>
              Done
            </Button>
          </div>
        )}
      </Drawer>

      <Modal open={learnOpen} onClose={() => setLearnOpen(false)} title={view ? `About ${view.name}` : "About"} icon={<Info />} size="md" footer={<Button onClick={() => setLearnOpen(false)}>Got it</Button>}>
        {view && (
          <div className="space-y-3 text-[14px] leading-relaxed text-text-2">
            <p>{view.howItWorks}</p>
            <p>
              <span className="font-semibold text-text">Alert level:</span> {view.alertLevel}. {view.alertLevel === "Normal" ? "Routine activity is summarised; only notable events notify you." : view.alertLevel === "Elevated" ? "Entrance activity and unknown people notify you quickly." : "Every detection is treated as potentially important."}
            </p>
            <p className="text-text-3 text-[13px]">In this preview, modes change how Matan AI classifies mock events. Real Ring device settings are applied in a later phase.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, List, Cctv, BellRing, Lock, Speaker, WifiOff, Link2, Wrench, CircleHelp, BookOpen, LifeBuoy, ChevronRight, Activity, Pencil, Trash2, RotateCw, Power, Video, ListOrdered, MapPin } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useAppData } from "@/components/layout/AppDataProvider";
import { SourceBadge, DemoMarker } from "@/components/experience/source-badge";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Menu } from "@/components/ui/Menu";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Field, Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { StatusDot } from "@/components/ui/StatusDot";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DeviceCard, DeviceVitals, deviceKindIcon, deviceKindLabel } from "@/components/matan/DeviceCard";
import { RingBadge } from "@/components/matan/Brand";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { EventLine } from "@/components/matan/EventCard";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { devicesApi } from "@/lib/api/devices";
import { eventsApi } from "@/lib/api/events";
import { relativeDayTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Device, DeviceKind } from "@/lib/types";

type Tab = "all" | DeviceKind | "offline";
type SortKey = "name" | "status" | "location" | "battery";

const sortOptions = [
  { value: "name" as SortKey, label: "Name (A-Z)" },
  { value: "status" as SortKey, label: "Status" },
  { value: "location" as SortKey, label: "Location" },
  { value: "battery" as SortKey, label: "Battery" },
];

export interface DemoDevicesViewProps {
  initialDeviceId?: string;
  /** Opens the real Ring Playground Add Device flow. */
  onAddRing: () => void;
  /** Rendered next to the tabs so the user can switch between Ring and demo devices. */
  sourceSwitch?: React.ReactNode;
}

/**
 * Demo devices (local sample data). Explicit opt-in per the Ring integration spec:
 * it is never shown as a fallback for a failed or expired Ring connection.
 */
export function DemoDevicesView({ initialDeviceId, onAddRing, sourceSwitch }: DemoDevicesViewProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { refresh: refreshShell } = useAppData();
  const q = useApi(() => devicesApi.list(), []);
  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 200);
  const [sort, setSort] = React.useState<SortKey>("name");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = React.useState(false);
  const [helpTopic, setHelpTopic] = React.useState<string | null>(null);
  const [addForm, setAddForm] = React.useState({ name: "", kind: "camera" as DeviceKind, location: "" });
  const [adding, setAdding] = React.useState(false);
  const [renaming, setRenaming] = React.useState<Device | null>(null);
  const [renameVal, setRenameVal] = React.useState("");
  const [detailId, setDetailId] = React.useState<string | null>(initialDeviceId ?? null);
  const [testing, setTesting] = React.useState<string | null>(null);

  const items = q.data?.items ?? [];
  const summary = q.data?.summary;
  const detail = items.find((d) => d.id === detailId) ?? null;
  const detailEvents = useApi(() => (detailId ? eventsApi.list({ range: "30d", cameraId: detailId, pageSize: 5 }) : Promise.resolve(null)), [detailId]);

  React.useEffect(() => {
    window.history.replaceState(null, "", detailId ? `/devices/${detailId}` : "/devices");
  }, [detailId]);

  const filtered = items
    .filter((d) => (tab === "all" ? true : tab === "offline" ? d.status === "offline" : d.kind === tab))
    .filter((d) => !debounced || `${d.name} ${d.model} ${d.location}`.toLowerCase().includes(debounced.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "status") return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
      if (sort === "location") return a.location.localeCompare(b.location);
      return (b.battery ?? 101) - (a.battery ?? 101);
    });

  const patchLocal = (updated: Device) => q.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) } : d));

  const runTest = async (d: Device) => {
    setTesting(d.id);
    try {
      const res = await devicesApi.run(d.id, "test");
      toast.success(res.result, `${d.name} · connection, motion and audio OK`);
    } catch {
      toast.error();
    } finally {
      setTesting(null);
    }
  };

  const restart = async (d: Device) => {
    try {
      const res = await devicesApi.run(d.id, "restart");
      toast.success(res.result, d.name);
    } catch {
      toast.error();
    }
  };

  const setStatus = async (d: Device, status: Device["status"]) => {
    try {
      patchLocal(await devicesApi.update(d.id, { status }));
      await q.refetch({ silent: true });
      void refreshShell();
      toast.success(status === "online" ? "Device back online" : "Device set offline (demo)", d.name);
    } catch {
      toast.error();
    }
  };

  const remove = async (d: Device) => {
    const ok = await confirm({ title: `Remove ${d.name}?`, description: "The device will be unlinked from Matan AI. Its recorded events stay in your history.", confirmLabel: "Remove device" });
    if (!ok) return;
    try {
      await devicesApi.remove(d.id);
      await q.refetch({ silent: true });
      if (detailId === d.id) setDetailId(null);
      void refreshShell();
      toast.success("Device removed", d.name);
    } catch {
      toast.error();
    }
  };

  const rename = async () => {
    if (!renaming || !renameVal.trim()) return;
    try {
      patchLocal(await devicesApi.update(renaming.id, { name: renameVal.trim() }));
      toast.success("Device renamed", renameVal.trim());
      setRenaming(null);
      void refreshShell();
    } catch {
      toast.error();
    }
  };

  const add = async () => {
    if (!addForm.name.trim()) {
      toast.warning("Give the device a name");
      return;
    }
    setAdding(true);
    try {
      await devicesApi.add({ name: addForm.name.trim(), kind: addForm.kind, location: addForm.location.trim() || "Unassigned" });
      await q.refetch({ silent: true });
      void refreshShell();
      setAddOpen(false);
      setAddForm({ name: "", kind: "camera", location: "" });
      toast.success("Device added", `${addForm.name.trim()} is online (demo).`);
    } catch {
      toast.error();
    } finally {
      setAdding(false);
    }
  };

  const setSetting = async (d: Device, key: keyof Device["settings"], value: boolean) => {
    try {
      patchLocal(await devicesApi.update(d.id, { settings: { [key]: value } }));
      toast.success("Setting saved", `${d.name} · ${String(key).replace(/([A-Z])/g, " $1").toLowerCase()} ${value ? "on" : "off"}`);
    } catch {
      toast.error();
    }
  };

  const menuFor = (d: Device) => (
    <Menu
      label={`${d.name} options`}
      items={[
        { label: "Device details", icon: <Activity />, onSelect: () => setDetailId(d.id) },
        { label: testing === d.id ? "Testing…" : "Test device", icon: <Wrench />, onSelect: () => void runTest(d), disabled: testing === d.id },
        { label: "Restart", icon: <RotateCw />, onSelect: () => void restart(d) },
        { label: "Rename", icon: <Pencil />, onSelect: () => { setRenaming(d); setRenameVal(d.name); } },
        { label: d.status === "online" ? "Simulate offline" : "Bring back online", icon: <Power />, onSelect: () => void setStatus(d, d.status === "online" ? "offline" : "online"), description: "Demo control" },
        "separator",
        { label: "Remove device", icon: <Trash2 />, tone: "danger", onSelect: () => void remove(d) },
      ]}
    />
  );

  const byKind = summary?.byKind;
  const tabs = [
    { value: "all" as Tab, label: "All Devices", icon: <LayoutGrid />, count: summary?.total },
    { value: "camera" as Tab, label: "Cameras", icon: <Cctv />, count: byKind?.camera },
    { value: "doorbell" as Tab, label: "Doorbells", icon: <BellRing />, count: byKind?.doorbell },
    { value: "lock" as Tab, label: "Locks", icon: <Lock />, count: byKind?.lock },
    { value: "chime" as Tab, label: "Chimes", icon: <Speaker />, count: byKind?.chime },
    { value: "offline" as Tab, label: "Offline", icon: <WifiOff />, count: summary?.offline },
  ];

  const helpItems = [
    { key: "setup", label: "Set up a new device", icon: <Plus />, body: "Open the Ring app, add the device to your Ring account, then link it here with “Link Ring Account”. Matan AI starts analysing its events within minutes." },
    { key: "trouble", label: "Troubleshoot device issues", icon: <Wrench />, body: "Check Wi-Fi signal (aim for 70%+), battery level and firmware. Use “Test device” from a device menu to run a connection, motion and audio check." },
    { key: "guide", label: "Ring user guide", icon: <BookOpen />, body: "Ring’s official guides cover placement, privacy zones and motion sensitivity. Matan AI works with any Ring camera or doorbell." },
    { key: "support", label: "Contact support", icon: <LifeBuoy />, body: "Reach the Matan AI team at support@matan.ai. Include your device model and the time of the issue so we can help quickly." },
  ];

  return (
    <>
      <Topbar
        title={<span className="flex flex-wrap items-center gap-3">Demo Devices <SourceBadge source="demo" short /></span>}
        subtitle="Explore Matan AI using simulated devices."
        search={{ value: search, onChange: setSearch, placeholder: "Search devices…" }}
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={onAddRing}>
            Add Ring Device
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {sourceSwitch}
          <Tabs items={tabs} value={tab} onChange={setTab} aria-label="Device types" />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onChange={setSort} options={sortOptions} prefix="Sort by" size="sm" align="end" label="Sort devices" />
          <div className="inline-flex rounded-control border border-border bg-surface-2/70 p-0.5" role="group" aria-label="View">
            <IconButton label="Grid view" size="sm" variant={view === "grid" ? "primary" : "ghost"} onClick={() => setView("grid")} aria-pressed={view === "grid"} className="rounded-[9px]">
              <LayoutGrid />
            </IconButton>
            <IconButton label="List view" size="sm" variant={view === "list" ? "primary" : "ghost"} onClick={() => setView("list")} aria-pressed={view === "list"} className="rounded-[9px]">
              <List />
            </IconButton>
          </div>
        </div>
      </div>

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12 [&>*]:min-w-0">
          <div className="min-w-0 xl:col-span-9">
            {q.loading ? (
              <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3 min-h-[480px] [&>*]:min-w-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[360px] rounded-card" />
                ))}
                <LoadingOverlay label="Finding your devices" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="card">
                <EmptyState icon={tab === "offline" ? <WifiOff /> : <Cctv />} title={tab === "offline" ? "All devices are online" : "No devices found"} description={tab === "offline" ? "Nothing needs your attention." : "Try another category or add a new Ring device."} action={<Button leftIcon={<Plus className="size-4" />} onClick={onAddRing}>Add Ring Device</Button>} />
              </div>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                {filtered.map((d) => (
                  <DeviceCard key={d.id} device={d} onLive={() => router.push(`/live?camera=${d.id}`)} onEvents={() => router.push(`/events?search=${encodeURIComponent(d.name)}`)} menu={menuFor(d)} />
                ))}
                <button type="button" onClick={onAddRing} className="flex min-h-[320px] flex-col items-center justify-center rounded-card border-2 border-dashed border-primary/30 bg-primary/[0.04] p-6 text-center transition-[border-color,background-color] hover:border-primary/60 hover:bg-primary/[0.08]">
                  <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Plus className="size-7" />
                  </span>
                  <span className="mt-4 text-[17px] font-semibold text-text">Add a Ring Device</span>
                  <span className="mt-1 max-w-[240px] text-[13px] text-text-3">Connect real Ring devices through the Ring Developer Playground.</span>
                  <span className="mt-5 inline-flex h-10.5 items-center rounded-control bg-gradient-to-b from-primary-2 to-primary px-5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(18,168,255,0.28)]">Add Ring Device</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((d) => (
                  <DeviceCard key={d.id} device={d} view="list" onLive={() => router.push(`/live?camera=${d.id}`)} onEvents={() => router.push(`/events?search=${encodeURIComponent(d.name)}`)} menu={menuFor(d)} />
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-5 xl:col-span-3">
            <section className="card p-5" aria-labelledby="sum-title">
              <SectionHeader icon={<Activity />} title={<span id="sum-title">Device Summary</span>} />
              {summary ? (
                <div className="grid grid-cols-3 divide-x divide-border [&>*]:min-w-0">
                  <div className="pr-3">
                    <div className="text-[26px] font-bold leading-none text-text tabular-nums">{summary.total}</div>
                    <div className="mt-1 text-[12px] text-text-3">Total Devices</div>
                  </div>
                  <div className="px-3">
                    <div className="flex items-center gap-1.5 text-[26px] font-bold leading-none text-text tabular-nums">
                      <StatusDot tone="success" /> {summary.online}
                    </div>
                    <div className="mt-1 text-[12px] text-text-3">Online</div>
                  </div>
                  <div className="pl-3">
                    <div className="flex items-center gap-1.5 text-[26px] font-bold leading-none text-text tabular-nums">
                      <StatusDot tone="danger" /> {summary.offline}
                    </div>
                    <div className="mt-1 text-[12px] text-text-3">Offline</div>
                  </div>
                </div>
              ) : (
                <Skeleton className="h-14" />
              )}
            </section>

            <section className="card p-5" aria-labelledby="types-title">
              <h2 id="types-title" className="mb-3 text-[16px] font-semibold text-text">
                Device Types
              </h2>
              <ul className="space-y-2.5">
                {(["camera", "doorbell", "lock", "chime"] as DeviceKind[]).map((k) => {
                  const Icon = deviceKindIcon[k];
                  return (
                    <li key={k}>
                      <button type="button" onClick={() => setTab(k)} className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-surface-2/70">
                        <span className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-2">
                          <Icon className="size-4" />
                        </span>
                        <span className="flex-1 text-[14px] text-text-2">{deviceKindLabel[k]}s</span>
                        <span className="text-[15px] font-semibold tabular-nums text-text">{byKind?.[k] ?? "–"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card p-5" aria-labelledby="add-title">
              <SectionHeader icon={<Link2 />} title={<span id="add-title">Add Ring Device</span>} subtitle="Connect real devices with a Ring Playground token, or add a sample device." />
              <Button fullWidth onClick={onAddRing} className="justify-center">
                <span className="mr-1 font-extrabold tracking-tight lowercase">ring</span> Connect Ring Playground
              </Button>
              <Button fullWidth variant="secondary" className="mt-2" leftIcon={<Cctv className="size-4" />} onClick={() => setAddOpen(true)}>
                Add demo device
              </Button>
            </section>

            <section className="card p-5" aria-labelledby="help-title">
              <SectionHeader icon={<CircleHelp />} title={<span id="help-title">Need Help?</span>} />
              <ul className="space-y-1">
                {helpItems.map((h) => (
                  <li key={h.key}>
                    <button type="button" onClick={() => setHelpTopic(h.key)} className="flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left text-[14px] text-text-2 transition-colors hover:bg-surface-2/70 hover:text-text">
                      <span className="text-primary [&>svg]:size-4">{h.icon}</span>
                      <span className="flex-1">{h.label}</span>
                      <ChevronRight className="size-4 text-text-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* Add device */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a demo device" description="Creates a sample device with local data. To connect a real Ring device, use Add Ring Device." icon={<Plus />} footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={() => void add()} loading={adding}>Add demo device</Button></>}>
        <div className="space-y-4">
          <Field label="Device name" htmlFor="dev-name">
            <Input id="dev-name" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Garage Camera" data-autofocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <Field label="Type">
              <Select fullWidth value={addForm.kind} onChange={(v) => setAddForm((f) => ({ ...f, kind: v }))} options={(["camera", "doorbell", "lock", "chime"] as DeviceKind[]).map((k) => ({ value: k, label: deviceKindLabel[k] }))} />
            </Field>
            <Field label="Location" htmlFor="dev-loc">
              <Input id="dev-loc" value={addForm.location} onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Garage" />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Rename */}
      <Modal open={Boolean(renaming)} onClose={() => setRenaming(null)} title="Rename device" icon={<Pencil />} size="sm" footer={<><Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button><Button onClick={() => void rename()} disabled={!renameVal.trim()}>Save</Button></>}>
        <Field label="Name" htmlFor="rename">
          <Input id="rename" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void rename()} data-autofocus />
        </Field>
      </Modal>

      {/* Help */}
      <Modal open={Boolean(helpTopic)} onClose={() => setHelpTopic(null)} title={helpItems.find((h) => h.key === helpTopic)?.label} icon={<CircleHelp />} size="sm" footer={<Button onClick={() => setHelpTopic(null)}>Got it</Button>}>
        <p className="text-[14px] leading-relaxed text-text-2">{helpItems.find((h) => h.key === helpTopic)?.body}</p>
      </Modal>

      {/* Device detail drawer */}
      <Drawer open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.name} description={detail ? `${detail.model} · ${detail.location}` : undefined} width="max-w-lg">
        {detail && (
          <div className="space-y-5">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border">
              <SafeImage src={detail.previewUrl} alt="" sizes="480px" grayscale={detail.status === "offline"} fallbackLabel={deviceKindLabel[detail.kind]} />
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <Badge tone={detail.status === "online" ? "success" : "danger"} dot>{detail.status === "online" ? "Online" : "Offline"}</Badge>
                {detail.isRing && <RingBadge size="xs" />}
              </div>
            </div>
            <DeviceVitals device={detail} className="text-[13px]" />
            <div className="flex gap-2">
              {(detail.kind === "camera" || detail.kind === "doorbell") && (
                <Button className="flex-1" leftIcon={<Video className="size-4" />} href={`/live?camera=${detail.id}`} disabled={detail.status === "offline"}>
                  Live View
                </Button>
              )}
              <Button variant="secondary" className="flex-1" leftIcon={<ListOrdered className="size-4" />} href={`/events?search=${encodeURIComponent(detail.name)}`}>
                Events
              </Button>
              <Button variant="secondary" leftIcon={<Wrench className="size-4" />} onClick={() => void runTest(detail)} loading={testing === detail.id}>
                Test
              </Button>
            </div>
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-text">Device settings</h3>
              <ul className="space-y-2">
                {(
                  [
                    ["motionAlerts", "Motion Alerts", "Notify when motion is detected"],
                    ["aiDetection", "AI Detection", "Matan AI analyses every event"],
                    ["audio", "Audio", "Record and play audio"],
                    ["notifications", "Notifications", "Push alerts for this device"],
                  ] as [keyof Device["settings"], string, string][]
                ).map(([key, label, hint]) => (
                  <li key={key} className="card-inset flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-text">{label}</span>
                      <span className="block text-[12px] text-text-3">{hint}</span>
                    </span>
                    <Toggle size="sm" checked={detail.settings[key]} onChange={(v) => void setSetting(detail, key, v)} label={label} />
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-text">Recent events</h3>
              {detailEvents.loading ? (
                <Skeleton className="h-24" />
              ) : detailEvents.data?.items.length ? (
                <div className="space-y-1 rounded-xl border border-border bg-bg/40 p-1.5">
                  {detailEvents.data.items.map((e) => (
                    <EventLine key={e.id} event={e} onClick={() => router.push(`/events/${e.id}`)} showDay />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-text-3">No events recorded for this device in the last 30 days.</p>
              )}
            </section>
            <p className="flex items-center gap-1.5 text-[12px] text-text-3">
              <MapPin className="size-3.5" /> {detail.location} · Last event {detail.lastEventAt ? relativeDayTime(detail.lastEventAt) : "—"}
            </p>
            <div className={cn("flex justify-end")}>
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="size-4" />} onClick={() => void remove(detail)}>
                Remove device
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

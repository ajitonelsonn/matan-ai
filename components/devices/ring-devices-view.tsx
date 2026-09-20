"use client";

import * as React from "react";
import { Plus, RefreshCw, LayoutGrid, List, BellRing, Camera, Speaker, WifiOff, Radio, Activity, Pencil, Trash2, Star, StarOff, Clock, MapPin, ExternalLink, BookOpen, CircleHelp, ListOrdered, FlaskConical, ChevronRight, Video } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { Menu } from "@/components/ui/Menu";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Field, Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatusDot } from "@/components/ui/StatusDot";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { RingBadge } from "@/components/matan/Brand";
import { useApi } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { ringApi, ringErrorFrom } from "@/lib/api/ring";
import { RING_DOCS_URL, RING_PLAYGROUND_URL } from "@/lib/ring/constants";
import type { ConnectedRingDevice, RingDeviceKind, RingHistoryEvent, RingSessionInfo } from "@/lib/ring/types";
import { timeAgo, formatDate, formatTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { AddRingDeviceModal } from "./add-ring-device-modal";
import { RingConnectionStatus } from "./ring-connection-status";
import { RingConnectedDeviceCard } from "./ring-connected-device-card";
import { ringKindIcon, ringKindLabel } from "./ring-device-card";
import { useRingCountdown } from "./use-ring-session";
import { SourceBadge } from "@/components/experience/source-badge";
import { RingAccountCard, RingCapabilityMatrix, RingConfigurationSummary, RingFutureFeaturesCard, RingRegion } from "./ring-intelligence";

type Tab = "all" | RingDeviceKind | "offline";
type SortKey = "name" | "status" | "type" | "recent";

const sortOptions = [
  { value: "name" as SortKey, label: "Name (A-Z)" },
  { value: "status" as SortKey, label: "Status" },
  { value: "type" as SortKey, label: "Type" },
  { value: "recent" as SortKey, label: "Recently added" },
];

export interface RingDevicesViewProps {
  initialDeviceId?: string;
  sourceSwitch?: React.ReactNode;
  onBrowseDemo: () => void;
  /** Lifted so the container can decide the default source. */
  onConnectedChange?: (count: number) => void;
}

export function RingDevicesView({ initialDeviceId, sourceSwitch, onBrowseDemo, onConnectedChange }: RingDevicesViewProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi(() => ringApi.devices(), []);
  const connected = q.data?.connected ?? [];
  const session = q.data?.session ?? null;
  const cd = useRingCountdown(session);
  const live = cd.status === "valid" || cd.status === "expiring";

  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 200);
  const [sort, setSort] = React.useState<SortKey>("name");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(initialDeviceId ?? null);
  const [editing, setEditing] = React.useState<ConnectedRingDevice | null>(null);
  const [editForm, setEditForm] = React.useState({ displayName: "", locationLabel: "", aiEnabled: true, favorite: false });
  const [eventsOpenFor, setEventsOpenFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    onConnectedChange?.(connected.length);
  }, [connected.length, onConnectedChange]);

  const detail = connected.find((d) => d.id === detailId) ?? null;
  React.useEffect(() => {
    window.history.replaceState(null, "", detailId ? `/devices/${detailId}` : "/devices");
  }, [detailId]);

  const setData = (patch: Partial<{ connected: ConnectedRingDevice[]; session: RingSessionInfo | null }>) => q.setData((d) => ({ connected: patch.connected ?? d?.connected ?? [], session: patch.session === undefined ? d?.session ?? null : patch.session }));

  const filtered = connected
    .filter((d) => (tab === "all" ? true : tab === "offline" ? d.status !== "online" : d.deviceType === tab))
    .filter((d) => !debounced || `${d.displayName} ${d.ringName} ${d.model ?? ""} ${d.locationLabel ?? ""}`.toLowerCase().includes(debounced.toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if (sort === "status") return a.status.localeCompare(b.status) || a.displayName.localeCompare(b.displayName);
      if (sort === "type") return a.deviceType.localeCompare(b.deviceType) || a.displayName.localeCompare(b.displayName);
      return new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime();
    });

  const refresh = async () => {
    if (!live) {
      setAddOpen(true);
      return;
    }
    setRefreshing(true);
    try {
      const res = await ringApi.refresh();
      setData({ connected: res.connected, session: res.session });
      toast.success("Ring devices refreshed", `${res.devices.length} ${res.devices.length === 1 ? "device" : "devices"} reported by Ring.`);
    } catch (e) {
      const err = ringErrorFrom(e);
      toast.error(err?.title ?? "Couldn't refresh", err?.message);
      void q.refetch({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({ title: "Disconnect the Ring Playground session?", description: "Matan AI forgets the temporary token. Your connected devices stay listed; live status pauses until you reconnect.", confirmLabel: "Disconnect", tone: "default" });
    if (!ok) return;
    try {
      await ringApi.disconnect();
      setData({ session: null });
      toast.success("Ring session disconnected");
    } catch {
      toast.error();
    }
  };

  const remove = async (d: ConnectedRingDevice) => {
    const ok = await confirm({ title: `Remove ${d.displayName}?`, description: "This removes the device from Matan AI. It does not remove the Ring device from your Ring account.", confirmLabel: "Remove Device" });
    if (!ok) return;
    try {
      const res = await ringApi.remove(d.id);
      setData({ connected: res.connected });
      if (detailId === d.id) setDetailId(null);
      toast.success("Device removed from Matan AI", d.displayName);
    } catch {
      toast.error();
    }
  };

  const openEdit = (d: ConnectedRingDevice) => {
    setEditing(d);
    setEditForm({ displayName: d.displayName, locationLabel: d.locationLabel ?? "", aiEnabled: d.aiEnabled, favorite: d.favorite });
  };
  const saveEdit = async () => {
    if (!editing) return;
    try {
      const updated = await ringApi.update(editing.id, editForm);
      setData({ connected: connected.map((x) => (x.id === updated.id ? updated : x)) });
      setEditing(null);
      toast.success("Device updated", updated.displayName);
    } catch {
      toast.error();
    }
  };
  const toggleFavorite = async (d: ConnectedRingDevice) => {
    try {
      const updated = await ringApi.update(d.id, { favorite: !d.favorite });
      setData({ connected: connected.map((x) => (x.id === updated.id ? updated : x)) });
      toast.success(updated.favorite ? "Added to favorites" : "Removed from favorites", updated.displayName);
    } catch {
      toast.error();
    }
  };
  const refreshStatus = async (d: ConnectedRingDevice) => {
    if (!live) return toast.warning("Reconnect Ring first", "The Playground session has expired.");
    try {
      const res = await ringApi.status(d.id);
      setData({ connected: connected.map((x) => (x.id === res.device.id ? res.device : x)) });
      toast.success("Status refreshed", `${d.displayName} is ${res.status.online === null ? "unknown" : res.status.online ? "online" : "offline"}`);
    } catch (e) {
      const err = ringErrorFrom(e);
      toast.error(err?.title ?? "Couldn't refresh status", err?.message);
      void q.refetch({ silent: true });
    }
  };

  const menuFor = (d: ConnectedRingDevice) => (
    <Menu
      label={`${d.displayName} options`}
      items={[
        { label: "Device details", icon: <Activity />, onSelect: () => setDetailId(d.id) },
        { label: "Edit name & location", icon: <Pencil />, onSelect: () => openEdit(d) },
        { label: d.favorite ? "Remove favorite" : "Mark favorite", icon: d.favorite ? <StarOff /> : <Star />, onSelect: () => void toggleFavorite(d) },
        { label: "Refresh status", icon: <RefreshCw />, onSelect: () => void refreshStatus(d), disabled: !live, description: live ? undefined : "Reconnect Ring first" },
        "separator",
        { label: "Remove from Matan AI", icon: <Trash2 />, tone: "danger", onSelect: () => void remove(d) },
      ]}
    />
  );

  const counts = {
    total: connected.length,
    online: connected.filter((d) => d.status === "online").length,
    offline: connected.filter((d) => d.status === "offline").length,
    unknown: connected.filter((d) => d.status === "unknown").length,
    byKind: { doorbell: 0, camera: 0, chime: 0, device: 0 } as Record<RingDeviceKind, number>,
  };
  connected.forEach((d) => (counts.byKind[d.deviceType] += 1));

  const tabs = [
    { value: "all" as Tab, label: "All Devices", icon: <LayoutGrid />, count: counts.total },
    { value: "doorbell" as Tab, label: "Doorbells", icon: <BellRing />, count: counts.byKind.doorbell },
    { value: "camera" as Tab, label: "Cameras", icon: <Camera />, count: counts.byKind.camera },
    { value: "chime" as Tab, label: "Chimes", icon: <Speaker />, count: counts.byKind.chime },
    { value: "offline" as Tab, label: "Offline", icon: <WifiOff />, count: counts.offline + counts.unknown },
  ];

  return (
    <>
      <Topbar
        title={<span className="flex flex-wrap items-center gap-3">Ring Devices <SourceBadge source={live ? "ring" : session ? "ring-expired" : "ring"} short /></span>}
        subtitle={
          connected.length ? (
            <>
              Devices discovered from the Ring Developer Playground · {counts.online} Online · {counts.offline + counts.unknown} {live ? "Offline" : "Connection expired"}
            </>
          ) : (
            "Connect your Ring devices. Matan AI uses Ring events and media to understand what is happening around your home or business."
          )
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search Ring devices…" }}
        actions={
          <>
            {connected.length > 0 && (
              <Button variant="secondary" leftIcon={<RefreshCw className={cn("size-4", refreshing && "animate-spin")} />} onClick={() => void refresh()} disabled={refreshing}>
                Refresh
              </Button>
            )}
            <Button leftIcon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
              Add Ring Device
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {sourceSwitch}
          {connected.length > 0 && <Tabs items={tabs} value={tab} onChange={setTab} aria-label="Device types" />}
        </div>
        {connected.length > 0 && (
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
        )}
      </div>

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-9">
            {q.loading ? (
              <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3 min-h-[420px]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[380px] rounded-card" />
                ))}
                <LoadingOverlay label="Loading Ring devices" />
              </div>
            ) : connected.length === 0 ? (
              <div className="card-hero relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
                <EmptyState
                  icon={<Radio />}
                  title="Connect your Ring devices"
                  description="Matan AI uses Ring events and media to understand what is happening around your home or business. Use a temporary Ring Developer Playground token to discover the devices available to Matan AI."
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button size="lg" leftIcon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
                        Add Ring Device
                      </Button>
                      <Button size="lg" variant="ghost" leftIcon={<FlaskConical className="size-4" />} onClick={onBrowseDemo}>
                        Browse demo devices
                      </Button>
                    </div>
                  }
                  className="relative py-16"
                />
                <p className="relative -mt-8 pb-6 text-center text-[12px] text-text-3">No fake Ring devices are shown here. Demo devices are a separate, clearly labelled mode.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card">
                <EmptyState icon={<WifiOff />} title={tab === "offline" ? "All Ring devices are online" : "No devices match"} description={tab === "offline" ? "Nothing needs your attention." : "Try another filter or search."} compact />
              </div>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((d, i) => (
                  <div key={d.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <RingConnectedDeviceCard device={d} liveEnabled={live} onOpen={() => setDetailId(d.id)} onEvents={() => setEventsOpenFor(d.id)} menu={menuFor(d)} />
                  </div>
                ))}
                <button type="button" onClick={() => setAddOpen(true)} className="flex min-h-[320px] flex-col items-center justify-center rounded-card border-2 border-dashed border-primary/30 bg-primary/[0.04] p-6 text-center transition-[border-color,background-color] hover:border-primary/60 hover:bg-primary/[0.08]">
                  <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Plus className="size-7" />
                  </span>
                  <span className="mt-4 text-[17px] font-semibold text-text">Add more Ring devices</span>
                  <span className="mt-1 max-w-[240px] text-[13px] text-text-3">Discover devices available to your Playground session.</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((d) => (
                  <RingConnectedDeviceCard key={d.id} device={d} view="list" liveEnabled={live} onOpen={() => setDetailId(d.id)} onEvents={() => setEventsOpenFor(d.id)} menu={menuFor(d)} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 xl:col-span-3">
            {q.loading ? (
              <Skeleton className="h-52 rounded-card" />
            ) : (
              <RingConnectionStatus session={session} connectedCount={connected.length} onReconnect={() => setAddOpen(true)} onAddDevices={() => setAddOpen(true)} onRefresh={refresh} onDisconnect={() => void disconnect()} refreshing={refreshing} />
            )}

            {connected.length > 0 && (
              <>
                <section className="card p-5" aria-labelledby="ring-sum">
                  <SectionHeader icon={<Activity />} title={<span id="ring-sum">Device Summary</span>} />
                  <div className="grid grid-cols-3 divide-x divide-border">
                    <div className="pr-3">
                      <div className="text-[26px] font-bold leading-none text-text tabular-nums">{counts.total}</div>
                      <div className="mt-1 text-[12px] text-text-3">Connected</div>
                    </div>
                    <div className="px-3">
                      <div className="flex items-center gap-1.5 text-[26px] font-bold leading-none text-text tabular-nums">
                        <StatusDot tone="success" /> {counts.online}
                      </div>
                      <div className="mt-1 text-[12px] text-text-3">Online</div>
                    </div>
                    <div className="pl-3">
                      <div className="flex items-center gap-1.5 text-[26px] font-bold leading-none text-text tabular-nums">
                        <StatusDot tone="danger" /> {counts.offline + counts.unknown}
                      </div>
                      <div className="mt-1 text-[12px] text-text-3">{counts.unknown ? "Offline/unknown" : "Offline"}</div>
                    </div>
                  </div>
                </section>
                <section className="card p-5" aria-labelledby="ring-types">
                  <h2 id="ring-types" className="mb-3 text-[16px] font-semibold text-text">
                    Device Types
                  </h2>
                  <ul className="space-y-2.5">
                    {(["doorbell", "camera", "chime", "device"] as RingDeviceKind[]).map((k) => {
                      const Icon = ringKindIcon[k];
                      return (
                        <li key={k}>
                          <button type="button" onClick={() => setTab(k)} className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-surface-2/70">
                            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-2">
                              <Icon className="size-4" />
                            </span>
                            <span className="flex-1 text-[14px] text-text-2">{ringKindLabel[k]}s</span>
                            <span className="text-[15px] font-semibold tabular-nums text-text">{counts.byKind[k]}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </>
            )}

            <RingAccountCard account={session?.account} />
            <RingFutureFeaturesCard devices={connected} />

            <section className="card p-5" aria-labelledby="ring-help">
              <SectionHeader icon={<CircleHelp />} title={<span id="ring-help">Need Help?</span>} />
              <ul className="space-y-1">
                {[
                  { label: "Open Ring Developer Playground", href: RING_PLAYGROUND_URL, icon: <ExternalLink /> },
                  { label: "Ring Partner API documentation", href: RING_DOCS_URL, icon: <BookOpen /> },
                ].map((h) => (
                  <li key={h.href}>
                    <a href={h.href} target="_blank" rel="noreferrer" className="flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left text-[14px] text-text-2 transition-colors hover:bg-surface-2/70 hover:text-text">
                      <span className="text-primary [&>svg]:size-4">{h.icon}</span>
                      <span className="flex-1">{h.label}</span>
                      <ChevronRight className="size-4 text-text-3" aria-hidden />
                    </a>
                  </li>
                ))}
                <li className="px-1.5 pt-2 text-[12px] leading-relaxed text-text-3">Playground tokens last 30 minutes and are used only through the Matan AI backend. Generate a new one to reconnect.</li>
              </ul>
            </section>
          </div>
        </div>
      )}

      <AddRingDeviceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingSession={session}
        alreadyConnectedIds={connected.map((d) => d.ringDeviceId)}
        onConnected={(c, s) => setData({ connected: c, session: s })}
      />

      {/* Edit */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit device" description="Local Matan AI metadata. The Ring device name stays unchanged." icon={<Pencil />} size="sm" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void saveEdit()} disabled={!editForm.displayName.trim()}>Save</Button></>}>
        {editing && (
          <div className="space-y-4">
            <p className="text-[12.5px] text-text-3">
              Ring name: <span className="text-text-2">{editing.ringName}</span>
            </p>
            <Field label="Matan AI name" htmlFor="edit-dn"><Input id="edit-dn" value={editForm.displayName} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} maxLength={60} data-autofocus /></Field>
            <Field label="Location" htmlFor="edit-loc"><Input id="edit-loc" value={editForm.locationLabel} onChange={(e) => setEditForm((f) => ({ ...f, locationLabel: e.target.value }))} placeholder="e.g. Front Entrance" maxLength={60} /></Field>
            <div className="flex flex-wrap items-center gap-5 text-[13.5px] text-text-2">
              <label className="flex items-center gap-2"><Toggle size="sm" checked={editForm.aiEnabled} onChange={(v) => setEditForm((f) => ({ ...f, aiEnabled: v }))} label="Enable Matan AI analysis" /> Matan AI analysis</label>
              <label className="flex items-center gap-2"><Toggle size="sm" checked={editForm.favorite} onChange={(v) => setEditForm((f) => ({ ...f, favorite: v }))} label="Favorite" /> Favorite</label>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail drawer */}
      <Drawer open={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.displayName} description={detail ? `${detail.model ? `Ring ${detail.model}` : ringKindLabel[detail.deviceType]}${detail.locationLabel ? ` · ${detail.locationLabel}` : ""}` : undefined} width="max-w-lg">
        {detail && <RingDeviceDetail device={detail} live={live} onEdit={() => openEdit(detail)} onRemove={() => void remove(detail)} onRefreshStatus={() => void refreshStatus(detail)} onEvents={() => setEventsOpenFor(detail.id)} />}
      </Drawer>

      {/* Events drawer */}
      <Drawer open={Boolean(eventsOpenFor)} onClose={() => setEventsOpenFor(null)} title="Ring event history" description={connected.find((d) => d.id === eventsOpenFor)?.displayName} width="max-w-md">
        {eventsOpenFor && <RingEventsList deviceId={eventsOpenFor} live={live} onReconnect={() => { setEventsOpenFor(null); setAddOpen(true); }} />}
      </Drawer>
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card-inset p-3">
      <dt className="text-[11.5px] uppercase tracking-wide text-text-3">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] font-semibold text-text">{value ?? <span className="font-normal text-text-3">Not available</span>}</dd>
    </div>
  );
}

function RingDeviceDetail({ device, live, onEdit, onRemove, onRefreshStatus, onEvents }: { device: ConnectedRingDevice; live: boolean; onEdit: () => void; onRemove: () => void; onRefreshStatus: () => void; onEvents: () => void }) {
  const Icon = ringKindIcon[device.deviceType];
  return (
    <div className="space-y-5">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface-2">
        <SafeImage src={device.imageUrl} alt="" sizes="480px" fallbackIcon={<Icon className="size-8" />} fallbackLabel="Preview unavailable" className="[&_img]:object-contain [&_img]:p-8" grayscale={device.status !== "online"} />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge tone={device.status === "online" ? "success" : device.status === "offline" ? "danger" : "neutral"} dot>{device.status === "online" ? "Online" : device.status === "offline" ? "Offline" : "Unknown"}</Badge>
          <RingBadge size="xs" />
          {device.favorite && <Badge tone="warning" size="xs" icon={<Star className="size-3" />}>Favorite</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2.5">
        <Fact label="Ring name" value={device.ringName} />
        <Fact label="Type" value={ringKindLabel[device.deviceType]} />
        <Fact label="Model" value={device.model ? `Ring ${device.model}` : undefined} />
        <Fact label="Region (coarse)" value={[device.region?.country, device.region?.state].filter(Boolean).join(" / ") || undefined} />
        <Fact label="Status reported" value={device.statusReportedAt ? `${formatDate(device.statusReportedAt)} ${formatTime(device.statusReportedAt)}` : undefined} />
        <Fact label="Connected" value={`${formatDate(device.connectedAt)} · ${timeAgo(device.connectedAt, new Date().toISOString())}`} />
      </dl>
      <section aria-labelledby="dev-caps">
        <h3 id="dev-caps" className="mb-1.5 text-[11.5px] uppercase tracking-wide text-text-3">Capabilities (Ring)</h3>
        <RingCapabilityMatrix device={device} />
      </section>
      <section aria-labelledby="dev-conf">
        <h3 id="dev-conf" className="mb-1.5 text-[11.5px] uppercase tracking-wide text-text-3">Configuration (read-only)</h3>
        <RingConfigurationSummary device={device} />
      </section>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-2">
        <MapPin className="size-4 text-text-3" /> {device.locationLabel ?? "Location not set"}
        <span className="text-text-3">·</span>
        <RingRegion device={device} />
        <span className="text-text-3">·</span>
        <span>{device.aiEnabled ? "Matan AI analysis on" : "Matan AI analysis off"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" leftIcon={<Video className="size-4" />} href={`/live?camera=ring:${device.id}`} disabled={!live || device.details.video === false}>
          Live view
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="size-4" />} onClick={onRefreshStatus} disabled={!live}>
          Refresh status
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<ListOrdered className="size-4" />} onClick={onEvents}>
          Event history
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<Pencil className="size-4" />} onClick={onEdit}>
          Edit
        </Button>
      </div>
      {!live && <p className="text-[12.5px] text-text-3">Live status is paused - reconnect the Ring Playground session to refresh.</p>}
      <p className="text-[12px] text-text-3">Source: Ring Developer Playground · synced {timeAgo(device.lastSyncedAt, new Date().toISOString())}</p>
      <div className="flex justify-end border-t border-border pt-4">
        <Button variant="danger" size="sm" leftIcon={<Trash2 className="size-4" />} onClick={onRemove}>
          Remove from Matan AI
        </Button>
      </div>
    </div>
  );
}

function RingEventsList({ deviceId, live, onReconnect }: { deviceId: string; live: boolean; onReconnect: () => void }) {
  const q = useApi<{ events: RingHistoryEvent[] } | null>(() => (live ? ringApi.events(deviceId) : Promise.resolve(null)), [deviceId, live]);
  if (!live) return <EmptyState compact icon={<Clock />} title="Session expired" description="Reconnect Ring to load event history." action={<Button onClick={onReconnect}>Reconnect Ring</Button>} />;
  if (q.loading) return <div className="relative min-h-[200px]"><LoadingOverlay size="sm" label="Loading Ring events" /></div>;
  if (q.error) return <ErrorState compact message={q.error} onRetry={() => void q.refetch()} />;
  const events = q.data?.events ?? [];
  if (!events.length) return <EmptyState compact icon={<ListOrdered />} title="No events yet" description="Ring returned no history for this device. Trigger an event in the Playground and refresh." action={<Button variant="secondary" size="sm" onClick={() => void q.refetch()}>Refresh</Button>} />;
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="card-inset p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold capitalize text-text">{e.kind.replace(/[_-]/g, " ")}</span>
            {e.createdAt && <span className="text-[12px] text-text-3">{formatDate(e.createdAt)} {formatTime(e.createdAt)}</span>}
          </div>
          <details className="mt-1">
            <summary className="cursor-pointer text-[12px] text-primary">Raw attributes</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-bg/60 p-2 text-[11px] text-text-2">{JSON.stringify(e.attributes, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}


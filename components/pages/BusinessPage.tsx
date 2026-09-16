"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { LayoutDashboard, MapPin, BarChart3, Users, FileText, Plug, Settings, ShieldCheck, Video, TriangleAlert, TrendingUp, Zap, Plus, ChevronRight, KeyRound, Sparkles, Download, Trash2, Clock, Building2, Store, Power, UserPlus, Mail } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Field, Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatusDot } from "@/components/ui/StatusDot";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { MetricCard } from "@/components/matan/MetricCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { AIInsightCard } from "@/components/matan/AIInsightCard";
import { QuickAction } from "@/components/matan/QuickAction";
import { EventLine } from "@/components/matan/EventCard";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { HBarList } from "@/components/charts/HBarList";
import { useApi } from "@/hooks/useApi";
import { businessApi } from "@/lib/api/business";
import { images } from "@/lib/mock/images";
import { formatDate, relativeDayTime, timeAgo } from "@/lib/utils/format";
import { chartColors } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";
import type { BusinessLocation, TeamMember } from "@/lib/types";

const BusinessTrendChart = dynamic(() => import("@/components/charts/LineTrendChart").then((m) => m.BusinessTrendChart), { ssr: false, loading: () => <Skeleton className="h-[260px]" /> });
const DonutChart = dynamic(() => import("@/components/charts/DonutChart").then((m) => m.DonutChart), { ssr: false, loading: () => <Skeleton className="size-40 rounded-full" /> });

type Tab = "overview" | "locations" | "analytics" | "team" | "reports" | "integrations" | "settings";
const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "overview", label: "Overview", icon: <LayoutDashboard /> },
  { value: "locations", label: "Locations", icon: <MapPin /> },
  { value: "analytics", label: "Analytics", icon: <BarChart3 /> },
  { value: "team", label: "Team Access", icon: <Users /> },
  { value: "reports", label: "Reports", icon: <FileText /> },
  { value: "integrations", label: "Integrations", icon: <Plug /> },
  { value: "settings", label: "Settings", icon: <Settings /> },
];

const roleOptions = (["Owner", "Manager", "Staff", "Viewer"] as TeamMember["role"][]).map((r) => ({ value: r, label: r }));

export function BusinessPage({ initialLocationSlug }: { initialLocationSlug?: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const q = useApi(() => businessApi.get(), []);
  const [tab, setTab] = React.useState<Tab>(initialLocationSlug ? "locations" : "overview");
  const [search, setSearch] = React.useState("");
  const [trendRange, setTrendRange] = React.useState<"7d" | "30d">("7d");
  const [locationId, setLocationId] = React.useState<string | null>(null);
  const [addLoc, setAddLoc] = React.useState(false);
  const [locForm, setLocForm] = React.useState({ name: "", city: "Dili, Timor-Leste" });
  const [addMember, setAddMember] = React.useState(false);
  const [memberForm, setMemberForm] = React.useState({ name: "", role: "Staff" as TeamMember["role"] });
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState({ name: "Nelson Holdings", tz: "(GMT+9) Dili, Timor-Leste", digest: "Daily at 6:00 PM", afterHours: true, footTraffic: true, weeklyEmail: true });

  const d = q.data;
  React.useEffect(() => {
    if (initialLocationSlug && d) {
      const loc = d.locations.find((l) => l.slug === initialLocationSlug);
      if (loc) setLocationId(loc.id);
    }
  }, [initialLocationSlug, d]);

  React.useEffect(() => {
    const loc = d?.locations.find((l) => l.id === locationId);
    window.history.replaceState(null, "", loc ? `/business/${loc.slug}` : "/business");
  }, [locationId, d]);

  const location = d?.locations.find((l) => l.id === locationId) ?? null;
  const match = (s: string) => !search.trim() || s.toLowerCase().includes(search.trim().toLowerCase());

  const generateReport = async () => {
    setGenerating(true);
    try {
      const r = await businessApi.generateReport("Business Activity Report", "Sep 4 - Sep 11, 2026");
      await q.refetch({ silent: true });
      toast.success("Report generated", `${r.name} · ${r.size}`);
      setTab("reports");
    } catch {
      toast.error();
    } finally {
      setGenerating(false);
    }
  };

  const toggleIntegration = async (id: string, connected: boolean) => {
    const name = d?.integrations.find((i) => i.id === id)?.name;
    if (!connected) {
      const ok = await confirm({ title: `Disconnect ${name}?`, description: "Alerts and exports through this integration will stop.", confirmLabel: "Disconnect" });
      if (!ok) return;
    }
    try {
      q.setData(await businessApi.setIntegration(id, connected));
      toast.success(connected ? `${name} connected` : `${name} disconnected`);
    } catch {
      toast.error();
    }
  };

  const setRole = async (m: TeamMember, role: TeamMember["role"]) => {
    try {
      q.setData(await businessApi.setRole(m.id, role));
      toast.success("Role updated", `${m.name} is now ${role}`);
    } catch {
      toast.error();
    }
  };

  const removeMember = async (m: TeamMember) => {
    const ok = await confirm({ title: `Remove ${m.name} from the team?`, description: "They will lose access to all business locations.", confirmLabel: "Remove" });
    if (!ok) return;
    try {
      q.setData(await businessApi.removeMember(m.id));
      toast.success("Team member removed", m.name);
    } catch {
      toast.error();
    }
  };

  const removeReport = async (id: string, name: string) => {
    const ok = await confirm({ title: `Delete “${name}”?`, confirmLabel: "Delete report" });
    if (!ok) return;
    try {
      q.setData(await businessApi.removeReport(id));
      toast.success("Report deleted");
    } catch {
      toast.error();
    }
  };

  const addLocation = async () => {
    if (!locForm.name.trim()) return toast.warning("Enter a location name");
    try {
      await businessApi.addLocation(locForm.name.trim(), locForm.city);
      await q.refetch({ silent: true });
      setAddLoc(false);
      setLocForm({ name: "", city: "Dili, Timor-Leste" });
      toast.success("Location added", "Link Ring cameras to bring it online.");
    } catch {
      toast.error();
    }
  };

  const inviteMember = async () => {
    if (!memberForm.name.trim()) return toast.warning("Enter a name");
    try {
      await businessApi.addMember(memberForm.name.trim(), memberForm.role);
      await q.refetch({ silent: true });
      setAddMember(false);
      setMemberForm({ name: "", role: "Staff" });
      toast.success("Invitation sent", `${memberForm.name.trim()} · ${memberForm.role}`);
    } catch {
      toast.error();
    }
  };

  const setLocationStatus = async (l: BusinessLocation, status: "online" | "offline") => {
    try {
      q.setData(await businessApi.setLocationStatus(l.id, status));
      toast.success(status === "online" ? "Location online" : "Location set offline (demo)", l.name);
    } catch {
      toast.error();
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success("Business settings saved");
  };

  const trend = d ? (trendRange === "7d" ? d.trend : [...d.trend.map((t, i) => ({ ...t, day: `Aug ${28 + i}`, people: Math.round(t.people * 0.9), vehicles: Math.round(t.vehicles * 0.85), packages: Math.round(t.packages * 1.1) })), ...d.trend]) : [];

  const locationCard = (l: BusinessLocation) => (
    <button key={l.id} type="button" onClick={() => setLocationId(l.id)} className={cn("card hover-lift flex w-full flex-col overflow-hidden text-left transition-[border-color]", l.status === "offline" && "border-danger/30")}>
      <div className="relative aspect-[16/8]">
        <SafeImage src={l.imageUrl} alt="" sizes="360px" grayscale={l.status === "offline"} fallbackIcon={<Store className="size-6" />} />
        <div className="absolute left-3 top-3">
          <Badge tone={l.status === "online" ? "success" : "danger"} dot size="sm" className="bg-bg/60 backdrop-blur">
            {l.status === "online" ? "Online" : "Offline"}
          </Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-semibold text-text">{l.name}</h3>
            <p className="text-[13px] text-text-3">{l.city}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[13px] text-text-2">
            <Video className="size-3.5" /> {l.cameras}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-text-3">
          <div>
            <dt>Manager</dt>
            <dd className="truncate text-text-2">{l.manager}</dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd className="text-text-2">{l.openHours}</dd>
          </div>
          <div>
            <dt>Events today</dt>
            <dd className="text-text-2 tabular-nums">{l.eventsToday}</dd>
          </div>
        </dl>
      </div>
    </button>
  );

  return (
    <>
      <Topbar title="Business" subtitle="Smarter security for your business. Matan AI helps you protect, manage, and grow your business." search={{ value: search, onChange: setSearch, placeholder: "Search business, locations…" }} />

      <Tabs items={tabs} value={tab} onChange={setTab} aria-label="Business sections" className="mb-5" />

      {q.error ? (
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : q.loading || !d ? (
        <div className="relative grid gap-5 lg:grid-cols-4 min-h-[520px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] rounded-card" />
          ))}
          <Skeleton className="h-[300px] rounded-card lg:col-span-2" />
          <Skeleton className="h-[300px] rounded-card lg:col-span-2" />
          <LoadingOverlay label="Loading business data" />
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="space-y-5 xl:col-span-9">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard icon={<ShieldCheck />} label="Business Locations" value={d.metrics.locations} delta={25} deltaLabel="vs last month" tone="success" />
                  <MetricCard icon={<Video />} label="Total Cameras" value={d.metrics.cameras} delta={14} deltaLabel="vs last month" tone="primary" />
                  <MetricCard icon={<Users />} label="Team Members" value={d.metrics.team} delta={20} deltaLabel="vs last month" tone="purple" />
                  <MetricCard icon={<TriangleAlert />} label="Security Events" value={d.metrics.securityEvents} delta={-40} invertDelta deltaLabel="vs last month" tone="danger" />
                </div>
                <div className="grid gap-5 lg:grid-cols-12">
                  <section className="card p-5 lg:col-span-7" aria-labelledby="act-title">
                    <SectionHeader icon={<TrendingUp />} title={<span id="act-title">Activity Overview</span>} subtitle="Key activity across all your business locations." action={<Select size="sm" value={trendRange} onChange={setTrendRange} options={[{ value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 14 days" }]} align="end" label="Trend range" />} />
                    <BusinessTrendChart data={trend} />
                  </section>
                  <section className="card p-5 lg:col-span-5" aria-labelledby="loc-title">
                    <SectionHeader icon={<MapPin />} title={<span id="loc-title">Location Status</span>} subtitle="All your business locations at a glance." action={<Button variant="ghost" size="xs" onClick={() => setTab("locations")} rightIcon={<ChevronRight className="size-3.5" />}>View all</Button>} />
                    <ul className="divide-y divide-border">
                      {d.locations.filter((l) => match(l.name) || match(l.city)).map((l) => (
                        <li key={l.id}>
                          <button type="button" onClick={() => setLocationId(l.id)} className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-surface-2/50 rounded-lg px-1">
                            <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border">
                              <SafeImage src={l.imageUrl} alt="" sizes="48px" grayscale={l.status === "offline"} fallbackIcon={<Store className="size-4" />} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold text-text">{l.name}</span>
                              <span className="block truncate text-[12px] text-text-3">{l.city}</span>
                            </span>
                            <span className="text-right">
                              <StatusDot tone={l.status === "online" ? "success" : "danger"} label={l.status === "online" ? "Online" : "Offline"} />
                              <span className="block text-[11.5px] text-text-3">{l.cameras} cameras</span>
                            </span>
                            <ChevronRight className="size-4 text-text-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="card p-5" aria-labelledby="rev-title">
                    <SectionHeader icon={<Clock />} title={<span id="rev-title">Recent Events</span>} subtitle="Latest activity from your business locations." href="/events" />
                    <div className="space-y-0.5">
                      {d.events.slice(0, 5).map((e) => {
                        const loc = d.locations.find((l) => l.id === e.locationId);
                        return <EventLine key={e.id} event={{ ...e, location: loc?.city ?? "" }} onClick={() => loc && setLocationId(loc.id)} showDay />;
                      })}
                    </div>
                  </section>
                  <section className="card p-5" aria-labelledby="team-title">
                    <SectionHeader icon={<Users />} title={<span id="team-title">Team Access</span>} subtitle="Manage who can access your business locations." action={<Button variant="ghost" size="xs" onClick={() => setTab("team")} rightIcon={<ChevronRight className="size-3.5" />}>View all</Button>} />
                    <div className="flex flex-wrap items-start gap-4">
                      {d.team.slice(0, 4).map((m) => (
                        <button key={m.id} type="button" onClick={() => setTab("team")} className="flex w-16 flex-col items-center gap-1.5 text-center">
                          <Avatar name={m.name} src={m.avatarUrl} size="lg" />
                          <span className="text-[12.5px] font-medium text-text truncate w-full">{m.name.split(" ")[0]}</span>
                          <span className="text-[11px] text-text-3">{m.role}</span>
                        </button>
                      ))}
                      <button type="button" onClick={() => setAddMember(true)} className="flex w-16 flex-col items-center gap-1.5 text-center">
                        <span className="inline-flex size-14 items-center justify-center rounded-full border border-dashed border-primary/40 text-primary">
                          <Plus className="size-5" />
                        </span>
                        <span className="text-[12.5px] font-medium text-text">Add</span>
                      </button>
                    </div>
                    <button type="button" onClick={() => setTab("team")} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border bg-bg/40 p-3 text-left transition-colors hover:border-border-strong">
                      <KeyRound className="size-5 text-primary" aria-hidden />
                      <span className="flex-1">
                        <span className="block text-[14px] font-semibold text-text">Role-based access control</span>
                        <span className="block text-[12.5px] text-text-3">Keep your business secure with the right permissions.</span>
                      </span>
                      <ChevronRight className="size-4 text-text-3" aria-hidden />
                    </button>
                  </section>
                </div>
              </div>

              <div className="space-y-5 xl:col-span-3">
                <div className="relative overflow-hidden rounded-hero border border-border min-h-[168px]">
                  <SafeImage src={images.storefront} alt="" sizes="360px" />
                  <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/80 to-bg/30" aria-hidden />
                  <div className="relative p-5">
                    <p className="text-[19px] font-semibold leading-snug text-text">Secure your business.<br />Focus on what matters.</p>
                    <p className="mt-2 text-[13px] text-text-2">Matan AI keeps your business safe so you can grow with confidence.</p>
                  </div>
                </div>
                <section className="card p-5" aria-labelledby="bqa">
                  <SectionHeader icon={<Zap />} title={<span id="bqa">Quick Actions</span>} iconTone="warning" />
                  <div className="grid grid-cols-2 gap-2">
                    <QuickAction icon={<Video />} label="View Live Cameras" href="/live" />
                    <QuickAction icon={<FileText />} label="Generate Report" onClick={() => void generateReport()} loading={generating} />
                    <QuickAction icon={<Plus />} label="Add Location" onClick={() => setAddLoc(true)} />
                    <QuickAction icon={<Users />} label="Manage Team" onClick={() => setTab("team")} />
                  </div>
                </section>
                <section className="card p-5" aria-labelledby="bins">
                  <SectionHeader icon={<Sparkles />} title={<span id="bins">AI Business Insights</span>} iconTone="purple" action={<Button variant="ghost" size="xs" onClick={() => setTab("analytics")} rightIcon={<ChevronRight className="size-3.5" />}>View all</Button>} />
                  <ul className="space-y-2">
                    {d.insights.filter((i) => match(i.title)).map((i) => (
                      <li key={i.id}>
                        <AIInsightCard icon={i.icon} title={i.title} tone={i.tone} onClick={() => setTab("analytics")} />
                      </li>
                    ))}
                  </ul>
                </section>
                <div className="relative overflow-hidden rounded-hero border border-border min-h-[110px]">
                  <SafeImage src={images.retail} alt="" sizes="360px" />
                  <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/75 to-bg/30" aria-hidden />
                  <div className="relative p-5">
                    <p className="text-[17px] font-semibold leading-snug text-text">“A safer business,<br />a brighter Timor-Leste.”</p>
                    <p className="mt-1 text-[12.5px] font-semibold tracking-wide text-primary">MATAN AI</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOCATIONS */}
          {tab === "locations" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[13.5px] text-text-3">{d.locations.length} locations · {d.locations.filter((l) => l.status === "online").length} online</p>
                <Button leftIcon={<Plus className="size-4" />} onClick={() => setAddLoc(true)}>Add Location</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.locations.filter((l) => match(l.name) || match(l.city)).map(locationCard)}</div>
            </div>
          )}

          {/* ANALYTICS */}
          {tab === "analytics" && (
            <div className="grid gap-5 xl:grid-cols-12">
              <section className="card p-5 xl:col-span-8" aria-labelledby="an-trend">
                <SectionHeader icon={<TrendingUp />} title={<span id="an-trend">Activity Overview</span>} subtitle="People, vehicles, packages and security events across all locations." action={<Select size="sm" value={trendRange} onChange={setTrendRange} options={[{ value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 14 days" }]} align="end" label="Trend range" />} />
                <BusinessTrendChart data={trend} height={320} />
              </section>
              <section className="card p-5 xl:col-span-4" aria-labelledby="an-cams">
                <SectionHeader icon={<Video />} title={<span id="an-cams">Cameras by Location</span>} />
                <div className="flex flex-col items-center gap-4">
                  <DonutChart data={d.locations.map((l, i) => ({ name: l.name, value: l.cameras, color: [chartColors.people, chartColors.packages, chartColors.vehicles, chartColors.animals, chartColors.others][i % 5] }))} size={160} thickness={22} center={<><span className="text-[24px] font-bold text-text">{d.metrics.cameras}</span><span className="text-xs text-text-3">Cameras</span></>} />
                  <ul className="w-full space-y-1.5 text-[13px]">
                    {d.locations.map((l, i) => (
                      <li key={l.id} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-text-2"><span className="size-2.5 rounded-full" style={{ background: [chartColors.people, chartColors.packages, chartColors.vehicles, chartColors.animals, chartColors.others][i % 5] }} />{l.name}</span>
                        <span className="tabular-nums text-text">{l.cameras}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
              <section className="card p-5 xl:col-span-6" aria-labelledby="an-today">
                <SectionHeader icon={<BarChart3 />} title={<span id="an-today">Events Today by Location</span>} />
                <HBarList rows={d.locations.map((l) => ({ key: l.id, label: l.name, count: l.eventsToday, icon: "Store", tone: l.status === "online" ? "primary" : "danger" }))} />
              </section>
              <section className="card p-5 xl:col-span-6" aria-labelledby="an-ins">
                <SectionHeader icon={<Sparkles />} title={<span id="an-ins">AI Business Insights</span>} iconTone="purple" />
                <ul className="space-y-2">
                  {d.insights.map((i) => (
                    <li key={i.id}><AIInsightCard icon={i.icon} title={i.title} tone={i.tone} description={i.tone === "danger" ? "Review the clip and consider after-hours alerts." : i.tone === "success" ? "Compared to the previous 7 days." : undefined} /></li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {/* TEAM */}
          {tab === "team" && (
            <div className="card p-5">
              <SectionHeader icon={<Users />} title="Team Access" subtitle={`${d.team.length} members · role-based access to ${d.locations.length} locations`} action={<Button leftIcon={<UserPlus className="size-4" />} onClick={() => setAddMember(true)}>Add Member</Button>} />
              <DataTable
                rows={d.team.filter((m) => match(m.name) || match(m.role))}
                rowKey={(m) => m.id}
                columns={[
                  { key: "name", header: "Member", render: (m) => (<span className="flex items-center gap-3"><Avatar name={m.name} src={m.avatarUrl} size="sm" /><span><span className="block font-medium text-text">{m.name}</span>{m.status === "invited" && <Badge tone="warning" size="xs">Invited</Badge>}</span></span>) },
                  { key: "role", header: "Role", render: (m) => <Select size="sm" value={m.role} onChange={(r) => void setRole(m, r)} options={roleOptions} disabled={m.role === "Owner"} label={`Role for ${m.name}`} /> },
                  { key: "locations", header: "Locations", hideOnMobile: true, render: (m) => <span className="text-text-2">{m.locationIds.length === d.locations.length ? "All locations" : m.locationIds.map((id) => d.locations.find((l) => l.id === id)?.name).filter(Boolean).join(", ") || "—"}</span> },
                  { key: "active", header: "Last active", render: (m) => <span className="text-text-3">{timeAgo(m.lastActive)}</span> },
                  { key: "actions", header: "", align: "right", render: (m) => (m.role === "Owner" ? null : <Button variant="ghost" size="xs" onClick={() => void removeMember(m)} leftIcon={<Trash2 className="size-3.5" />}>Remove</Button>) },
                ]}
              />
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-bg/40 p-3 text-[13px] text-text-2">
                <KeyRound className="size-4 text-primary" /> Owners manage everything; Managers configure their locations; Staff view live and events; Viewers see summaries only.
              </div>
            </div>
          )}

          {/* REPORTS */}
          {tab === "reports" && (
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="card p-5 xl:col-span-8">
                <SectionHeader icon={<FileText />} title="Reports" subtitle="Generated summaries and incident reports." action={<Button leftIcon={<Sparkles className="size-4" />} onClick={() => void generateReport()} loading={generating}>Generate Report</Button>} />
                {d.reports.length === 0 ? (
                  <EmptyState compact icon={<FileText />} title="No reports yet" description="Generate your first business report." />
                ) : (
                  <ul className="space-y-2">
                    {d.reports.filter((r) => match(r.name)).map((r) => (
                      <li key={r.id} className="card-inset flex flex-wrap items-center gap-3 p-3.5">
                        <span className="inline-flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/12 text-primary"><FileText className="size-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold text-text">{r.name}</span>
                          <span className="block text-[12.5px] text-text-3">{r.period} · {r.size} · {relativeDayTime(r.createdAt)}</span>
                        </span>
                        <Badge tone={r.status === "ready" ? "success" : "warning"} size="xs">{r.status === "ready" ? "Ready" : "Generating"}</Badge>
                        <Button variant="secondary" size="sm" leftIcon={<Download className="size-4" />} onClick={() => toast.success("Download started", `${r.name}.pdf`)}>Download</Button>
                        <Button variant="ghost" size="sm" leftIcon={<Mail className="size-4" />} onClick={() => toast.success("Report emailed", "Sent to your team digest list")}>Email</Button>
                        <Button variant="ghost" size="sm" onClick={() => void removeReport(r.id, r.name)} aria-label={`Delete ${r.name}`}><Trash2 className="size-4 text-danger" /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-5 xl:col-span-4">
                <SectionHeader icon={<Clock />} title="Scheduled reports" />
                <ul className="space-y-3">
                  {[["Weekly Security Summary", "Every Monday · 6:00 AM", true], ["Foot Traffic Analysis", "Monthly · 1st", true], ["Delivery Log", "Daily · 8:00 PM", false]].map(([n, s, on]) => (
                    <li key={String(n)} className="flex items-center justify-between gap-3">
                      <span><span className="block text-[14px] font-medium text-text">{n}</span><span className="block text-[12px] text-text-3">{s}</span></span>
                      <Toggle size="sm" checked={Boolean(on)} onChange={(v) => toast.success(v ? "Schedule enabled" : "Schedule disabled", String(n))} label={String(n)} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* INTEGRATIONS */}
          {tab === "integrations" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {d.integrations.filter((i) => match(i.name)).map((i) => (
                <div key={i.id} className={cn("card flex flex-col p-5", i.connected && "border-success/30")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("inline-flex size-12 items-center justify-center rounded-2xl border", i.connected ? "bg-success/12 border-success/25 text-success" : "bg-surface-3/60 border-border text-text-2")}><Icon name={i.icon} className="size-6" /></span>
                    <Badge tone={i.connected ? "success" : "neutral"} dot size="sm">{i.connected ? "Connected" : "Not connected"}</Badge>
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold text-text">{i.name}</h3>
                  <p className="mt-1 flex-1 text-[13.5px] text-text-3">{i.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[13px] text-text-2">{i.connected ? "Active" : "Inactive"}</span>
                    <Toggle checked={i.connected} onChange={(v) => void toggleIntegration(i.id, v)} label={`Connect ${i.name}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SETTINGS */}
          {tab === "settings" && (
            <div className="grid gap-5 xl:grid-cols-12">
              <div className="card p-5 xl:col-span-7 space-y-4">
                <SectionHeader icon={<Building2 />} title="Business profile" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Business name" htmlFor="bn"><Input id="bn" value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} /></Field>
                  <Field label="Time zone"><Select fullWidth value={settings.tz} onChange={(v) => setSettings((s) => ({ ...s, tz: v }))} options={[{ value: "(GMT+9) Dili, Timor-Leste", label: "(GMT+9) Dili, Timor-Leste" }, { value: "(GMT+8) Bali, Indonesia", label: "(GMT+8) Bali, Indonesia" }, { value: "(GMT+10) Darwin, Australia", label: "(GMT+10) Darwin, Australia" }]} /></Field>
                  <Field label="Team digest"><Select fullWidth value={settings.digest} onChange={(v) => setSettings((s) => ({ ...s, digest: v }))} options={["Daily at 6:00 PM", "Daily at 8:00 AM", "Weekly on Monday", "Off"].map((v) => ({ value: v, label: v }))} /></Field>
                </div>
                <ul className="space-y-3 pt-2">
                  {([["afterHours", "After-hours alerts", "Any presence outside opening hours is treated as important."], ["footTraffic", "Foot traffic counting", "Count people entering during opening hours."], ["weeklyEmail", "Weekly email to managers", "Send each manager their location summary."]] as [keyof typeof settings, string, string][]).map(([k, l, h]) => (
                    <li key={k} className="card-inset flex items-center gap-3 p-3.5">
                      <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-text">{l}</span><span className="block text-[12.5px] text-text-3">{h}</span></span>
                      <Toggle checked={Boolean(settings[k])} onChange={(v) => setSettings((s) => ({ ...s, [k]: v }))} label={l} />
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end"><Button onClick={() => void saveSettings()} loading={saving}>Save changes</Button></div>
              </div>
              <div className="card p-5 xl:col-span-5">
                <SectionHeader icon={<ShieldCheck />} title="Business Mode" subtitle="Apply opening-hours rules across all locations." iconTone="success" />
                <p className="text-[14px] text-text-2">Business Mode counts foot traffic during hours and treats any after-hours presence as important. Activate it from Security Modes.</p>
                <Button variant="secondary" className="mt-4" href="/security-modes" rightIcon={<ChevronRight className="size-4" />}>Open Security Modes</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Location drawer */}
      <Drawer open={Boolean(location)} onClose={() => setLocationId(null)} title={location?.name} description={location?.city} width="max-w-lg">
        {location && (
          <div className="space-y-5">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border">
              <SafeImage src={location.imageUrl} alt="" sizes="480px" grayscale={location.status === "offline"} fallbackIcon={<Store className="size-6" />} />
              <div className="absolute left-3 top-3"><Badge tone={location.status === "online" ? "success" : "danger"} dot>{location.status === "online" ? "Online" : "Offline"}</Badge></div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[13.5px]">
              {[["Cameras", `${location.cameras}`], ["Manager", location.manager], ["Opening hours", location.openHours], ["Events today", `${location.eventsToday}`]].map(([k, v]) => (
                <div key={k} className="card-inset p-3"><dt className="text-[11.5px] uppercase tracking-wide text-text-3">{k}</dt><dd className="mt-0.5 font-semibold text-text">{v}</dd></div>
              ))}
            </dl>
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-text">Recent events</h3>
              {d?.events.filter((e) => e.locationId === location.id).length ? (
                <div className="space-y-0.5 rounded-xl border border-border bg-bg/40 p-1.5">
                  {d.events.filter((e) => e.locationId === location.id).map((e) => <EventLine key={e.id} event={{ ...e, location: location.city }} showDay />)}
                </div>
              ) : (
                <p className="text-[13px] text-text-3">No recent events for this location.</p>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-text">Team with access</h3>
              <div className="flex flex-wrap gap-2">
                {(d?.team ?? []).filter((m) => m.locationIds.includes(location.id)).map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 py-1 pl-1 pr-3 text-[12.5px] text-text"><Avatar name={m.name} src={m.avatarUrl} size="xs" />{m.name} <span className="text-text-3">· {m.role}</span></span>
                ))}
              </div>
            </section>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1" leftIcon={<Video className="size-4" />} href="/live" disabled={location.status === "offline"}>View live cameras</Button>
              <Button variant="secondary" leftIcon={<FileText className="size-4" />} onClick={() => void generateReport()} loading={generating}>Report</Button>
              <Button variant="secondary" leftIcon={<Power className="size-4" />} onClick={() => void setLocationStatus(location, location.status === "online" ? "offline" : "online")}>{location.status === "online" ? "Set offline" : "Bring online"}</Button>
            </div>
            <p className="text-[12px] text-text-3">Added {formatDate("2026-03-02T00:00:00+09:00")} · {location.slug}</p>
          </div>
        )}
      </Drawer>

      <Modal open={addLoc} onClose={() => setAddLoc(false)} title="Add a business location" icon={<Plus />} size="sm" footer={<><Button variant="ghost" onClick={() => setAddLoc(false)}>Cancel</Button><Button onClick={() => void addLocation()}>Add Location</Button></>}>
        <div className="space-y-4">
          <Field label="Location name" htmlFor="loc-name"><Input id="loc-name" value={locForm.name} onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Branch - Baucau" data-autofocus /></Field>
          <Field label="City"><Select fullWidth value={locForm.city} onChange={(v) => setLocForm((f) => ({ ...f, city: v }))} options={["Dili, Timor-Leste", "Baucau, Timor-Leste", "Tibar, Timor-Leste", "Liquiçá, Timor-Leste", "Maliana, Timor-Leste"].map((c) => ({ value: c, label: c }))} /></Field>
        </div>
      </Modal>

      <Modal open={addMember} onClose={() => setAddMember(false)} title="Invite a team member" icon={<UserPlus />} size="sm" footer={<><Button variant="ghost" onClick={() => setAddMember(false)}>Cancel</Button><Button onClick={() => void inviteMember()}>Send invite</Button></>}>
        <div className="space-y-4">
          <Field label="Full name" htmlFor="tm-name"><Input id="tm-name" value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Ana Ximenes" data-autofocus /></Field>
          <Field label="Role"><Select fullWidth value={memberForm.role} onChange={(v) => setMemberForm((f) => ({ ...f, role: v }))} options={roleOptions.filter((r) => r.value !== "Owner")} /></Field>
        </div>
      </Modal>
    </>
  );
}

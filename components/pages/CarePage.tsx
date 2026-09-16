"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Heart, Users, Clock, Sparkles, Video, Zap, Phone, MessageSquare, MapPin, Route, ChevronRight, House, Plane, UserX, TriangleAlert, ShieldCheck, Trash2, Pencil } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PersonCard, presenceLabel, presenceTone } from "@/components/matan/PersonCard";
import { SectionHeader } from "@/components/matan/SectionHeader";
import { ActivityTimeline } from "@/components/matan/ActivityTimeline";
import { AIInsightCard } from "@/components/matan/AIInsightCard";
import { CameraTile } from "@/components/matan/CameraCard";
import { QuickAction } from "@/components/matan/QuickAction";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useApi } from "@/hooks/useApi";
import { familyApi } from "@/lib/api/family";
import { images } from "@/lib/mock/images";
import { formatTime, relativeDay, relativeDayTime } from "@/lib/utils/format";
import { toneStyles } from "@/lib/utils/tones";
import { cn } from "@/lib/utils/cn";
import type { FamilyMember, FamilyPresence } from "@/lib/types";
import { useAppMode } from "@/components/experience/experience-provider";
import { SourceBadge } from "@/components/experience/source-badge";
import { RealModeCare } from "@/components/experience/real-mode-care";

export function CarePage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const appMode = useAppMode();
  const q = useApi(() => familyApi.get(), []);
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ name: "", role: "Family" });
  const [adding, setAdding] = React.useState(false);
  const [member, setMember] = React.useState<FamilyMember | null>(null);
  const [action, setAction] = React.useState<"call" | "message" | "checkin" | "routine" | null>(null);
  const [message, setMessage] = React.useState("Hi! Just checking in — everything okay at home?");
  const [acting, setActing] = React.useState(false);

  const d = q.data;
  const members = (d?.members ?? []).filter((m) => !search || `${m.name} ${m.role}`.toLowerCase().includes(search.toLowerCase()));
  const atHome = d?.members.filter((m) => m.presence === "home") ?? [];

  const setFeature = async (id: string, enabled: boolean) => {
    q.setData((s) => (s ? { ...s, features: s.features.map((f) => (f.id === id ? { ...f, enabled } : f)) } : s));
    try {
      const res = await familyApi.setFeature(id, enabled);
      q.setData(res);
      toast.success(`${res.features.find((f) => f.id === id)?.label} ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error();
      void q.refetch({ silent: true });
    }
  };

  const setPresence = async (m: FamilyMember, presence: FamilyPresence) => {
    try {
      q.setData(await familyApi.setPresence(m.id, presence));
      setMember((cur) => (cur ? { ...cur, presence } : cur));
      toast.success(`${m.name} marked ${presenceLabel[presence].toLowerCase()}`, "Demo control");
    } catch {
      toast.error();
    }
  };

  const add = async () => {
    if (!addForm.name.trim()) return toast.warning("Enter a name");
    setAdding(true);
    try {
      await familyApi.addMember({ name: addForm.name.trim(), role: addForm.role });
      await q.refetch({ silent: true });
      setAddOpen(false);
      setAddForm({ name: "", role: "Family" });
      toast.success("Family member added", `${addForm.name.trim()} will be recognised after a few visits.`);
    } catch {
      toast.error();
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (m: FamilyMember) => {
    const ok = await confirm({ title: `Remove ${m.name}?`, description: "Matan AI will stop recognising this person as family. Their past events stay in history.", confirmLabel: "Remove" });
    if (!ok) return;
    try {
      q.setData(await familyApi.removeMember(m.id));
      setMember(null);
      toast.success("Family member removed", m.name);
    } catch {
      toast.error();
    }
  };

  const runAction = async () => {
    setActing(true);
    await new Promise((r) => setTimeout(r, 900));
    setActing(false);
    setAction(null);
    if (action === "call") toast.success("Calling home…", "Two-way talk through the Indoor camera (demo).");
    if (action === "message") toast.success("Message sent", "Played on the Indoor camera speaker (demo).");
    if (action === "checkin") toast.success("Check-in complete", `${atHome.length} at home · everyone is fine.`);
    if (action === "routine") {
      toast.success("Routine created", "Night check-in at 10:30 PM.");
      router.push("/automations?create=1&trigger=Scheduled%20time");
    }
  };

  const glance = d
    ? [
        { key: "home", label: "At Home", value: d.counts.home, icon: <House />, tone: "success" as const, people: d.members.filter((m) => m.presence === "home") },
        { key: "away", label: "Away", value: d.counts.away, icon: <Plane />, tone: "primary" as const, people: d.members.filter((m) => m.presence === "away") },
        { key: "unknown", label: "Not Detected", value: d.counts.unknown, icon: <UserX />, tone: "neutral" as const, people: d.members.filter((m) => m.presence === "unknown") },
        { key: "attention", label: "Needs Attention", value: d.counts.attention, icon: <TriangleAlert />, tone: "danger" as const, people: d.members.filter((m) => m.presence === "attention") },
      ]
    : [];

  return (
    <>
      <Topbar title={<span className="flex flex-wrap items-center gap-3">Care & Family <SourceBadge source={appMode === "ring" ? "ring" : "demo"} short title={appMode === "demo" ? "Demo care data" : undefined} /></span>} subtitle={appMode === "ring" ? "Real Mode shows only Ring detections and the family associations you explicitly configure." : "Keep your loved ones safe and informed. Matan AI helps you care, even when you're not there."} search={{ value: search, onChange: setSearch, placeholder: "Search family, devices, events…" }} />

      {appMode === "ring" ? (
        <RealModeCare />
      ) : q.error ? (

        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      ) : (
        <>
          {/* Row 1: members + status */}
          <div className="grid gap-5 xl:grid-cols-12">
            <div className="xl:col-span-8">
              {q.loading ? (
                <div className="relative flex gap-3 overflow-hidden min-h-[132px]">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[132px] w-[120px] shrink-0 rounded-card" />
                  ))}
                  <LoadingOverlay size="sm" label="Loading family" />
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                  {members.map((m) => (
                    <PersonCard key={m.id} member={m} onClick={() => setMember(m)} selected={member?.id === m.id} className="w-[120px] shrink-0" />
                  ))}
                  <button type="button" onClick={() => setAddOpen(true)} className="card flex w-[120px] shrink-0 flex-col items-center justify-center gap-2.5 border-dashed px-3 py-4 text-center transition-[border-color,background-color] hover:border-primary/50 hover:bg-primary/[0.05]">
                    <span className="inline-flex size-14 items-center justify-center rounded-full border border-dashed border-primary/40 text-primary">
                      <Plus className="size-6" />
                    </span>
                    <span className="text-[13.5px] font-medium text-text">Add Member</span>
                  </button>
                </div>
              )}
            </div>
            <button type="button" onClick={() => router.push("/security-modes")} className={cn("card flex items-center gap-4 p-5 text-left transition-[border-color] hover:border-border-strong xl:col-span-4", d?.status === "attention" && "border-danger/40")}>
              <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border", d?.status === "safe" ? "bg-success/12 border-success/25 text-success" : "bg-warning/12 border-warning/25 text-warning")}>
                <Heart className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-text">Family Status</span>
                <span className={cn("block text-[19px] font-bold", d?.status === "safe" ? "text-success" : "text-warning")}>{d ? (d.status === "safe" ? "Everyone is safe" : d.status === "unknown" ? "Someone not detected yet" : "Needs a check-in") : "…"}</span>
                <span className="block text-[13px] text-text-3">All family members are at home or in expected places.</span>
              </span>
              <ChevronRight className="size-5 text-text-3" aria-hidden />
            </button>
          </div>

          {/* Row 2 */}
          <div className="mt-5 grid gap-5 xl:grid-cols-12">
            <section className="card p-5 xl:col-span-5" aria-labelledby="glance">
              <SectionHeader icon={<Users />} title={<span id="glance">Family at a Glance</span>} subtitle="Real-time status from your Ring devices" href="/events?category=people" />
              {q.loading ? (
                <Skeleton className="h-44" />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {glance.map((g) => {
                    const t = toneStyles[g.tone];
                    return (
                      <div key={g.key} className={cn("card-inset flex flex-col items-center gap-2 p-4 text-center", g.value > 0 && g.tone !== "neutral" && cn(t.border))}>
                        <span className={cn("[&>svg]:size-6", t.text)}>{g.icon}</span>
                        <span className="text-[30px] font-bold leading-none tabular-nums text-text">{g.value}</span>
                        <span className={cn("text-[12.5px] font-medium", g.tone === "neutral" ? "text-text-2" : t.text)}>{g.label}</span>
                        {g.people.length > 0 ? (
                          <>
                            <AvatarStack people={g.people.map((p) => ({ name: p.name, src: p.avatarUrl }))} size="xs" max={3} />
                            {g.key === "home" && <Badge tone="success" size="xs" variant="solid">Safe</Badge>}
                          </>
                        ) : (
                          <span className="mt-1 h-5 w-10 rounded-full bg-surface-3 text-center text-[11px] leading-5 text-text-3">–</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card p-5 xl:col-span-4" aria-labelledby="recent">
              <SectionHeader icon={<Clock />} title={<span id="recent">Recent Family Activity</span>} href="/events?category=people" />
              {q.loading ? (
                <Skeleton className="h-44" />
              ) : (
                <ActivityTimeline
                  compact
                  items={(d?.activity ?? []).slice(0, 4).map((a) => {
                    const m = d?.members.find((x) => x.id === a.memberId);
                    return {
                      id: a.id,
                      time: relativeDay(a.timestamp) === "Today" ? formatTime(a.timestamp) : (<>{relativeDay(a.timestamp)}<br />{formatTime(a.timestamp)}</>),
                      title: a.label,
                      subtitle: a.location,
                      tone: a.tone,
                      icon: <Icon name={a.icon} />,
                      trailing: m ? <Avatar name={m.name} src={m.avatarUrl} size="sm" /> : undefined,
                    };
                  })}
                />
              )}
            </section>

            <section className="card p-5 xl:col-span-3" aria-labelledby="care-ins">
              <SectionHeader icon={<Sparkles />} title={<span id="care-ins">AI Care Insights</span>} subtitle="Matan AI looks for important patterns to keep your family safe." iconTone="purple" />
              {q.loading ? (
                <Skeleton className="h-44" />
              ) : (
                <ul className="space-y-2">
                  {(d?.insights ?? []).map((i) => (
                    <li key={i.id}>
                      <AIInsightCard icon={i.icon} title={i.title} description={i.description} tone={i.tone} onClick={() => router.push("/insights?range=today")} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Row 3 */}
          <div className="mt-5 grid gap-5 xl:grid-cols-12">
            <div className="space-y-5 xl:col-span-6">
              <section className="card p-5" aria-labelledby="live-fam">
                <SectionHeader icon={<Video />} title={<span id="live-fam">Live Family Views</span>} subtitle="Quick access to important areas" href="/live" />
                {q.loading ? (
                  <Skeleton className="h-32" />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(d?.liveViews ?? []).map((v) => (
                      <CameraTile key={v.cameraId} name={v.label} imageUrl={v.imageUrl} onClick={() => router.push(`/live?camera=${v.cameraId === "cam-kids" ? "cam-indoor" : v.cameraId}`)} aspect="aspect-[4/3]" />
                    ))}
                  </div>
                )}
              </section>
              <div className="relative overflow-hidden rounded-hero border border-border min-h-[128px]">
                <SafeImage src={images.familyArrival} alt="" sizes="700px" />
                <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/80 to-bg/30" aria-hidden />
                <div className="relative flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-[20px] font-semibold text-text">Peace of mind, wherever you are.</p>
                    <p className="mt-1 max-w-md text-[13.5px] text-text-2">Matan AI helps you stay connected with the people who matter most.</p>
                  </div>
                  <Button onClick={() => setAction("routine")}>Learn More</Button>
                </div>
              </div>
            </div>

            <section className="card p-5 xl:col-span-3" aria-labelledby="features">
              <SectionHeader icon={<Heart />} title={<span id="features">Care Features</span>} iconTone="danger" />
              {q.loading ? (
                <Skeleton className="h-64" />
              ) : (
                <ul className="space-y-3">
                  {(d?.features ?? []).map((f) => {
                    const t = toneStyles[f.tone];
                    return (
                      <li key={f.id} className="flex items-start gap-3">
                        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border", t.bg, t.border, t.text)}>
                          <Icon name={f.icon} className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-text">{f.label}</span>
                          <span className="block text-[12.5px] leading-snug text-text-3">{f.description}</span>
                        </span>
                        <Toggle checked={f.enabled} onChange={(v) => void setFeature(f.id, v)} label={f.label} size="sm" className="mt-1" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="space-y-5 xl:col-span-3">
              <section className="card p-5" aria-labelledby="qa">
                <SectionHeader icon={<Zap />} title={<span id="qa">Quick Actions</span>} iconTone="warning" />
                <div className="space-y-2">
                  <QuickAction layout="row" icon={<Phone />} label="Call Home" description="Speak through your Ring device" onClick={() => setAction("call")} />
                  <QuickAction layout="row" icon={<MessageSquare />} label="Send Message" description="Play a voice message at home" onClick={() => setAction("message")} />
                  <QuickAction layout="row" icon={<MapPin />} label="Check In Now" description="See who's at home right now" onClick={() => setAction("checkin")} />
                  <QuickAction layout="row" icon={<Route />} label="Create Routine" description="Set up family care automations" onClick={() => setAction("routine")} />
                </div>
              </section>
              <div className="relative overflow-hidden rounded-hero border border-border min-h-[110px]">
                <SafeImage src={images.houseEvening} alt="" sizes="360px" />
                <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/75 to-bg/30" aria-hidden />
                <div className="relative p-5">
                  <p className="text-[17px] font-semibold leading-snug text-text">“A safer tomorrow<br />for the ones we love.”</p>
                  <p className="mt-1 text-[12.5px] font-semibold tracking-wide text-primary">MATAN AI</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add member */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a family member" description="Matan AI learns to recognise them from Ring events over a few visits." icon={<Plus />} size="sm" footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={() => void add()} loading={adding}>Add Member</Button></>}>
        <div className="space-y-4">
          <Field label="Name" htmlFor="fm-name">
            <Input id="fm-name" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Tia Rosa" data-autofocus />
          </Field>
          <Field label="Relationship">
            <Select fullWidth value={addForm.role} onChange={(v) => setAddForm((f) => ({ ...f, role: v }))} options={["Spouse", "Son", "Daughter", "Family", "Caregiver", "Friend"].map((r) => ({ value: r, label: r }))} />
          </Field>
        </div>
      </Modal>

      {/* Quick action modal */}
      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action === "call" ? "Call home" : action === "message" ? "Send a message home" : action === "checkin" ? "Check in now" : "Create a care routine"}
        icon={action === "call" ? <Phone /> : action === "message" ? <MessageSquare /> : action === "checkin" ? <MapPin /> : <Route />}
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button><Button onClick={() => void runAction()} loading={acting}>{action === "call" ? "Start call" : action === "message" ? "Send message" : action === "checkin" ? "Check in" : "Create routine"}</Button></>}
      >
        {action === "message" && (
          <Field label="Message" htmlFor="msg">
            <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} data-autofocus />
          </Field>
        )}
        {action === "call" && <p className="text-[14px] text-text-2">Two-way talk will open on the <span className="font-semibold text-text">Indoor</span> camera in the Living Room. Grandpa and Grandma were last seen there at 07:40 AM.</p>}
        {action === "checkin" && (
          <ul className="space-y-2">
            {(d?.members ?? []).map((m) => (
              <li key={m.id} className="flex items-center gap-3 text-[14px]">
                <Avatar name={m.name} src={m.avatarUrl} size="sm" status={presenceTone[m.presence]} />
                <span className="flex-1 text-text">{m.name}</span>
                <span className="text-text-3">{presenceLabel[m.presence]} · {m.lastSeenLocation}</span>
              </li>
            ))}
          </ul>
        )}
        {action === "routine" && <p className="text-[14px] text-text-2">Create a gentle night-time check-in: if no movement is detected in family areas between 10:30 PM and 6:00 AM, Matan AI sends a calm reminder. You&apos;ll be taken to the automation wizard.</p>}
        <Badge tone="neutral" size="xs" className="mt-4 border-dashed">Demo · no real device action in this preview</Badge>
      </Modal>

      {/* Member drawer */}
      <Drawer open={Boolean(member)} onClose={() => setMember(null)} title={member?.name} description={member?.role} width="max-w-md">
        {member && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={member.name} src={member.avatarUrl} size="xl" status={presenceTone[member.presence]} />
              <div>
                <Badge tone={presenceTone[member.presence]} size="md" dot>{presenceLabel[member.presence]}</Badge>
                <p className="mt-2 text-[13.5px] text-text-2">Last seen {relativeDayTime(member.lastSeenAt).toLowerCase()} · {member.lastSeenLocation}</p>
                {member.isAdmin && <Badge tone="primary" size="xs" className="mt-2" icon={<ShieldCheck className="size-3" />}>Administrator</Badge>}
              </div>
            </div>
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-text">Recent activity</h3>
              <ActivityTimeline compact items={(d?.activity ?? []).filter((a) => a.memberId === member.id).map((a) => ({ id: a.id, time: relativeDay(a.timestamp) === "Today" ? formatTime(a.timestamp) : (<>{relativeDay(a.timestamp)}<br />{formatTime(a.timestamp)}</>), title: a.label, subtitle: a.location, tone: a.tone, icon: <Icon name={a.icon} /> }))} />
              {!(d?.activity ?? []).some((a) => a.memberId === member.id) && <p className="text-[13px] text-text-3">No recent activity recorded.</p>}
            </section>
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-text">Demo controls</h3>
              <div className="flex flex-wrap gap-2">
                {(["home", "away", "unknown"] as FamilyPresence[]).map((p) => (
                  <Button key={p} size="sm" variant={member.presence === p ? "primary" : "secondary"} onClick={() => void setPresence(member, p)}>
                    {presenceLabel[p]}
                  </Button>
                ))}
              </div>
            </section>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button variant="ghost" size="sm" leftIcon={<Pencil className="size-4" />} onClick={() => toast.info("Profile editing is part of the next phase")}>
                Edit profile
              </Button>
              {!member.isAdmin && (
                <Button variant="danger" size="sm" leftIcon={<Trash2 className="size-4" />} onClick={() => void removeMember(member)}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

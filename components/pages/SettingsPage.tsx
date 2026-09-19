"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Settings, Bell, ShieldCheck, Brain, Monitor, Globe, Info, House, Clock, Activity, CalendarDays, Layers, TriangleAlert, Package, Users, Cog, Megaphone, ExternalLink, Database, Sparkles, EyeOff, Share2, SlidersHorizontal, UserRound, Lightbulb, Languages, Moon, Palette, Type, MapPin, Ruler, Download, Upload, RotateCcw, BookOpen, LifeBuoy, MessageSquare, ChevronRight, User, Lock, Link2, Crown, KeyRound, Check } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CardHeader } from "@/components/ui/Card";
import { LoadingOverlay } from "@/components/matan/MatanLoader";
import { useAppData } from "@/components/layout/AppDataProvider";
import { useApi } from "@/hooks/useApi";
import { settingsApi } from "@/lib/api/settings";
import { matanApi } from "@/lib/api/matan";
import { ApiError } from "@/lib/api/client";
import { images } from "@/lib/mock/images";
import { cn } from "@/lib/utils/cn";
import type { SettingsData } from "@/lib/types";
import { ExperienceSettingsCard } from "@/components/experience/experience-settings-card";
import { useTheme } from "@/components/experience/theme-provider";
import { ThemeToggle } from "@/components/experience/theme-toggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthLoadingScreen } from "@/components/auth/AuthGuard";

type Tab = "general" | "notifications" | "privacy" | "ai" | "appearance" | "region" | "about";
const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "general", label: "General", icon: <Settings /> },
  { value: "notifications", label: "Notifications", icon: <Bell /> },
  { value: "privacy", label: "Privacy & Security", icon: <ShieldCheck /> },
  { value: "ai", label: "AI Preferences", icon: <Brain /> },
  { value: "appearance", label: "Appearance", icon: <Monitor /> },
  { value: "region", label: "Language & Region", icon: <Globe /> },
  { value: "about", label: "About", icon: <Info /> },
];

const accents: { key: SettingsData["appearance"]["accent"]; color: string }[] = [
  { key: "blue", color: "#12a8ff" },
  { key: "green", color: "#16df9b" },
  { key: "purple", color: "#9a71ff" },
  { key: "amber", color: "#ffc34a" },
  { key: "red", color: "#ff4d5e" },
];

function Row({ icon, title, hint, control, onClick, tone = "primary" }: { icon: React.ReactNode; title: string; hint: string; control?: React.ReactNode; onClick?: () => void; tone?: "primary" | "danger" | "warning" | "success" | "purple" }) {
  const tones = { primary: "bg-primary/12 border-primary/25 text-primary", danger: "bg-danger/12 border-danger/25 text-danger", warning: "bg-warning/12 border-warning/25 text-warning", success: "bg-success/12 border-success/25 text-success", purple: "bg-purple/12 border-purple/25 text-purple" };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors", onClick && "hover:bg-surface-2/70")}>
      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-[18px]", tones[tone])}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-text">{title}</span>
        <span className="block truncate text-[12.5px] text-text-3">{hint}</span>
      </span>
      {control ?? (onClick && <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />)}
    </Tag>
  );
}

export function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { refresh } = useAppData();
  const { theme } = useTheme();
  const q = useApi(() => settingsApi.get(), []);
  const [tab, setTab] = React.useState<Tab>(((params.get("tab") === "account" ? "general" : params.get("tab")) as Tab) ?? "general");
  const auth = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [modal, setModal] = React.useState<null | "appName" | "quiet" | "storage" | "zones" | "faces" | "password" | "linked" | "plan" | "import" | "feedback" | "guide" | "account" | "alertEmail">(null);
  const [alertEmail, setAlertEmail] = React.useState("");
  const [testingEmail, setTestingEmail] = React.useState(false);
  const [appName, setAppName] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState("");

  const s = q.data?.settings;
  const account = q.data?.account;

  React.useEffect(() => {
    window.history.replaceState(null, "", tab === "general" ? "/settings" : `/settings?tab=${tab}`);
  }, [tab]);

  // Mirror the global theme into the saved preference so it survives as a setting too.
  const themeLabel = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";
  React.useEffect(() => {
    if (q.data && q.data.settings.appearance.theme !== themeLabel) void settingsApi.update({ appearance: { theme: themeLabel } }).then((r) => q.setData(r)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeLabel, q.data?.settings.appearance.theme]);

  type Patch = Parameters<typeof settingsApi.update>[0];
  const update = async (patch: Patch, msg = "Settings saved") => {
    q.setData((d) => (d ? { ...d, settings: deepMerge(d.settings, patch) } : d));
    try {
      q.setData(await settingsApi.update(patch));
      toast.success(msg);
    } catch {
      toast.error();
      void q.refetch({ silent: true });
    }
  };

  const resetSettings = async () => {
    const ok = await confirm({ title: "Reset all settings?", description: "Every preference returns to its default. Devices, events and family members are kept.", confirmLabel: "Reset settings" });
    if (!ok) return;
    setBusy("reset");
    try {
      q.setData(await settingsApi.reset());
      toast.success("Settings reset to defaults");
    } catch {
      toast.error();
    } finally {
      setBusy(null);
    }
  };

  const resetApp = async () => {
    const ok = await confirm({ title: "Reset the app?", description: "This restores the entire demo — events, devices, automations, modes and settings — to the original state.", confirmLabel: "Reset app" });
    if (!ok) return;
    setBusy("resetApp");
    try {
      await settingsApi.resetApp();
      await q.refetch({ silent: true });
      await refresh();
      toast.success("App reset", "Demo data restored to the original state.");
    } catch {
      toast.error();
    } finally {
      setBusy(null);
    }
  };

  const exportData = async () => {
    setBusy("export");
    try {
      const r = await settingsApi.exportData();
      toast.success("Export ready", `${r.file} · ${r.size}`);
    } catch {
      toast.error();
    } finally {
      setBusy(null);
    }
  };

  const match = (label: string) => !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());
  const show = (t: Tab) => tab === "general" || tab === t;

  if (q.error) {
    return (
      <>
        <Topbar title="Settings" subtitle="Customize Matan AI to fit your needs. Stay in control, your way." />
        <ErrorState onRetry={() => void q.refetch()} message={q.error} />
      </>
    );
  }

  const loading = q.loading || !s || !account;

  const generalCard = s && (
    <section className="card p-5" aria-labelledby="gen">
      <CardHeader icon={<Settings />} title={<span id="gen">General Settings</span>} subtitle="Basic preferences for your Matan AI experience." />
      <div className="space-y-1">
        {match("app name") && <Row icon={<Layers />} title="App Name" hint="Choose how your home appears in the app." control={<Button variant="secondary" size="sm" rightIcon={<ChevronRight className="size-3.5" />} onClick={() => { setAppName(s.general.appName); setModal("appName"); }}>{s.general.appName}</Button>} />}
        {match("time zone") && <Row icon={<Clock />} title="Time Zone" hint="Set your local time zone." control={<Select size="sm" value={s.general.timeZone} onChange={(v) => void update({ general: { timeZone: v } })} options={["(GMT+9) Dili, Timor-Leste", "(GMT+8) Bali, Indonesia", "(GMT+10) Darwin, Australia", "(GMT+0) London, UK"].map((v) => ({ value: v, label: v }))} align="end" label="Time zone" />} />}
        {match("date") && <Row icon={<CalendarDays />} title="Date & Time Format" hint="Choose how dates and times are displayed." control={<Select size="sm" value={s.general.dateFormat} onChange={(v) => void update({ general: { dateFormat: v } })} options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((v) => ({ value: v, label: v }))} align="end" label="Date format" />} />}
        {match("start page") && <Row icon={<House />} title="Start Page" hint="Select the page to show when opening the app." control={<Select size="sm" value={s.general.startPage} onChange={(v) => void update({ general: { startPage: v } })} options={["Home", "Live View", "Events", "AI Assistant"].map((v) => ({ value: v, label: v }))} align="end" label="Start page" />} />}
      </div>
    </section>
  );

  const notificationsCard = s && (
    <section className="card p-5" aria-labelledby="ntf">
      <CardHeader icon={<Bell />} title={<span id="ntf">Notifications</span>} subtitle="Choose what you want to be notified about." />
      <div className="space-y-1">
        {([["securityAlerts", "Security Alerts", "Motion, people, unusual activity", <TriangleAlert key="a" />, "danger"], ["packageDeliveries", "Package Deliveries", "When a package is detected", <Package key="b" />, "warning"], ["familyActivity", "Family Activity", "Arrivals, departures, check-ins", <Users key="c" />, "purple"], ["deviceStatus", "Device Status", "Offline, low battery, issues", <Cog key="d" />, "primary"], ["marketingUpdates", "Marketing Updates", "Product news and tips", <Megaphone key="e" />, "primary"]] as [keyof SettingsData["notifications"], string, string, React.ReactNode, "danger" | "warning" | "purple" | "primary"][])
          .filter(([, l]) => match(l))
          .map(([k, l, h, icon, tone]) => <Row key={k} icon={icon} title={l} hint={h} tone={tone} control={<Toggle checked={Boolean(s.notifications[k])} onChange={(v) => void update({ notifications: { [k]: v } }, `${l} ${v ? "on" : "off"}`)} label={l} />} />)}
        {tab === "notifications" && (
          <>
            <Row icon={<Mail />} title="Alert email address" hint={s.notifications.emailAddress ? `Matan AI email alerts go to ${s.notifications.emailAddress}` : "Set where high-priority Matan AI alerts are emailed."} tone="primary" onClick={() => { setAlertEmail(s.notifications.emailAddress ?? (auth.user?.email ?? "")); setModal("alertEmail"); }} control={<ChevronRight className="size-4 text-text-3" />} />
            {s.notifications.emailAddress && (
              <Row
                icon={<Sparkles />}
                title="Send test alert"
                hint="Emails a sample high-priority alert to the address above via Amazon SES."
                tone="primary"
                control={
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={testingEmail}
                    onClick={async () => {
                      setTestingEmail(true);
                      try {
                        const r = await matanApi.sendTestAlert();
                        if (r.status === "sent") toast.success("Test alert sent", `Check ${s.notifications.emailAddress}. Message id ${r.messageId.slice(0, 12)}…`);
                        else if (r.status === "duplicate") toast.info("Please wait a minute", "Test alerts are limited to one per minute.");
                        else if (r.status === "skipped") toast.info("Not sent", r.reason);
                        else toast.error("Email failed", r.code === "SES_MESSAGE_REJECTED" ? "SES rejected the address - while SES is in Sandbox the recipient must be a verified identity." : r.code);
                      } catch (e) {
                        const p = (e as ApiError).payload as { reason?: string; code?: string; status?: string } | undefined;
                        if (p?.status === "duplicate") toast.info("Please wait a minute", "Test alerts are limited to one per minute.");
                        else if (p?.status === "skipped") toast.info("Not sent", p.reason);
                        else toast.error("Email failed", p?.code === "SES_MESSAGE_REJECTED" ? "SES rejected the address - while SES is in Sandbox the recipient must be a verified identity." : p?.code ?? "Please try again.");
                      } finally {
                        setTestingEmail(false);
                      }
                    }}
                  >
                    Send test
                  </Button>
                }
              />
            )}
            <Row icon={<Moon />} title="Quiet hours" hint={s.notifications.quietHoursEnabled ? s.notifications.quietHours : "Off"} tone="purple" control={<Toggle checked={s.notifications.quietHoursEnabled} onChange={(v) => void update({ notifications: { quietHoursEnabled: v } }, v ? "Quiet hours on" : "Quiet hours off")} label="Quiet hours" />} />
            <div className="grid grid-cols-3 gap-2 px-2 pt-2">
              {(["push", "email", "sms"] as const).map((ch) => (
                <button key={ch} type="button" onClick={() => void update({ notifications: { channels: { [ch]: !s.notifications.channels[ch] } } }, `${ch.toUpperCase()} ${s.notifications.channels[ch] ? "off" : "on"}`)} aria-pressed={s.notifications.channels[ch]} className={cn("card-inset flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium capitalize transition-colors", s.notifications.channels[ch] ? "border-primary/50 text-primary bg-primary/8" : "text-text-3")}>
                  {s.notifications.channels[ch] && <Check className="size-3.5" />} {ch === "sms" ? "SMS" : ch}
                </button>
              ))}
            </div>
          </>
        )}
        <Button variant="secondary" fullWidth className="mt-3 justify-between" rightIcon={<ChevronRight className="size-4" />} leftIcon={<ExternalLink className="size-4" />} onClick={() => setTab("notifications")}>
          Notification Preferences
        </Button>
      </div>
    </section>
  );

  const privacyCard = s && (
    <section className="card p-5" aria-labelledby="prv">
      <CardHeader icon={<ShieldCheck />} title={<span id="prv">Privacy & Security</span>} subtitle="Control your data and keep your home secure." />
      <div className="space-y-1">
        {match("data storage") && <Row icon={<Database />} title="Data Storage" hint={`Keep recordings for ${s.privacy.retentionDays} days.`} onClick={() => setModal("storage")} />}
        {match("ai processing") && <Row icon={<Sparkles />} title="AI Processing" hint="Choose how AI analyzes your data." tone="purple" control={<Select size="sm" value={s.privacy.aiProcessing} onChange={(v) => void update({ privacy: { aiProcessing: v } })} options={[{ value: "cloud", label: "Full analysis", description: "Best accuracy" }, { value: "balanced", label: "Balanced", description: "Recommended" }, { value: "minimal", label: "Minimal", description: "Motion only" }]} align="end" label="AI processing" />} />}
        {match("privacy zones") && <Row icon={<EyeOff />} title="Privacy Zones" hint={`${s.privacy.privacyZones} zones hidden from monitoring.`} onClick={() => setModal("zones")} />}
        {match("data sharing") && <Row icon={<Share2 />} title="Data Sharing" hint="Share events with family members." control={<Toggle checked={s.privacy.shareWithFamily} onChange={(v) => void update({ privacy: { shareWithFamily: v } }, v ? "Sharing with family on" : "Sharing with family off")} label="Share with family" />} />}
        {tab === "privacy" && <Row icon={<Share2 />} title="Anonymised analytics" hint="Help improve Matan AI with anonymous usage data." control={<Toggle checked={s.privacy.shareAnonymizedAnalytics} onChange={(v) => void update({ privacy: { shareAnonymizedAnalytics: v } })} label="Anonymised analytics" />} />}
      </div>
    </section>
  );

  const aiCard = s && (
    <section className="card p-5" aria-labelledby="aip">
      <CardHeader icon={<Brain />} title={<span id="aip">AI Preferences</span>} subtitle="Customize how Matan AI works for you." iconTone="purple" />
      <div className="space-y-1">
        {match("sensitivity") && <Row icon={<SlidersHorizontal />} title="Detection Sensitivity" hint="Adjust AI detection sensitivity." control={<Select size="sm" value={s.ai.sensitivity} onChange={(v) => void update({ ai: { sensitivity: v } }, `Sensitivity set to ${v}`)} options={["Low", "Medium", "High"].map((v) => ({ value: v as SettingsData["ai"]["sensitivity"], label: v }))} align="end" label="Sensitivity" />} />}
        {match("recognition") && <Row icon={<UserRound />} title="People Recognition" hint={`Manage known faces (${s.ai.knownFaces}).`} onClick={() => setModal("faces")} control={<span className="flex items-center gap-2"><Toggle size="sm" checked={s.ai.peopleRecognition} onChange={(v) => void update({ ai: { peopleRecognition: v } }, v ? "People recognition on" : "People recognition off")} label="People recognition" /><ChevronRight className="size-4 text-text-3" /></span>} />}
        {match("smart alerts") && <Row icon={<Lightbulb />} title="Smart Alerts" hint="Let AI filter unimportant events." tone="warning" control={<Toggle checked={s.ai.smartAlerts} onChange={(v) => void update({ ai: { smartAlerts: v } }, v ? "Smart alerts on" : "Smart alerts off")} label="Smart alerts" />} />}
        {match("language") && <Row icon={<MessageSquare />} title="AI Language" hint="Choose AI assistant language." control={<Select size="sm" value={s.ai.language} onChange={(v) => void update({ ai: { language: v } })} options={["English", "Tetum", "Português", "Bahasa Indonesia"].map((v) => ({ value: v, label: v }))} align="end" label="AI language" />} />}
        {match("auto") && (
          <Row
            icon={<Sparkles />}
            title="Auto-analyze new Ring events"
            hint="Real Mode · Bedrock Nova Pro runs on new events automatically."
            tone="purple"
            control={
              <Select
                size="sm"
                value={s.ai.autoAnalyze ?? "off"}
                onChange={(v) => void update({ ai: { autoAnalyze: v } }, v === "off" ? "Auto-analysis off" : v === "video" ? "Auto-analysis: snapshot + video escalation" : "Auto-analysis: snapshot")}
                options={[
                  { value: "off" as const, label: "Off", description: "Analyze manually only" },
                  { value: "snapshot" as const, label: "Snapshot", description: "≈ $0.003 per event" },
                  { value: "video" as const, label: "Snapshot + video", description: "Escalates to the clip when useful" },
                ]}
                align="end"
                label="Auto-analyze"
              />
            }
          />
        )}
        {match("live view") && <Row icon={<Activity />} title="Include live-view sessions" hint="Also analyze on_demand sessions (Playground simulations)." tone="purple" control={<Toggle checked={s.ai.autoIncludeLiveView ?? false} onChange={(v) => void update({ ai: { autoIncludeLiveView: v } }, v ? "Live-view sessions included" : "Live-view sessions excluded")} label="Include live-view sessions" />} />}
        {match("media window") && <Row icon={<Clock />} title="Media window" hint="Seconds of media before and after the event sent to Nova." control={<Select size="sm" value={String(s.ai.mediaPadSeconds ?? 5)} onChange={(v) => void update({ ai: { mediaPadSeconds: Number(v) as 5 | 10 } }, `Media window ±${v}s`)} options={[{ value: "5", label: "±5 s" }, { value: "10", label: "±10 s" }]} align="end" label="Media window" />} />}
      </div>
    </section>
  );

  const appearanceCard = s && (
    <section className="card p-5" aria-labelledby="app">
      <CardHeader icon={<Monitor />} title={<span id="app">Appearance</span>} subtitle="Make the app look and feel right for you." />
      <div className="space-y-1">
        {match("theme") && (
          <Row
            icon={<Moon />}
            title="Theme"
            hint={`Dark / Light / System · currently ${theme}`}
            tone="purple"
            control={
              <ThemeToggle
                size="sm"
              />
            }
          />
        )}
        {match("accent") && (
          <Row
            icon={<Palette />}
            title="Accent Color"
            hint="Choose your preferred color."
            control={
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Accent color">
                {accents.map((a) => (
                  <button key={a.key} type="button" role="radio" aria-checked={s.appearance.accent === a.key} aria-label={a.key} onClick={() => void update({ appearance: { accent: a.key } }, `Accent: ${a.key}`)} className={cn("inline-flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110", s.appearance.accent === a.key && "ring-2 ring-white ring-offset-2 ring-offset-surface")} style={{ background: a.color }}>
                    {s.appearance.accent === a.key && <Check className="size-3.5 text-bg" />}
                  </button>
                ))}
              </div>
            }
          />
        )}
        {match("font") && <Row icon={<Type />} title="Font Size" hint="Adjust text size." control={<Select size="sm" value={s.appearance.fontSize} onChange={(v) => void update({ appearance: { fontSize: v } })} options={["Small", "Medium", "Large"].map((v) => ({ value: v as SettingsData["appearance"]["fontSize"], label: v }))} align="end" label="Font size" />} />}
      </div>
    </section>
  );

  const regionCard = s && (
    <section className="card p-5" aria-labelledby="reg">
      <CardHeader icon={<Globe />} title={<span id="reg">Language & Region</span>} subtitle="Set your language and regional preferences." />
      <div className="space-y-1">
        {match("language") && <Row icon={<Languages />} title="Language" hint="Choose app language." control={<Select size="sm" value={s.region.language} onChange={(v) => void update({ region: { language: v } })} options={["English", "Tetum", "Português", "Bahasa Indonesia"].map((v) => ({ value: v, label: v }))} align="end" label="Language" />} />}
        {match("region") && <Row icon={<MapPin />} title="Region" hint="Set your country/region." control={<Select size="sm" value={s.region.region} onChange={(v) => void update({ region: { region: v } })} options={["Timor-Leste", "Indonesia", "Australia", "Portugal"].map((v) => ({ value: v, label: v }))} align="end" label="Region" />} />}
        {match("units") && <Row icon={<Ruler />} title="Units" hint="Choose measurement units." control={<Select size="sm" value={s.region.units} onChange={(v) => void update({ region: { units: v } })} options={["Metric (°C, km)", "Imperial (°F, mi)"].map((v) => ({ value: v, label: v }))} align="end" label="Units" />} />}
      </div>
    </section>
  );

  const advancedCard = (
    <section className="card p-5" aria-labelledby="adv">
      <CardHeader icon={<SlidersHorizontal />} title={<span id="adv">Advanced Settings</span>} subtitle="For advanced users." />
      <div className="space-y-1">
        <Row icon={<Download />} title="Export Data" hint="Download your data." onClick={() => void exportData()} control={busy === "export" ? <Badge tone="primary" size="xs">Preparing…</Badge> : undefined} />
        <Row icon={<Upload />} title="Import Settings" hint="Restore from backup." onClick={() => setModal("import")} />
        <Row icon={<RotateCcw />} title="Reset Settings" hint="Restore preferences to defaults." tone="warning" onClick={() => void resetSettings()} />
        <Row icon={<TriangleAlert />} title="Reset App" hint="Restore the entire demo to its original state." tone="danger" onClick={() => void resetApp()} />
      </div>
    </section>
  );

  const helpCard = (
    <section className="card p-5" aria-labelledby="hlp">
      <CardHeader icon={<LifeBuoy />} title={<span id="hlp">Help & Support</span>} subtitle="Need help? We're here for you." />
      <div className="space-y-1">
        <Row icon={<BookOpen />} title="User Guide" hint="Learn how to use Matan AI." onClick={() => setModal("guide")} />
        <Row icon={<LifeBuoy />} title="Contact Support" hint="Get help from our team." onClick={() => toast.success("Support request opened", "We'll reply to ajito@example.com within 24 hours.")} />
        <Row icon={<MessageSquare />} title="Send Feedback" hint="Help us improve Matan AI." onClick={() => setModal("feedback")} />
      </div>
    </section>
  );

  const accountCard = account && (
    <section className="card p-5" aria-labelledby="acc">
      <button type="button" onClick={() => setModal("account")} className="flex w-full items-center gap-3.5 rounded-xl p-1 text-left transition-colors hover:bg-surface-2/60">
        <Avatar name={account.name} src={account.avatarUrl} size="lg" ring />
        <span className="min-w-0 flex-1">
          <span id="acc" className="block text-[17px] font-semibold text-text">{account.name}</span>
          <span className="block truncate text-[13px] text-text-3">{account.email}</span>
          <span className="block text-[13px] text-text-2">{account.role}</span>
        </span>
        <ChevronRight className="size-4 text-text-3" aria-hidden />
      </button>
      <div className="mt-3 space-y-1 border-t border-border pt-3">
        <Row icon={<User />} title="Manage Account" hint="Name, email and photo." onClick={() => setModal("account")} />
        <Row icon={<KeyRound />} title="Sign-in method" hint={auth.user?.provider === "google" ? "Google account via Amazon Cognito." : "Email & password via Amazon Cognito."} control={<Badge tone={auth.user?.provider === "google" ? "success" : "primary"} size="xs">{auth.user?.provider === "google" ? "Google" : "Email"}</Badge>} />
        {auth.user?.provider !== "google" && <Row icon={<Lock />} title="Change Password" hint="We'll email you a verification code." onClick={() => router.push(`/forgot-password?email=${encodeURIComponent(auth.user?.email ?? "")}`)} />}
        <Row icon={<ShieldCheck />} title="Two-Factor Authentication" hint="Protect your account with a code." tone="success" onClick={() => toast.info("Two-factor authentication is managed in the next phase", "It's currently enabled for this account.")} control={<span className="flex items-center gap-2 text-[13px] font-semibold text-success">Enabled <ChevronRight className="size-4 text-text-3" /></span>} />
        <Row icon={<Link2 />} title="Linked Accounts" hint="Ring, Google, Apple." onClick={() => setModal("linked")} />
        <Row icon={<Crown />} title="Subscription Plan" hint="Manage billing and plan." tone="warning" onClick={() => setModal("plan")} control={<span className="flex items-center gap-2 text-[13px] font-semibold text-primary">{account.plan} <ChevronRight className="size-4 text-text-3" /></span>} />
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <Button
          variant="outline"
          fullWidth
          onClick={async () => {
            if (!(await confirm({ title: "Sign out of Matan AI?", description: "Your Demo/Real mode preference stays on this device; the Ring session ends with your account session.", confirmLabel: "Sign out" }))) return;
            setSigningOut(true);
            try {
              await auth.signOut();
              router.replace("/login?notice=signed-out");
            } catch {
              setSigningOut(false);
              toast.error("Couldn't sign out", "Please try again.");
            }
          }}
        >
          Sign out
        </Button>
      </div>
      {signingOut && <AuthLoadingScreen label="Signing you out…" />}
    </section>
  );

  const aboutCard = (
    <section className="card p-5" aria-labelledby="abt">
      <CardHeader icon={<Info />} title={<span id="abt">About Matan AI</span>} subtitle="Your intelligent eye at home." />
      <dl className="grid gap-3 sm:grid-cols-2 text-[13.5px]">
        {[["Version", "0.1.0 · UI preview"], ["Build", "Preview · Sep 2026"], ["Data", "Demo dataset (no live Ring/AWS)"], ["AI", "Amazon Nova via Bedrock (next phase)"], ["Made in", "Dili, Timor-Leste"], ["Licence", "Preview build"]].map(([k, v]) => (
          <div key={k} className="card-inset p-3"><dt className="text-[11.5px] uppercase tracking-wide text-text-3">{k}</dt><dd className="mt-0.5 font-medium text-text">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-4 text-[13.5px] leading-relaxed text-text-2">Ring sees the event. Matan understands the situation, decides what deserves attention, and helps you act.</p>
    </section>
  );

  return (
    <>
      <Topbar title="Settings" subtitle="Customize Matan AI to fit your needs. Stay in control, your way." search={{ value: search, onChange: setSearch, placeholder: "Search settings…" }} />
      <Tabs items={tabs} value={tab} onChange={setTab} aria-label="Settings sections" className="mb-5" />

      {loading ? (
        <div className="relative grid gap-5 lg:grid-cols-3 min-h-[560px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[260px] rounded-card" />
          ))}
          <LoadingOverlay label="Loading settings" />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className={cn("grid gap-5 xl:col-span-8", tab === "general" ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
            {(tab === "general" || tab === "about") && (
              <div className={tab === "general" ? "lg:col-span-2" : undefined}>
                <ExperienceSettingsCard />
              </div>
            )}
            {show("general") && generalCard}
            {show("notifications") && notificationsCard}
            {show("privacy") && privacyCard}
            {show("ai") && aiCard}
            {show("appearance") && appearanceCard}
            {show("region") && regionCard}
            {(tab === "general" || tab === "about") && advancedCard}
            {(tab === "general" || tab === "about") && helpCard}
            {tab === "about" && aboutCard}
          </div>
          <div className="space-y-5 xl:col-span-4">
            {accountCard}
            <div className="relative overflow-hidden rounded-hero border border-border min-h-[150px]">
              <SafeImage src={images.houseEvening} alt="" sizes="360px" />
              <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/75 to-bg/30" aria-hidden />
              <div className="relative p-5">
                <p className="text-[19px] font-semibold leading-snug text-text">A safer, smarter<br />Timor-Leste together.</p>
                <p className="mt-1 text-[12.5px] font-semibold tracking-wide text-primary">MATAN AI</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={modal === "appName"} onClose={() => setModal(null)} title="App name" size="sm" icon={<Layers />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { void update({ general: { appName: appName.trim() || "Matan AI" } }, "App name saved"); setModal(null); }}>Save</Button></>}>
        <Field label="How should your home appear?" htmlFor="appname"><Input id="appname" value={appName} onChange={(e) => setAppName(e.target.value)} data-autofocus /></Field>
      </Modal>

      <Modal open={modal === "storage"} onClose={() => setModal(null)} title="Data storage" description="How long Matan AI keeps recordings and analysis." size="sm" icon={<Database />} footer={<Button onClick={() => setModal(null)}>Done</Button>}>
        <div className="grid grid-cols-4 gap-2">
          {[7, 30, 60, 180].map((days) => (
            <button key={days} type="button" onClick={() => void update({ privacy: { retentionDays: days } }, `Retention set to ${days} days`)} aria-pressed={s?.privacy.retentionDays === days} className={cn("card-inset py-3 text-center text-[14px] font-semibold transition-colors", s?.privacy.retentionDays === days ? "border-primary/50 bg-primary/10 text-primary" : "text-text-2")}>
              {days}d
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-3">Currently used: 4.2 GB of 50 GB.</p>
      </Modal>

      <Modal open={modal === "zones"} onClose={() => setModal(null)} title="Privacy zones" description="Areas hidden from recording and analysis." size="sm" icon={<EyeOff />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Close</Button><Button onClick={() => { void update({ privacy: { privacyZones: (s?.privacy.privacyZones ?? 0) + 1 } }, "Privacy zone added"); }}>Add zone</Button></>}>
        <ul className="space-y-2 text-[14px] text-text-2">
          <li className="card-inset flex items-center justify-between p-3"><span>Neighbour&apos;s window · Side Door</span><Badge tone="success" size="xs">Active</Badge></li>
          <li className="card-inset flex items-center justify-between p-3"><span>Street pavement · Front Door</span><Badge tone="success" size="xs">Active</Badge></li>
          {Array.from({ length: Math.max(0, (s?.privacy.privacyZones ?? 2) - 2) }).map((_, i) => (
            <li key={i} className="card-inset flex items-center justify-between p-3"><span>New zone {i + 1}</span><Badge tone="warning" size="xs">Draw area</Badge></li>
          ))}
        </ul>
      </Modal>

      <Modal open={modal === "faces"} onClose={() => setModal(null)} title="Known faces" description="People Matan AI recognises as family." size="sm" icon={<UserRound />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Close</Button><Button onClick={() => { setModal(null); router.push("/care"); }}>Manage in Care & Family</Button></>}>
        <div className="flex flex-wrap gap-3">
          {[["Ajito", images.avatarAjito], ["Maria", images.avatarMaria], ["Noel", images.avatarNoel], ["Ana", images.avatarAna], ["Grandpa", images.avatarGrandpa], ["Grandma", images.avatarGrandma]].map(([n, src]) => (
            <span key={n} className="flex flex-col items-center gap-1 text-[12px] text-text-2"><Avatar name={n} src={src} size="md" />{n}</span>
          ))}
        </div>
      </Modal>

      <Modal open={modal === "alertEmail"} onClose={() => setModal(null)} title="Alert email address" size="sm" icon={<Mail />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { const v = alertEmail.trim().toLowerCase(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast.error("Enter a valid email address"); return; } void update({ notifications: { emailAddress: v, channels: { email: Boolean(v) } } }, v ? "Alert email saved" : "Email alerts turned off"); setModal(null); }}>Save</Button></>}>
        <Field label="Email" htmlFor="alert-email" hint="High-priority Matan AI decisions are emailed here via Amazon SES. While SES is in Sandbox, only verified addresses receive mail.">
          <Input id="alert-email" type="email" inputMode="email" autoComplete="email" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
      </Modal>
      <Modal open={modal === "password"} onClose={() => setModal(null)} title="Change password" size="sm" icon={<KeyRound />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { setModal(null); toast.success("Password updated"); }}>Update password</Button></>}>
        <div className="space-y-3">
          <Field label="Current password" htmlFor="pw0"><Input id="pw0" type="password" placeholder="••••••••" data-autofocus /></Field>
          <Field label="New password" htmlFor="pw1" hint="At least 12 characters."><Input id="pw1" type="password" placeholder="••••••••" /></Field>
        </div>
        <Badge tone="neutral" size="xs" className="mt-3 border-dashed">Demo · no real credentials are stored</Badge>
      </Modal>

      <Modal open={modal === "linked"} onClose={() => setModal(null)} title="Linked accounts" size="sm" icon={<Link2 />} footer={<Button onClick={() => setModal(null)}>Done</Button>}>
        <ul className="space-y-2">
          {[["Ring", "Demo data · not linked", false], ["Google", "ajito@example.com", true], ["Apple", "Not linked", false]].map(([n, h, on]) => (
            <li key={String(n)} className="card-inset flex items-center gap-3 p-3">
              <span className="flex-1"><span className="block text-[14px] font-semibold text-text">{n}</span><span className="block text-[12.5px] text-text-3">{h}</span></span>
              <Button size="sm" variant={on ? "outline" : "primary"} onClick={() => toast.info(on ? `${n} unlink is part of the next phase` : `${n} linking is part of the next phase`)}>{on ? "Unlink" : "Link"}</Button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={modal === "plan"} onClose={() => setModal(null)} title="Subscription plan" size="sm" icon={<Crown />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Close</Button><Button onClick={() => { setModal(null); toast.info("Billing is part of the next phase"); }}>Manage billing</Button></>}>
        <div className="card-inset p-4">
          <div className="flex items-center justify-between"><span className="text-[17px] font-bold text-text">Pro Plan</span><Badge tone="success" size="sm">Active</Badge></div>
          <p className="mt-1 text-[13px] text-text-3">Unlimited cameras · 30-day history · AI Assistant · Family & Business</p>
          <p className="mt-3 text-[13px] text-text-2">Renews 1 Oct 2026 · $9.99 / month</p>
        </div>
      </Modal>

      <Modal open={modal === "import"} onClose={() => setModal(null)} title="Import settings" description="Restore preferences from a Matan AI backup file." size="sm" icon={<Upload />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { setModal(null); toast.success("Settings imported", "matan-ai-backup.json"); }}>Import</Button></>}>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center text-[13.5px] text-text-3 transition-colors hover:border-primary/50">
          <Upload className="mb-2 size-6 text-primary" />
          Drop a .json backup here or click to choose
          <input type="file" accept="application/json" className="sr-only" onChange={() => toast.info("File selected (demo)")} />
        </label>
      </Modal>

      <Modal open={modal === "feedback"} onClose={() => setModal(null)} title="Send feedback" description="Tell us what works and what doesn't." size="sm" icon={<MessageSquare />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button disabled={!feedback.trim()} onClick={() => { setModal(null); setFeedback(""); toast.success("Thanks for your feedback!"); }}>Send</Button></>}>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder="What could Matan AI do better?" className="w-full rounded-control border border-border bg-surface-2/80 px-3.5 py-2.5 text-sm text-text placeholder:text-text-3 outline-none focus:border-primary/50" data-autofocus />
      </Modal>

      <Modal open={modal === "guide"} onClose={() => setModal(null)} title="User guide" size="md" icon={<BookOpen />} footer={<Button onClick={() => setModal(null)}>Got it</Button>}>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-text-2">
          <li><span className="font-semibold text-text">Home</span> answers “what matters right now” — live hero, status, latest intelligent events.</li>
          <li><span className="font-semibold text-text">Events</span> groups raw Ring motion into stories with AI analysis and recommended actions.</li>
          <li><span className="font-semibold text-text">Security Modes</span> change how strictly Matan AI filters alerts.</li>
          <li><span className="font-semibold text-text">Automations</span> connect Trigger → Condition → Action.</li>
          <li>Ask the <span className="font-semibold text-text">AI Assistant</span> anything — it reasons over the same events.</li>
        </ol>
      </Modal>

      <Modal open={modal === "account"} onClose={() => setModal(null)} title="Manage account" size="sm" icon={<User />} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { setModal(null); toast.success("Account updated"); }}>Save</Button></>}>
        {account && (
          <div className="space-y-3">
            <div className="flex items-center gap-3"><Avatar name={account.name} src={account.avatarUrl} size="lg" /><Button variant="secondary" size="sm" onClick={() => toast.info("Photo upload is part of the next phase")}>Change photo</Button></div>
            <Field label="Full name" htmlFor="acc-name"><Input id="acc-name" defaultValue={account.name} /></Field>
            <Field label="Email" htmlFor="acc-email"><Input id="acc-email" type="email" defaultValue={account.email} /></Field>
            <Field label="Location" htmlFor="acc-loc"><Input id="acc-loc" defaultValue={account.location} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function deepMerge<T extends object>(target: T, patch: object): T {
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge((out[k] ?? {}) as object, v as object);
    else if (v !== undefined) out[k] = v;
  }
  return out as T;
}

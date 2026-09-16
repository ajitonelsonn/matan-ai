"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink, Clock, Lock, Check, ChevronLeft, ChevronRight, Sparkles, Star, MapPin, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Field, Input } from "@/components/ui/Input";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/components/ui/Toast";
import { RingTokenInput } from "./ring-token-input";
import { RingDeviceSelector } from "./ring-device-selector";
import { RingDiscoveryEmpty, RingDiscoveryError, RingDiscoveryLoading } from "./ring-device-discovery";
import { ringKindIcon, ringKindLabel, ringStatusTone } from "./ring-device-card";
import { ringApi, ringErrorFrom, type DevicePick } from "@/lib/api/ring";
import { RING_PLAYGROUND_URL } from "@/lib/ring/constants";
import type { ConnectedRingDevice, RingDiscoveredDevice, RingErrorPayload, RingSessionInfo } from "@/lib/ring/types";

type Step = 1 | 2 | 3 | 4;
const steps: { n: Step; label: string }[] = [
  { n: 1, label: "Connect" },
  { n: 2, label: "Discover" },
  { n: 3, label: "Select" },
  { n: 4, label: "Finish" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? "step" : undefined}>
            <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors", active ? "bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_4px_14px_rgba(18,168,255,0.35)]" : done ? "bg-success/15 text-success border border-success/30" : "bg-surface-3 text-text-3")}>
              {done ? <Check className="size-3.5" /> : s.n}
            </span>
            <span className={cn("text-[13px] font-medium whitespace-nowrap", active ? "text-text" : done ? "text-success" : "text-text-3")}>
              <span className="sr-only">Step {s.n}: </span>
              {s.label}
              {done && <span className="sr-only"> (completed)</span>}
            </span>
            {i < steps.length - 1 && <span className={cn("mx-1 h-px flex-1", done ? "bg-success/40" : "bg-border")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

type LocalMeta = { displayName: string; locationLabel: string; aiEnabled: boolean; favorite: boolean };

export interface AddRingDeviceModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after devices are saved; receives the fresh connected list + session. */
  onConnected: (connected: ConnectedRingDevice[], session: RingSessionInfo | null) => void;
  /** Skip the token step when a valid session already exists (adding more devices). */
  existingSession?: RingSessionInfo | null;
  alreadyConnectedIds?: string[];
}

export function AddRingDeviceModal({ open, onClose, onConnected, existingSession, alreadyConnectedIds = [] }: AddRingDeviceModalProps) {
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<RingErrorPayload | null>(null);
  const [devices, setDevices] = React.useState<RingDiscoveredDevice[]>([]);
  const [session, setSession] = React.useState<RingSessionInfo | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [meta, setMeta] = React.useState<Record<string, LocalMeta>>({});
  const [configuring, setConfiguring] = React.useState(false);
  const [saved, setSaved] = React.useState<ConnectedRingDevice[]>([]);
  const inFlight = React.useRef(false);

  const canReuseSession = existingSession && (existingSession.status === "valid" || existingSession.status === "expiring");

  // Reset when (re)opened. Never keep a token around after closing.
  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setToken("");
    setError(null);
    setDevices([]);
    setSelected(new Set());
    setMeta({});
    setConfiguring(false);
    setSaved([]);
    setSession(existingSession ?? null);
    if (canReuseSession) void discover(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const discover = async (reuse = false) => {
    if (inFlight.current) return;
    const value = token.trim();
    if (!reuse && !value) {
      setError({ code: "RING_TOKEN_MISSING", title: "Token required", message: "Paste a Ring Playground access token to continue." });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStep(2);
    try {
      const res = reuse ? await ringApi.refresh() : await ringApi.discover(value);
      setToken(""); // the token has done its one job
      setDevices(res.devices);
      setSession(res.session);
      const fresh = res.devices.filter((d) => !alreadyConnectedIds.includes(d.id));
      setSelected(new Set((fresh.length ? fresh : res.devices).map((d) => d.id)));
      setMeta(Object.fromEntries(res.devices.map((d) => [d.id, { displayName: d.name, locationLabel: "", aiEnabled: true, favorite: false }])));
      if (res.devices.length) setStep(3);
    } catch (e) {
      const payload = ringErrorFrom(e) ?? { code: "RING_UNKNOWN" as const, title: "Something went wrong", message: e instanceof Error ? e.message : "Please try again." };
      setError(payload);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const save = async () => {
    if (inFlight.current || selected.size === 0) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const picks: DevicePick[] = [...selected].map((id) => ({ ringDeviceId: id, ...meta[id] }));
      const res = await ringApi.save(picks);
      setSaved(res.saved);
      setStep(4);
      onConnected(res.connected, res.session);
      toast.success("Ring connected", `${res.saved.length} ${res.saved.length === 1 ? "device" : "devices"} added to Matan AI.`);
    } catch (e) {
      const payload = ringErrorFrom(e);
      toast.error(payload?.title ?? "Couldn't save devices", payload?.message);
      if (payload?.code === "RING_NO_SESSION" || payload?.code === "RING_TOKEN_EXPIRED") setStep(1);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const updateMeta = (id: string, patch: Partial<LocalMeta>) => setMeta((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  const selectedDevices = devices.filter((d) => selected.has(d.id));

  const title = step === 4 ? "Ring connected" : step === 3 ? (configuring ? "Configure devices" : "Ring devices found") : "Add a Ring device";
  const description = step === 4 ? "Matan AI found your available Ring devices." : step === 3 ? (configuring ? "Names and locations are local to Matan AI. Ring names stay unchanged." : `We found ${devices.length} ${devices.length === 1 ? "device" : "devices"} available to Matan AI.`) : "Connect Matan AI to your Ring Playground simulation.";

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} icon={step === 4 ? <CircleCheck /> : <Plus />} size="lg" hideClose={busy}>
      <StepIndicator current={step} />

      {/* Step 1: Connect */}
      {step === 1 && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void discover();
          }}
        >
          <div className="card-inset p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-text">Ring Developer Playground</p>
                <p className="mt-0.5 text-[13px] text-text-3">Generate a temporary access token in the Ring Developer Playground.</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-text-3">Token lifetime</p>
                <p className="flex items-center justify-end gap-1 text-[14px] font-semibold text-text">
                  <Clock className="size-3.5 text-warning" /> 30 minutes
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-3" href={RING_PLAYGROUND_URL} rightIcon={<ExternalLink className="size-3.5" />}>
              Open Ring Playground
            </Button>
          </div>
          <RingTokenInput value={token} onChange={setToken} disabled={busy} error={error?.code === "RING_TOKEN_MISSING" ? error.message : null} autoFocus />
          {error && error.code !== "RING_TOKEN_MISSING" && <RingDiscoveryError error={error} onRetry={() => void discover()} />}
          <div className="flex items-start gap-2 rounded-xl border border-border bg-bg/40 p-3 text-[12.5px] text-text-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <p>
              Your token is sent only to the MATAN AI backend for the Ring API request. <span className="text-text-2">Do not commit this token to source control.</span>
            </p>
          </div>
          {canReuseSession && (
            <button type="button" onClick={() => void discover(true)} className="text-[13px] font-semibold text-primary hover:text-primary-2">
              Use the current Playground session instead →
            </button>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!token.trim() || busy} loading={busy} leftIcon={<Sparkles className="size-4" />}>
              Validate & Discover Devices
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Discover */}
      {step === 2 &&
        (busy ? (
          <RingDiscoveryLoading />
        ) : error ? (
          <RingDiscoveryError error={error} onRetry={() => (canReuseSession && !token ? void discover(true) : setStep(1))} onBack={() => setStep(1)} />
        ) : (
          <RingDiscoveryEmpty onRetry={() => void discover(Boolean(session))} onBack={() => setStep(1)} />
        ))}

      {/* Step 3: Select / Configure */}
      {step === 3 && !configuring && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success" role="status">
            <CircleCheck className="size-4" /> Connected · token valid
            {session && <span className="ml-auto text-text-3">expires {new Date(session.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          <RingDeviceSelector devices={devices} selected={selected} onChange={setSelected} />
          {alreadyConnectedIds.some((id) => selected.has(id)) && (
            <p className="text-[12.5px] text-text-3">Some selected devices are already connected - saving will update them.</p>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" leftIcon={<ChevronLeft className="size-4" />} onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={selected.size === 0} onClick={() => setConfiguring(true)}>
                Configure
              </Button>
              <Button disabled={selected.size === 0} loading={busy} onClick={() => void save()} rightIcon={<ChevronRight className="size-4" />}>
                Add Selected Devices
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && configuring && (
        <div className="space-y-4">
          <ul className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            {selectedDevices.map((d) => {
              const m = meta[d.id];
              const Icon = ringKindIcon[d.type];
              return (
                <li key={d.id} className="card-inset p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                      <SafeImage src={d.imageUrl} alt="" sizes="48px" fallbackIcon={<Icon className="size-5" />} className="[&_img]:object-contain [&_img]:p-1" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wide text-text-3">Ring device</p>
                      <p className="truncate text-[15px] font-semibold text-text">{d.name}</p>
                      <p className="text-[12.5px] text-text-3">
                        {d.model ? `Ring ${d.model}` : ringKindLabel[d.type]} · <span className={cn(ringStatusTone(d.status.label) === "success" ? "text-success" : ringStatusTone(d.status.label) === "danger" ? "text-danger" : "")}>{d.status.label}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Matan AI name" htmlFor={`name-${d.id}`}>
                      <Input id={`name-${d.id}`} value={m.displayName} onChange={(e) => updateMeta(d.id, { displayName: e.target.value })} maxLength={60} />
                    </Field>
                    <Field label="Location" htmlFor={`loc-${d.id}`}>
                      <Input id={`loc-${d.id}`} value={m.locationLabel} onChange={(e) => updateMeta(d.id, { locationLabel: e.target.value })} placeholder="e.g. Front Entrance" maxLength={60} />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-5 text-[13.5px] text-text-2">
                    <label className="flex items-center gap-2">
                      <Toggle size="sm" checked={m.aiEnabled} onChange={(v) => updateMeta(d.id, { aiEnabled: v })} label={`Enable Matan AI analysis for ${d.name}`} />
                      Enable Matan AI analysis
                    </label>
                    <label className="flex items-center gap-2">
                      <Toggle size="sm" checked={m.favorite} onChange={(v) => updateMeta(d.id, { favorite: v })} label={`Favorite ${d.name}`} />
                      <Star className="size-3.5 text-warning" /> Favorite
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" leftIcon={<ChevronLeft className="size-4" />} onClick={() => setConfiguring(false)}>
              Back
            </Button>
            <Button loading={busy} onClick={() => void save()} leftIcon={<Check className="size-4" />}>
              Save {selected.size} {selected.size === 1 ? "device" : "devices"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Finish */}
      {step === 4 && (
        <div className="space-y-4" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-4">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-success text-bg">
              <Check className="size-6" />
            </span>
            <div>
              <p className="text-[16px] font-semibold text-text">Ring connected</p>
              <p className="text-[13px] text-text-2">
                Matan AI found {devices.length} Ring {devices.length === 1 ? "device" : "devices"} and connected {saved.length}.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {saved.map((d, i) => {
              const Icon = ringKindIcon[d.deviceType];
              return (
                <li key={d.id} className="card-inset flex items-center gap-3 p-3 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                    <SafeImage src={d.imageUrl} alt="" sizes="40px" fallbackIcon={<Icon className="size-4" />} className="[&_img]:object-contain [&_img]:p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-text">
                      {d.displayName} {d.favorite && <Star className="inline size-3.5 text-warning" />}
                    </p>
                    <p className="flex items-center gap-1 text-[12.5px] text-text-3">
                      {d.locationLabel && (
                        <>
                          <MapPin className="size-3" /> {d.locationLabel} ·{" "}
                        </>
                      )}
                      {d.ringName !== d.displayName && <>Ring name: {d.ringName} · </>}
                      {d.aiEnabled ? "AI analysis on" : "AI analysis off"}
                    </p>
                  </div>
                  <Badge tone={ringStatusTone(d.status)} size="xs" dot>
                    {d.status === "online" ? "Online" : d.status === "offline" ? "Offline" : "Unknown"}
                  </Badge>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { onClose(); router.push("/devices"); }}>
              View Devices
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

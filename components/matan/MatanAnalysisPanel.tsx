"use client";

import * as React from "react";
import { Sparkles, RefreshCw, CircleCheck, TriangleAlert, Eye, Info, Cpu, ImageOff, Image as ImageIcon, Film } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { MatanLoader } from "@/components/matan/MatanLoader";
import { matanApi, matanErrorFrom, type MatanAiErrorPayload } from "@/lib/api/matan";
import type { RingEvent } from "@/lib/types";
import type { AnalysisStatus, MatanPriority } from "@/lib/matan/schema";
import { formatDate, formatTime } from "@/lib/utils/format";
import { eventStage, notificationText, notificationTone, stageView } from "@/lib/matan/event-state";
import { EventTimeline } from "./EventTimeline";
import { CareDecisionBlock } from "./CareDecisionBlock";
import { defaultRules } from "@/lib/matan/rules/defaults";
import { Bell, BellOff, Camera } from "lucide-react";

const priorityTone: Record<MatanPriority, "success" | "warning" | "danger" | "neutral"> = { normal: "success", low: "success", medium: "warning", high: "danger" };
const priorityLabel: Record<MatanPriority, string> = { normal: "Normal", low: "Low", medium: "Medium", high: "High" };
const actionLabel = { none: "No action required", review: "Review recommended", notify: "Notify", email: "Email alert" } as const;

/**
 * MATAN AI panel for Ring events: pending → analyzing → complete | failed.
 * Runs the real pipeline (Bedrock · Nova Pro → Matan Decision) via /api/matan/analyze.
 */
export function MatanAnalysisPanel({ event, onAnalyzed, onReview }: { event: RingEvent; onAnalyzed: (e: RingEvent) => void; onReview?: () => void }) {
  const toast = useToast();
  const serverStage = eventStage(event);
  const [status, setStatus] = React.useState<AnalysisStatus>(serverStage === "complete" ? "complete" : serverStage === "capturing" || serverStage === "analyzing" ? "analyzing" : serverStage === "failed" ? "failed" : "pending");
  const [error, setError] = React.useState<MatanAiErrorPayload | null>(null);
  const [lastRun, setLastRun] = React.useState<{ escalation?: { attempted: boolean; reason: string; applied: boolean }; budget?: { usedPct: number; estimatedUsd: number; videoAllowed: boolean } } | null>(null);
  const [runningMode, setRunningMode] = React.useState<"auto" | "video">("auto");
  const inFlight = React.useRef(false);

  // Follow the server's state (auto-analysis, polling) unless a manual run is in flight here.
  React.useEffect(() => {
    if (inFlight.current) return;
    const st = eventStage(event);
    setStatus(st === "complete" ? "complete" : st === "capturing" || st === "analyzing" ? "analyzing" : st === "failed" ? "failed" : "pending");
    if (st === "failed" && event.analysisError && !error) setError({ code: event.analysisError.code, title: "AI analysis failed", message: "The Ring event was saved, but AI analysis could not be completed." });
    if (st !== "failed") setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, event.intelligence, event.analysis, event.analysisError?.at]);

  const run = async (media: "auto" | "video" = "auto") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunningMode(media);
    setStatus("analyzing");
    setError(null);
    try {
      const res = await matanApi.analyze(event.id, true, media);
      if (!res.success) {
        setStatus("pending");
        toast.info("Not analyzed", "reason" in res ? res.reason : undefined);
        return;
      }
      onAnalyzed(res.event);
      setLastRun({ escalation: res.escalation, budget: res.budget });
      setStatus("complete");
      toast.success("Analyzed with Matan AI", `${res.intelligence.analysis.summary.slice(0, 80)}${res.intelligence.analysis.summary.length > 80 ? "…" : ""}`);
    } catch (e) {
      setError(matanErrorFrom(e) ?? { code: "MATAN_AI_UNAVAILABLE", title: "AI analysis unavailable", message: e instanceof Error ? e.message : "Try again." });
      setStatus("failed");
    } finally {
      inFlight.current = false;
    }
  };

  const intel = event.intelligence;
  const ruleNames = React.useMemo(() => Object.fromEntries(defaultRules().map((r) => [r.id, r.name])), []);

  return (
    <section className={cn("card-inset p-4", status === "complete" && intel?.decision.priority === "high" && "border-danger/40")} aria-live="polite" aria-busy={status === "analyzing"}>
      <div className="flex items-start gap-3">
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border", status === "complete" ? "bg-gradient-to-br from-purple to-primary text-white border-transparent shadow-[0_6px_18px_rgba(154,113,255,0.35)]" : "border-border bg-surface-3/60 text-text-3")}>
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-text-3">Matan AI</p>
            {status === "pending" && <Badge tone="neutral" size="xs" uppercase>Awaiting AI</Badge>}
            {status === "analyzing" && <Badge tone="primary" size="xs" uppercase>Analyzing…</Badge>}
            {status === "complete" && <Badge tone="success" size="xs" uppercase icon={<CircleCheck className="size-3" />}>Analyzed</Badge>}
            {status === "failed" && <Badge tone="danger" size="xs" uppercase icon={<TriangleAlert className="size-3" />}>Unavailable</Badge>}
          </div>

          {/* PENDING */}
          {status === "pending" && (
            <>
              <p className="text-[15px] font-semibold text-text">Awaiting analysis</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">Matan asks Ring for a snapshot from this event&apos;s time window, sends it with the context to Amazon Nova Pro, then applies the Matan Decision Engine. Nothing is claimed until the analysis has actually run.</p>
              {event.ringEventType === "on_demand" && (
                <p className="mt-2 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-[12.5px] text-text-2">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  This is a <span className="font-semibold text-text">live view session</span> (the Playground&apos;s Package / Vehicle / Motion buttons start a stream). Ring records no detections for it, so Matan will try to analyze a <span className="font-semibold text-text">snapshot from the session</span> to see what the camera showed.
                </p>
              )}
              <Button className="mt-3" leftIcon={<Sparkles className="size-4" />} onClick={() => void run()}>
                Analyze with Matan AI
              </Button>
            </>
          )}

          {/* ANALYZING */}
          {status === "analyzing" && (
            <div className="mt-1 flex items-center gap-4">
              {serverStage === "capturing" && !inFlight.current ? (
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><Camera className="size-5 motion-safe:animate-pulse" /></span>
              ) : (
                <MatanLoader size="sm" wordmark={false} messages={false} label="Analyzing with Matan AI" />
              )}
              <div>
                <p className="text-[15px] font-semibold text-text">{serverStage === "capturing" && !inFlight.current ? "Capturing evidence" : "Matan AI analyzing"}</p>
                <p className="text-[13px] text-text-3">{serverStage === "capturing" && !inFlight.current ? "Getting the latest Ring snapshot for the event window…" : !inFlight.current ? "Nova Pro is analyzing the Ring evidence → Matan Decision Engine" : runningMode === "video" ? "Fetching the Ring clip → Nova Pro (video) → Matan Decision Engine" : "Ring snapshot → Nova Pro → Matan Decision Engine (video only if needed)"}</p>
              </div>
            </div>
          )}

          {/* FAILED */}
          {status === "failed" && error && (
            <>
              <p className="text-[15px] font-semibold text-text">Analysis unavailable</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">{error.message}</p>
              <p className="mt-1 text-[12px] text-text-3">The Ring event is saved and unchanged. Code: {error.code}</p>
              <Button className="mt-3" variant="secondary" leftIcon={<RefreshCw className="size-4" />} onClick={() => void run()}>
                Retry
              </Button>
            </>
          )}

          {/* COMPLETE */}
          {status === "complete" && intel && (
            <>
              <p className="text-[17px] font-semibold text-text">{event.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">{intel.analysis.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="primary" size="md">Confidence {Math.round(intel.analysis.confidence * 100)}%</Badge>
                <Badge tone={priorityTone[intel.decision.priority]} size="md" variant="solid" uppercase>Priority {priorityLabel[intel.decision.priority]}</Badge>
                <Badge tone={intel.decision.action === "none" ? "success" : "warning"} size="md">{actionLabel[intel.decision.action]}</Badge>
                {intel.analysis.confidence < 0.55 && <Badge tone="warning" size="md" icon={<Info className="size-3" />}>Low confidence - not escalated</Badge>}
              </div>
              {notificationText(event) && (
                <p className={cn("mt-2 flex items-center gap-1.5 text-[13px]", notificationTone(event) === "success" ? "text-success" : notificationTone(event) === "danger" ? "text-danger" : notificationTone(event) === "primary" ? "text-primary" : "text-text-3")} aria-live="polite">
                  {notificationTone(event) === "success" ? <Bell className="size-3.5" aria-hidden /> : notificationTone(event) === "danger" ? <TriangleAlert className="size-3.5" aria-hidden /> : <BellOff className="size-3.5" aria-hidden />}
                  {notificationText(event)}
                </p>
              )}

              {intel.careDecision && (
                <CareDecisionBlock decision={intel.careDecision} ruleNames={ruleNames} />
              )}
              <div className="mt-3 rounded-xl border border-border bg-bg/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-text-3">Risk assessment (Decision Engine)</p>
                <p className="mt-0.5 text-[13.5px] text-text">{intel.decision.explanation}</p>
                <ul className="mt-2 space-y-1 text-[12.5px] text-text-2">
                  {intel.decision.reasons.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-text-3" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-text-3">Observations</p>
                  <ul className="mt-1 space-y-1 text-[12.5px] text-text-2">
                    {intel.analysis.observations.map((o, i) => (
                      <li key={i} className="flex gap-2">
                        <Eye className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-text-3">Uncertainty</p>
                  <p className="mt-1 text-[12.5px] text-text-2">{intel.analysis.uncertainty ?? "None stated."}</p>
                </div>
              </div>

              {(lastRun?.escalation || intel.usage) && (
                <p className="mt-3 text-[11.5px] text-text-3">
                  {lastRun?.escalation?.applied ? "Escalated to video: " : lastRun?.escalation?.attempted ? "Video escalation attempted (no clip): " : lastRun?.escalation ? "Video not used: " : ""}
                  {lastRun?.escalation?.reason}
                  {intel.usage?.inputTokens ? ` · ${intel.usage.inputTokens.toLocaleString()} in / ${intel.usage.outputTokens?.toLocaleString() ?? 0} out tokens` : ""}
                  {lastRun?.budget ? ` · month ${lastRun.budget.usedPct}% of budget (~$${lastRun.budget.estimatedUsd})` : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11.5px] text-text-3">
                <span className="flex items-center gap-1.5">
                  <Cpu className="size-3.5" /> {intel.model} · {formatDate(intel.analyzedAt)} {formatTime(intel.analyzedAt)}
                  {intel.mediaAnalyzed && intel.mediaSource === "ring-clip" ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-purple/30 bg-purple/10 px-1.5 py-0.5 text-purple" title={intel.mediaNote}><Film className="size-3" /> Ring clip analyzed{intel.escalatedFrom ? ` · escalated from ${intel.escalatedFrom}` : ""}</span>
                  ) : intel.mediaAnalyzed ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-success" title={intel.mediaNote}><ImageIcon className="size-3" /> Ring snapshot analyzed</span>
                  ) : (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5" title={intel.mediaNote}><ImageOff className="size-3" /> context-only analysis</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {intel.decision.priority === "high" && onReview && (
                    <Button size="xs" variant="danger" onClick={onReview}>
                      Review Event
                    </Button>
                  )}
                  {intel.mediaSource !== "ring-clip" && (
                    <button type="button" onClick={() => void run("video")} disabled={lastRun?.budget?.videoAllowed === false} title={lastRun?.budget?.videoAllowed === false ? "Video disabled by the monthly token budget guard" : "Analyze the full Ring clip (≈2–4× the snapshot cost)"} className="inline-flex items-center gap-1 font-medium text-purple hover:text-purple/80 disabled:opacity-50">
                      <Film className="size-3" /> Analyze full clip
                    </button>
                  )}
                  <button type="button" onClick={() => void run()} className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-2">
                    <RefreshCw className="size-3" /> Re-analyze
                  </button>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      {event.source === "ring" && (
        <details className="mt-3 border-t border-border pt-3" open={status !== "complete"}>
          <summary className="cursor-pointer select-none text-[11px] uppercase tracking-wide text-text-3 hover:text-text-2">Processing timeline · {stageView(event).label}</summary>
          <EventTimeline event={event} className="mt-2.5" />
        </details>
      )}
    </section>
  );
}


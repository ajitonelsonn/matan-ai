import type { RingEvent } from "@/lib/types";

/**
 * Pure mapping from a Ring event's server-derived processing fields to what the UI shows.
 * The spec's visual states NEW → CAPTURING → ANALYZING → COMPLETE | FAILED map onto the
 * existing `analysis` field; nothing here re-decides priority (the Decision Engine did).
 */
export type EventStage = "new" | "capturing" | "analyzing" | "complete" | "failed";

export interface StageView {
  stage: EventStage;
  /** Short status label, e.g. "Matan AI analyzing". */
  label: string;
  /** One-line detail under the label. */
  detail: string;
  /** True while the server is working on the event (drives polling + aria-busy). */
  active: boolean;
}

export function eventStage(event: Pick<RingEvent, "analysis" | "intelligence" | "analysisError" | "source">): EventStage {
  if (event.source !== "ring") return "complete";
  if (event.analysis === "capturing") return "capturing";
  if (event.analysis === "analyzing") return "analyzing";
  if (event.analysis === "done" || event.intelligence) return "complete";
  if (event.analysis === "failed" || event.analysisError) return "failed";
  return "new";
}

export function stageView(event: RingEvent): StageView {
  const stage = eventStage(event);
  switch (stage) {
    case "new":
      return { stage, label: "Ring event received", detail: "Matan AI is preparing the event…", active: false };
    case "capturing":
      return { stage, label: "Capturing evidence", detail: "Getting the latest Ring snapshot…", active: true };
    case "analyzing":
      return { stage, label: "Matan AI analyzing", detail: "Nova Pro is analyzing the Ring evidence…", active: true };
    case "complete":
      return { stage, label: "Decision ready", detail: event.intelligence?.decision.explanation ?? event.summary, active: false };
    case "failed":
      return { stage, label: "Analysis unavailable", detail: "We could not complete AI analysis for this event. The Ring event itself is unchanged.", active: false };
  }
}

/** Is the server currently working on this event (capturing or analyzing)? */
export const isProcessing = (event: Pick<RingEvent, "analysis">) => event.analysis === "capturing" || event.analysis === "analyzing";

export type StepState = "pending" | "active" | "complete" | "failed" | "skipped";

export interface TimelineStep {
  key: "received" | "captured" | "analysis" | "decision" | "notification";
  label: string;
  state: StepState;
  /** Real timestamp (ISO) when known - never invented. */
  at?: string;
  note?: string;
}

/** Compact processing timeline: pending → active → complete, with real timestamps only. */
export function timelineSteps(event: RingEvent): TimelineStep[] {
  const stage = eventStage(event);
  const p = event.processing;
  const intel = event.intelligence;
  const n = event.notification;
  const contextOnly = Boolean(intel && !intel.mediaAnalyzed);

  const received: TimelineStep = { key: "received", label: "Ring event received", state: "complete", at: p?.receivedAt ?? event.timestamp };

  const captured: TimelineStep = {
    key: "captured",
    label: "Snapshot captured",
    state: stage === "capturing" ? "active" : p?.capturedAt ? "complete" : stage === "complete" ? (contextOnly ? "skipped" : "complete") : stage === "failed" ? "failed" : "pending",
    at: p?.capturedAt,
    note: stage === "complete" && contextOnly ? intel?.mediaNote ?? "Snapshot unavailable - analyzed from context" : undefined,
  };

  const analysis: TimelineStep = {
    key: "analysis",
    label: "Nova Pro analysis",
    state: stage === "analyzing" ? "active" : stage === "complete" ? "complete" : stage === "failed" ? "failed" : "pending",
    at: p?.analyzedAt,
    note: stage === "failed" ? event.analysisError?.code : intel ? `${intel.model}${intel.mediaSource === "ring-clip" ? " · clip" : intel.mediaAnalyzed ? " · snapshot" : " · context only"}` : undefined,
  };

  const decision: TimelineStep = {
    key: "decision",
    label: "Matan decision",
    state: stage === "complete" ? "complete" : stage === "failed" ? "failed" : "pending",
    at: p?.analyzedAt,
    note: intel ? `${intel.decision.priority.toUpperCase()} · ${actionText(intel.decision.action)}` : undefined,
  };

  const notification: TimelineStep = {
    key: "notification",
    label: "Notification",
    state: stage !== "complete" ? "pending" : n?.status === "sent" ? "complete" : n?.status === "failed" ? "failed" : n?.status === "pending" ? "active" : n?.status === "skipped" ? "skipped" : "pending",
    at: n?.sentAt,
    note: notificationText(event),
  };

  return [received, captured, analysis, decision, notification];
}

function actionText(action: string) {
  return action === "none" ? "no action required" : action === "review" ? "review recommended" : action === "notify" ? "notify" : "email alert";
}

/** Notification status line for cards/panels; null when the step hasn't happened yet. */
export function notificationText(event: RingEvent): string | undefined {
  const n = event.notification;
  if (eventStage(event) !== "complete") return undefined;
  if (!n) return undefined;
  if (n.status === "sent") return `Notification sent${n.provider ? ` via ${n.provider === "smtp" ? "email (SMTP)" : "Amazon SES"}` : ""}`;
  if (n.status === "pending") return "Sending notification…";
  if (n.status === "failed") return "Notification could not be sent";
  if (n.status === "skipped") return n.reason?.startsWith("decision") || n.reason?.includes("alert level") ? "Notification not required" : n.reason?.includes("disabled") || n.reason?.includes("address") ? "Notifications off in Settings" : "Notification not required";
  return undefined;
}

export type NotificationTone = "success" | "danger" | "neutral" | "primary";
export function notificationTone(event: RingEvent): NotificationTone {
  const s = event.notification?.status;
  return s === "sent" ? "success" : s === "failed" ? "danger" : s === "pending" ? "primary" : "neutral";
}

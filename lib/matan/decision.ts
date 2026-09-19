import type { MatanAIAnalysis, MatanDecision, MatanPriority } from "./schema";

/**
 * Matan Decision Engine v1 - deterministic business rules applied AFTER Nova.
 * Nova answers "what appears to be happening"; this answers "how important is
 * it to the user and what should the app do". Model priority/action fields are
 * never consulted.
 */
export interface DecisionContext {
  securityMode: string; // home | away | night | care | business | custom
  quietHours?: boolean; // event occurred inside configured quiet hours
  /** Related recent events (same device/entrance or person/motion type) within the window. */
  relatedRecentCount: number;
  /** Related recent events happened on more than one device. */
  multipleDevices: boolean;
  /** Application automation rule: high priority should email. */
  highPriorityEmailRule?: boolean;
  deviceName: string;
  /** Raw Ring event type (motion | ding | on_demand). */
  ringEventType?: string;
  /** Ring detector labels supplied with the event (person, package, …). */
  detections?: string[];
}

export const LOW_CONFIDENCE = 0.55;

const label: Record<MatanPriority, string> = { normal: "Normal", low: "Low", medium: "Medium", high: "High" };

export function decide(analysis: MatanAIAnalysis, ctx: DecisionContext): MatanDecision {
  const reasons: string[] = [];
  const lowConfidence = analysis.confidence < LOW_CONFIDENCE;
  const night = ctx.securityMode === "night" || ctx.quietHours === true;
  const strict = ctx.securityMode === "away";
  const repeated = ctx.relatedRecentCount >= 2;
  const pct = `${Math.round(analysis.confidence * 100)}%`;

  let priority: MatanPriority = "normal";
  let action: MatanDecision["action"] = "none";

  // A live view session is something a user started - it is not a detection and never needs review by itself.
  if (ctx.ringEventType === "on_demand" && !(ctx.detections?.length)) {
    reasons.push("Ring event type is on_demand: a live view session started by a user, not a detection");
    reasons.push("No detections were reported for this session");
    return { priority: "normal", action: "none", reasons, explanation: `A live view session was started on ${ctx.deviceName}. This is a user action, not a detection - no action is required. To analyze what the camera saw, analyze a frame from the live stream.` };
  }

  switch (analysis.category) {
    case "delivery":
      priority = "low";
      action = "none";
      reasons.push(`AI identified the event as a likely delivery (${pct} confidence)`);
      reasons.push(night ? "Delivery during night monitoring - no escalation rule applies to deliveries" : "No high-priority context was provided");
      break;

    case "doorbell":
      priority = night ? "medium" : "normal";
      action = night ? "notify" : "none";
      reasons.push("Doorbell interaction reported by Ring");
      reasons.push(night ? `Occurred during ${ctx.securityMode === "night" ? "Night Mode" : "quiet hours"}` : "Occurred during normal monitoring");
      break;

    case "vehicle":
      priority = night && repeated ? "medium" : "normal";
      action = night && repeated ? "review" : "none";
      reasons.push(`AI identified vehicle activity (${pct} confidence)`);
      if (night && repeated) reasons.push(`Repeated activity (${ctx.relatedRecentCount} related events) during night monitoring`);
      else reasons.push("No repeated activity in the recent window");
      break;

    case "animal":
      priority = "normal";
      action = "none";
      reasons.push(`AI identified animal activity (${pct} confidence)`);
      reasons.push("Animal activity is not escalated");
      break;

    case "person":
    case "motion":
    case "unusual_activity": {
      const personLike = analysis.category === "person" ? "Person" : analysis.category === "motion" ? "Motion" : "Unusual activity";
      reasons.push(`${personLike} reported near ${ctx.deviceName} (${pct} confidence)`);
      if (night && repeated) {
        priority = "high";
        action = "review";
        reasons.push(`Repeated activity: ${ctx.relatedRecentCount} related events during ${ctx.securityMode === "night" ? "Night Mode" : "quiet hours"}`);
        if (ctx.multipleDevices) reasons.push("Activity spanned multiple monitored locations");
      } else if (strict) {
        priority = "medium";
        action = "notify";
        reasons.push("Away Mode treats any presence as notable");
      } else if (night) {
        priority = "medium";
        action = "review";
        reasons.push(`Single event during ${ctx.securityMode === "night" ? "Night Mode" : "quiet hours"}`);
      } else if (analysis.category === "unusual_activity" && repeated) {
        priority = "medium";
        action = "review";
        reasons.push(`Repeated activity (${ctx.relatedRecentCount} related events)`);
      } else {
        priority = "normal";
        action = "none";
        reasons.push(`${ctx.securityMode.charAt(0).toUpperCase() + ctx.securityMode.slice(1)} Mode with no repeated related events`);
      }
      break;
    }

    case "unknown":
    default:
      priority = "normal";
      action = "review";
      reasons.push("AI could not determine what happened from the available evidence");
      break;
  }

  // Low confidence never escalates automatically.
  if (lowConfidence && (priority === "high" || priority === "medium")) {
    priority = analysis.category === "delivery" ? "low" : "normal";
    action = "review";
    reasons.push(`Confidence is low (${pct}) - escalation withheld; review recommended`);
  } else if (lowConfidence) {
    if (action === "none") action = "review";
    reasons.push(`Confidence is low (${pct}) - review recommended`);
  }

  // Application automation rule: high priority → email, when the user has email alerts enabled (delivered via SES).
  if (priority === "high" && ctx.highPriorityEmailRule) {
    action = "email";
    reasons.push("Automation rule: high priority events are emailed");
  }

  return { priority, action, reasons, explanation: explain(analysis, priority, action, ctx, lowConfidence) };
}

function explain(a: MatanAIAnalysis, priority: MatanPriority, action: MatanDecision["action"], ctx: DecisionContext, lowConfidence: boolean): string {
  const where = ctx.deviceName;
  const actionText = action === "none" ? "No immediate action is required." : action === "review" ? "Review recommended." : action === "notify" ? "You have been notified." : "An email alert will be sent.";
  if (a.category === "delivery") return `Likely delivery at ${where}. ${actionText}`;
  if (priority === "high") return `Repeated activity during night monitoring${ctx.multipleDevices ? " across multiple monitored locations" : ` near ${where}`}. Intent cannot be determined from the available evidence. ${actionText}`;
  if (lowConfidence) return `${a.summary} Confidence is low, so Matan did not escalate. ${actionText}`;
  if (priority === "medium") return `${a.summary} ${label[priority]} priority under ${ctx.securityMode === "night" ? "Night Mode" : ctx.securityMode === "away" ? "Away Mode" : "current monitoring"}. ${actionText}`;
  return `${a.summary} ${actionText}`;
}

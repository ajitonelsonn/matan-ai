import type { RingEvent, SettingsData } from "@/lib/types";
import type { MatanEventIntelligence } from "./schema";

/**
 * Pure notification logic (no AWS, no server-only imports - unit-testable):
 * should this finalized Matan decision email the user, and what does the email say?
 */
export type NotificationKind = "EMAIL";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export type AlertLevel = "high" | "medium" | "low" | "all";

export interface NotificationPrefs {
  enabled: boolean;
  address: string | null;
  level: AlertLevel;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Recipient + enablement from the *user's own* settings (resolved server-side from their partition). */
export function emailPrefs(settings: SettingsData): NotificationPrefs {
  const n = settings.notifications;
  const address = (n.emailAddress ?? "").trim().toLowerCase();
  const level: AlertLevel = n.alertLevel === "low" || n.alertLevel === "medium" || n.alertLevel === "all" ? n.alertLevel : "high";
  return { enabled: Boolean(n.channels?.email), address: EMAIL_RE.test(address) ? address : null, level };
}

export type EmailGate = { send: true } | { send: false; reason: string };

const PRIORITY_RANK: Record<MatanEventIntelligence["decision"]["priority"], number> = { normal: 0, low: 1, medium: 2, high: 3 };
const LEVEL_RANK: Record<AlertLevel, number> = { all: 0, low: 1, medium: 2, high: 3 };

/**
 * Does this finalized decision clear the user's minimum alert level?
 * "low" → low/medium/high are emailed · "medium" → medium/high · "high" → high only ·
 * "all" → every completed analysis, including "normal" (nothing of concern) - for demos/simulator testing.
 * Decision Engine output is reused, never re-derived.
 */
export function meetsAlertLevel(intelligence: MatanEventIntelligence, level: AlertLevel): boolean {
  return PRIORITY_RANK[intelligence.decision.priority] >= LEVEL_RANK[level];
}

/**
 * Reuses the existing Decision Engine output. Default level "high" emails only high-priority
 * decisions; the user can lower the threshold to "medium" or "low" in Settings. Demo/mock events never email.
 */
export function shouldEmail(event: RingEvent, intelligence: MatanEventIntelligence, settings: SettingsData): EmailGate {
  if (event.source !== "ring") return { send: false, reason: "not a Ring event (demo/mock data never emails)" };
  const prefs = emailPrefs(settings);
  if (!prefs.enabled) return { send: false, reason: "email channel disabled in user settings" };
  if (!prefs.address) return { send: false, reason: "no valid notification email address in user settings" };
  const cd = intelligence.careDecision;
  if (cd && "failed" in cd) return { send: false, reason: "rule evaluation failed - not sending without a deterministic decision" };
  if (cd && cd.facts.careEnabled) {
    // Care Context + Smart Rules are authoritative (spec: IGNORE/MONITOR → no notification). Alert level does not apply.
    if (cd.action === "NOTIFY" || cd.action === "ESCALATE") return { send: true };
    return { send: false, reason: `smart rules decided ${cd.action}: ${cd.reason}` };
  }
  // Care Context off (or analysis predates rules): the alert level threshold decides.
  if (prefs.level === "all") return { send: true };
  if (!meetsAlertLevel(intelligence, prefs.level)) return { send: false, reason: `decision (${intelligence.decision.priority}/${intelligence.decision.action}) is below alert level "${prefs.level}"` };
  return { send: true };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dili" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dili" });

/** Inline assets referenced from the HTML via `cid:` (attached by the transport). */
export interface EmailAssets {
  /** CID of the Matan logo attachment. */
  logoCid?: string;
  /** CID of the analyzed snapshot attachment. */
  snapshotCid?: string;
  /** Capture time of the snapshot (ISO) for the timestamp badge. */
  snapshotAt?: string;
  /** Whether a Ring clip exists for the event (enables "View Full Clip"). */
  hasClip?: boolean;
}

const EVENT_ICON: Record<string, string> = { person: "🏃", motion: "🏃", package: "📦", vehicle: "🚗", animal: "🐾", doorbell: "🔔", unusual: "⚠️", other: "👁️" };
const PRIORITY_STYLE: Record<string, string> = {
  high: "background:#fde8e8;color:#b42318",
  medium: "background:#fff4e5;color:#b25e09",
  low: "background:#e8f7ef;color:#0f7a4b",
  normal: "background:#e6f4ff;color:#0a66c2",
};

/**
 * Concise text + branded HTML from existing event/analysis fields.
 * Never includes tokens, credentials or storage URLs; the snapshot travels as an inline attachment.
 */
export function buildEventEmail(event: RingEvent, intelligence: MatanEventIntelligence, appBaseUrl: string, assets: EmailAssets = {}): EmailContent {
  const base = appBaseUrl.replace(/\/$/, "");
  const link = `${base}/events/${encodeURIComponent(event.id)}`;
  const clipLink = `${link}?media=clip`;
  const d = new Date(event.timestamp);
  const dateStr = dateFmt.format(d);
  const timeStr = timeFmt.format(d);
  const time = `${dateStr} at ${timeStr} (Asia/Dili)`;
  const priority = cap(intelligence.decision.priority);
  const cd = intelligence.careDecision && !("failed" in intelligence.careDecision) ? intelligence.careDecision : undefined;
  const urgent = cd ? cd.action === "ESCALATE" : intelligence.decision.priority === "high" || intelligence.decision.action === "email";
  const kicker = urgent ? "Security Alert" : intelligence.decision.priority === "normal" ? "Activity Update" : "Activity Alert";
  const subject = `${urgent ? "Matan AI Alert" : "Matan AI Update"} — ${event.title}`;
  const summary = intelligence.analysis.summary || intelligence.decision.explanation;
  const ruleLine = cd ? `Matan decision: ${cd.action} — ${cd.reason}` : undefined;
  const observations = intelligence.analysis.observations.slice(0, 4);
  const icon = EVENT_ICON[event.type] ?? "👁️";

  const text = [
    `${kicker}: ${event.title}`,
    "Matan AI detected activity at your Ring device.",
    "",
    `Event: ${event.title}`,
    `Device: ${event.location}`,
    `Time: ${time}`,
    `Priority: ${priority}`,
    "",
    "AI Summary:",
    summary,
    ...(ruleLine ? ["", ruleLine] : []),
    ...(observations.length ? ["", "What Matan AI saw:", ...observations.map((o) => `- ${o}`)] : []),
    "",
    `Open Matan AI: ${link}`,
    ...(assets.hasClip ? [`View full clip: ${clipLink}`] : []),
    "",
    "You receive this email because email alerts are enabled in your Matan AI settings.",
  ].join("\n");

  const logo = assets.logoCid ? `<img src="cid:${assets.logoCid}" width="44" height="44" alt="Matan AI" style="display:block;width:44px;height:44px;border-radius:50%">` : `<div style="width:44px;height:44px;border-radius:50%;background:#12a8ff"></div>`;
  const snapshotAt = assets.snapshotAt ? `${new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Dili" }).format(new Date(assets.snapshotAt))} ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Dili" }).format(new Date(assets.snapshotAt))}` : "";
  const snapshot = assets.snapshotCid
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="padding:0">
        <div style="border-radius:16px;overflow:hidden;background:#0b1a33;line-height:0">
          <img src="cid:${assets.snapshotCid}" alt="Snapshot analyzed by Matan AI" width="100%" style="display:block;width:100%;height:auto;max-height:420px;object-fit:cover">
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px"><tr>
          <td style="font-size:12px;color:#5b6b82;font-family:Inter,Segoe UI,Arial,sans-serif">${snapshotAt ? `📷 ${esc(snapshotAt)} · ` : ""}${esc(event.location)}</td>
          <td align="right" style="font-size:12px;color:#5b6b82;font-family:Inter,Segoe UI,Arial,sans-serif">Snapshot Matan AI analyzed</td>
        </tr></table>
      </td></tr></table>`
    : `<div style="border-radius:16px;background:linear-gradient(135deg,#0b1a33,#12315c);padding:36px 20px;text-align:center;color:#9fb3cc;font-size:13px;font-family:Inter,Segoe UI,Arial,sans-serif">No snapshot was available for this event - analyzed from event context.</div>`;

  const infoCard = (emoji: string, label: string, value: string, sub = "") => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:#f4f7fb;border-radius:14px;margin-bottom:10px"><tr>
      <td width="52" valign="top" style="padding:12px 0 12px 12px"><div style="width:40px;height:40px;border-radius:12px;background:#e6f4ff;text-align:center;line-height:40px;font-size:20px">${emoji}</div></td>
      <td valign="top" style="padding:12px 12px 12px 10px;font-family:Inter,Segoe UI,Arial,sans-serif">
        <div style="font-size:12px;color:#5b6b82">${esc(label)}</div>
        <div style="font-size:14.5px;font-weight:700;color:#0b1a33;margin-top:2px">${value}</div>
        ${sub ? `<div style="font-size:12px;color:#5b6b82;margin-top:2px">${esc(sub)}</div>` : ""}
      </td></tr></table>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(3,19,38,0.12)">

  <!-- Header -->
  <tr><td style="background:#0b2a4a;background-image:linear-gradient(90deg,#071a33 0%,#0d3a66 60%,#0b2a4a 100%);padding:22px 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="52" valign="middle">${logo}</td>
      <td valign="middle" style="padding-left:12px;font-family:Inter,Segoe UI,Arial,sans-serif">
        <div style="font-size:22px;font-weight:800;letter-spacing:.14em;color:#ffffff">MATAN AI</div>
        <div style="font-size:11px;letter-spacing:.18em;color:#5ec8ff;margin-top:2px">SEE A SAFER TOMORROW</div>
      </td>
      <td align="right" valign="middle" style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:15px;color:#ffffff;line-height:1.3">AI for Safer<br>Communities</td>
    </tr></table>
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:26px 28px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="72" valign="top"><div style="width:64px;height:64px;border-radius:50%;background:#e6f4ff;text-align:center;line-height:64px;font-size:30px">${urgent ? "🔔" : icon}</div></td>
      <td valign="top" style="padding-left:14px;font-family:Inter,Segoe UI,Arial,sans-serif">
        <div style="font-size:15px;font-weight:700;color:#0a66c2">${esc(kicker)}</div>
        <div style="font-size:30px;font-weight:800;color:#0b1a33;line-height:1.15;margin-top:2px">${esc(event.title)}</div>
        <div style="font-size:15px;color:#5b6b82;margin-top:6px">Matan AI detected activity at your Ring device.</div>
      </td>
      <td width="190" valign="top" align="right">
        <div style="display:inline-block;background:#f4f7fb;border-radius:14px;padding:12px 14px;text-align:left;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:13.5px;color:#0b1a33;line-height:1.45">🕒 ${esc(dateStr)}<br><span style="color:#5b6b82">${esc(timeStr)} (Asia/Dili)</span></div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Snapshot + facts -->
  <tr><td style="padding:16px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="62%" valign="top" style="padding-right:14px">${snapshot}</td>
      <td valign="top">
        ${infoCard("📹", "Device", esc(event.location))}
        ${infoCard(icon, "Event", esc(event.title))}
        ${infoCard("📅", "Time", `${esc(dateStr)} at ${esc(timeStr)}`, "(Asia/Dili)")}
        ${infoCard("🚩", "Priority", `<span style="display:inline-block;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:700;${PRIORITY_STYLE[intelligence.decision.priority] ?? PRIORITY_STYLE.normal}">${esc(priority)}</span>`)}
      </td>
    </tr></table>
  </td></tr>

  <!-- AI section -->
  <tr><td style="padding:18px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;border-radius:16px"><tr>
      <td valign="top" style="padding:18px 20px;font-family:Inter,Segoe UI,Arial,sans-serif;border-right:1px solid #e3e9f2">
        <div style="font-size:16px;font-weight:700;color:#0a66c2">✨ What Matan AI saw</div>
        ${observations.length ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:14px;line-height:1.7;color:#0b1a33">${observations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : `<div style="margin-top:10px;font-size:14px;color:#5b6b82">${esc(intelligence.decision.explanation)}</div>`}
      </td>
      <td width="38%" valign="top" style="padding:18px 20px;font-family:Inter,Segoe UI,Arial,sans-serif">
        <div style="font-size:15px;font-weight:700;color:#0a66c2">💡 AI Summary</div>
        <div style="margin-top:10px;background:#e6f4ff;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;color:#0b1a33">${esc(summary)}</div>
        ${ruleLine ? `<div style="margin-top:10px;font-size:12.5px;line-height:1.5;color:#5b6b82"><b style="color:#0b1a33">Matan decision: ${esc(cd!.action)}</b><br>${esc(cd!.reason)}</div>` : ""}
      </td>
    </tr></table>
  </td></tr>

  <!-- Buttons -->
  <tr><td align="center" style="padding:24px 28px 8px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:0 6px"><a href="${esc(link)}" style="display:inline-block;background:#12a8ff;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:12px;font-family:Inter,Segoe UI,Arial,sans-serif;box-shadow:0 8px 22px rgba(18,168,255,0.35)">↗ Open Matan AI</a></td>
      ${assets.hasClip ? `<td style="padding:0 6px"><a href="${esc(clipLink)}" style="display:inline-block;background:#ffffff;color:#0a66c2;text-decoration:none;font-weight:700;font-size:16px;padding:13px 30px;border-radius:12px;border:2px solid #12a8ff;font-family:Inter,Segoe UI,Arial,sans-serif">▶ View Full Clip</a></td>` : ""}
    </tr></table>
    <div style="margin-top:12px;font-size:13px;color:#5b6b82;font-family:Inter,Segoe UI,Arial,sans-serif">Review live footage, adjust settings, or manage your devices in Matan AI.</div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:18px 28px 24px">
    <div style="border-top:1px solid #e3e9f2;margin-bottom:18px"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="52" valign="middle">${logo}</td>
      <td valign="middle" style="padding-left:12px;font-family:Inter,Segoe UI,Arial,sans-serif;border-right:1px solid #e3e9f2">
        <div style="font-size:18px;font-weight:800;letter-spacing:.12em;color:#0b1a33">MATAN AI</div>
        <div style="font-size:10.5px;letter-spacing:.16em;color:#0a66c2">SEE A SAFER TOMORROW</div>
      </td>
      <td valign="middle" style="padding-left:18px;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:13.5px;color:#0b1a33;line-height:1.4">Smarter Monitoring<br>for a Safer Timor-Leste 🇹🇱</td>
    </tr></table>
    <div style="margin-top:18px;text-align:center;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:11.5px;color:#7a8799;line-height:1.6">You receive this email because email alerts are enabled in your Matan AI settings.<br>© ${new Date().getFullYear()} Matan AI. All rights reserved.</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}

/* ---- Orchestration with injected side effects (so the flow is unit-testable) --- */

export interface NotificationRecord {
  status: "pending" | "sent" | "failed";
  messageId?: string;
  sentAt?: string;
  code?: string;
  to?: string;
  /** Which transport delivered it (ses | smtp). */
  provider?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
  /** Content-ID for inline images (referenced as cid:… in the HTML). */
  cid: string;
}

export interface NotificationMedia {
  logo?: { bytes: Uint8Array; contentType: string };
  snapshot?: { bytes: Uint8Array; contentType: string; capturedAt?: string };
  hasClip?: boolean;
}

export interface NotificationDeps {
  settings: () => SettingsData;
  appBaseUrl: string;
  /** Inline assets for the email (logo, analyzed snapshot). Optional; failures fall back to a text-only layout. */
  media?: (eventId: string) => Promise<NotificationMedia>;
  /** Idempotency store keyed by event + kind (backed by DynamoDB NOTIFICATION#{eventId}#{kind}). */
  read: (eventId: string, kind: NotificationKind) => Promise<NotificationRecord | null>;
  /** Create-if-absent; returns false when a record already exists (another sync got there first). */
  claim: (eventId: string, kind: NotificationKind, record: NotificationRecord) => Promise<boolean>;
  write: (eventId: string, kind: NotificationKind, record: NotificationRecord) => Promise<void>;
  send: (n: { to: string; subject: string; text: string; html?: string; attachments?: EmailAttachment[] }) => Promise<{ messageId: string; provider?: string }>;
  log?: (entry: Record<string, unknown>) => void;
}

export type NotificationOutcome = { status: "sent"; messageId: string; provider?: string } | { status: "skipped"; reason: string } | { status: "duplicate" } | { status: "failed"; code: string };

/**
 * Finalized decision → (gate) → idempotency claim → SES. Never throws: SES/DB failures
 * are logged safely and reported, so Ring sync and analysis are never affected.
 */
export async function notifyByEmail(event: RingEvent, intelligence: MatanEventIntelligence, deps: NotificationDeps): Promise<NotificationOutcome> {
  const log = deps.log ?? (() => {});
  try {
    const gate = shouldEmail(event, intelligence, deps.settings());
    if (!gate.send) return { status: "skipped", reason: gate.reason };
    const to = emailPrefs(deps.settings()).address!;

    const existing = await deps.read(event.id, "EMAIL");
    if (existing?.status === "sent" || existing?.status === "pending") return { status: "duplicate" };
    if (!existing) {
      const claimed = await deps.claim(event.id, "EMAIL", { status: "pending" });
      if (!claimed) return { status: "duplicate" };
    } else {
      await deps.write(event.id, "EMAIL", { status: "pending" }); // previous attempt failed → retry
    }

    let media: NotificationMedia = {};
    try {
      media = (await deps.media?.(event.id)) ?? {};
    } catch {
      /* email still goes out without inline media */
    }
    const attachments: EmailAttachment[] = [];
    const assets: Parameters<typeof buildEventEmail>[3] = { hasClip: media.hasClip };
    if (media.logo) {
      attachments.push({ filename: "matan-ai-logo.png", content: media.logo.bytes, contentType: media.logo.contentType, cid: "matan-logo" });
      assets.logoCid = "matan-logo";
    }
    if (media.snapshot) {
      attachments.push({ filename: `snapshot-${event.id}.jpg`, content: media.snapshot.bytes, contentType: media.snapshot.contentType, cid: "matan-snapshot" });
      assets.snapshotCid = "matan-snapshot";
      assets.snapshotAt = media.snapshot.capturedAt;
    }
    const content = buildEventEmail(event, intelligence, deps.appBaseUrl, assets);
    try {
      const { messageId, provider } = await deps.send({ to, ...content, attachments: attachments.length ? attachments : undefined });
      await deps.write(event.id, "EMAIL", { status: "sent", messageId, sentAt: new Date().toISOString(), to, provider });
      log({ event: "email_notification_sent", eventId: event.id, messageId, provider });
      return provider ? { status: "sent", messageId, provider } : { status: "sent", messageId };
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "SES_ERROR";
      await deps.write(event.id, "EMAIL", { status: "failed", code, to }).catch(() => undefined);
      log({ event: "email_notification_failed", eventId: event.id, code });
      return { status: "failed", code };
    }
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "NOTIFICATION_ERROR";
    log({ event: "email_notification_failed", eventId: event.id, code });
    return { status: "failed", code };
  }
}

/* ---- Daily report (Home → Send Report) --------------------------------------- */

export interface ReportSummary {
  dateLabel: string;
  total: number;
  byType: { label: string; count: number }[];
  decisions: { ESCALATE: number; NOTIFY: number; MONITOR: number; IGNORE: number };
  highlights: { title: string; time: string; device: string; action?: string; summary?: string }[];
}

/** Summarize today's Ring events (already analyzed ones carry decisions) in the given timezone. */
export function summarizeDay(events: RingEvent[], now: Date, timezone: string): ReportSummary {
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).format(d);
  const today = dayKey(now);
  const todays = events.filter((e) => dayKey(new Date(e.timestamp)) === today).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const counts = new Map<string, number>();
  const decisions = { ESCALATE: 0, NOTIFY: 0, MONITOR: 0, IGNORE: 0 };
  for (const e of todays) {
    const cat = e.intelligence?.analysis.category ?? e.type;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
    const cd = e.intelligence?.careDecision;
    if (cd && !("failed" in cd)) decisions[cd.action] += 1;
  }
  const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone });
  const rank = { ESCALATE: 0, NOTIFY: 1, MONITOR: 2, IGNORE: 3 } as const;
  const highlights = [...todays]
    .sort((a, b) => {
      const ca = a.intelligence?.careDecision, cb = b.intelligence?.careDecision;
      const ra = ca && !("failed" in ca) ? rank[ca.action] : 4, rb = cb && !("failed" in cb) ? rank[cb.action] : 4;
      return ra - rb || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })
    .slice(0, 6)
    .map((e) => { const cd = e.intelligence?.careDecision; return { title: e.title, time: timeFmt.format(new Date(e.timestamp)), device: e.location, action: cd && !("failed" in cd) ? cd.action : undefined, summary: e.intelligence?.analysis.summary }; });
  return {
    dateLabel: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: timezone }).format(now),
    total: todays.length,
    byType: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k.replace(/_/g, " "), count: v })),
    decisions,
    highlights,
  };
}

export function buildReportEmail(r: ReportSummary, appBaseUrl: string, assets: EmailAssets = {}): EmailContent {
  const base = appBaseUrl.replace(/\/$/, "");
  const subject = `Matan AI Daily Report — ${r.dateLabel}`;
  const text = [
    `Matan AI daily report for ${r.dateLabel}`,
    "",
    `Ring events today: ${r.total}`,
    ...r.byType.map((t) => `- ${t.label}: ${t.count}`),
    "",
    `Decisions: ${r.decisions.ESCALATE} escalate · ${r.decisions.NOTIFY} notify · ${r.decisions.MONITOR} monitor · ${r.decisions.IGNORE} ignore`,
    "",
    ...(r.highlights.length ? ["Highlights:", ...r.highlights.map((h) => `- ${h.time} ${h.title} (${h.device})${h.action ? ` — ${h.action}` : ""}${h.summary ? `: ${h.summary}` : ""}`)] : ["No events recorded today."]),
    "",
    `Open Matan AI: ${base}/events`,
  ].join("\n");
  const logo = assets.logoCid ? `<img src="cid:${assets.logoCid}" width="44" height="44" alt="Matan AI" style="display:block;width:44px;height:44px;border-radius:50%">` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#eef2f7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b1a33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:18px;overflow:hidden">
  <tr><td style="background:#0b2a4a;background-image:linear-gradient(90deg,#071a33,#0d3a66);padding:22px 28px;color:#fff"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${logo}</td><td style="padding-left:12px"><div style="font-size:20px;font-weight:800;letter-spacing:.14em">MATAN AI</div><div style="font-size:11px;letter-spacing:.18em;color:#5ec8ff">DAILY REPORT</div></td></tr></table></td></tr>
  <tr><td style="padding:24px 28px 8px"><div style="font-size:24px;font-weight:800">${esc(r.dateLabel)}</div><div style="margin-top:4px;color:#5b6b82">Summary of your Ring events and Matan decisions.</div></td></tr>
  <tr><td style="padding:12px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${[["Events", String(r.total)], ["Escalate", String(r.decisions.ESCALATE)], ["Notify", String(r.decisions.NOTIFY)], ["Monitor", String(r.decisions.MONITOR)]].map(([l, v]) => `<td style="padding:4px"><div style="background:#f4f7fb;border-radius:14px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800">${v}</div><div style="font-size:12px;color:#5b6b82">${l}</div></div></td>`).join("")}
  </tr></table></td></tr>
  <tr><td style="padding:8px 28px"><div style="font-size:13px;color:#5b6b82;font-weight:600">By type</div><div style="margin-top:6px;font-size:14px">${r.byType.length ? r.byType.map((t) => `${esc(t.label)} <b>${t.count}</b>`).join(" · ") : "No events today."}</div></td></tr>
  <tr><td style="padding:12px 28px 4px"><div style="font-size:13px;color:#5b6b82;font-weight:600">Highlights</div>
    ${r.highlights.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;font-size:14px">${r.highlights.map((h) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e3e9f2"><b>${esc(h.time)}</b> · ${esc(h.title)} <span style="color:#5b6b82">(${esc(h.device)})</span>${h.action ? ` <span style="display:inline-block;padding:1px 8px;border-radius:999px;background:${h.action === "ESCALATE" ? "#fde8e8;color:#b42318" : h.action === "NOTIFY" ? "#fff4e5;color:#b25e09" : "#e6f4ff;color:#0a66c2"};font-size:11px;font-weight:700">${esc(h.action)}</span>` : ""}${h.summary ? `<div style="color:#5b6b82;font-size:13px;margin-top:2px">${esc(h.summary)}</div>` : ""}</td></tr>`).join("")}</table>` : `<div style="margin-top:6px;font-size:14px;color:#5b6b82">No events recorded today.</div>`}
  </td></tr>
  <tr><td align="center" style="padding:20px 28px 26px"><a href="${esc(base)}/events" style="display:inline-block;background:#12a8ff;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 26px;border-radius:12px">Open Matan AI</a><div style="margin-top:14px;font-size:11.5px;color:#7a8799">Sent on request from the Matan AI dashboard.</div></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

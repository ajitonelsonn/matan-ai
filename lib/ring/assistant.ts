import "server-only";
import type { AssistantMessage, EventCounts, RingEvent } from "@/lib/types";
import type { ConnectedRingDevice } from "./types";
import { getRingEvents } from "./overview";
import { listConnected } from "./session";
import { countEvents, eventsInRange } from "@/lib/mock/insights";
import { RING_PLAYGROUND_URL } from "./constants";
import { generateTextWithNova } from "@/lib/bedrock/nova";
import { MatanAiError } from "@/lib/matan/errors";
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantContext, buildAssistantPrompt, parseAssistantReply } from "@/lib/matan/assistant-context";
import { getCareContext, listRules } from "@/lib/matan/rules/store";
import { getUserSettings } from "@/lib/matan/user-settings";
import { emailPrefs } from "@/lib/matan/notification-email";
import { TIME_ZONE } from "@/lib/mock/clock";

/**
 * Real Mode assistant. Amazon Nova answers from a grounding context built ONLY from the
 * signed-in user's Ring devices, Ring event history, Matan analyses/decisions/notifications,
 * Care Context and Smart Rules. If Bedrock is unavailable the reply falls back to the
 * deterministic facts (counts, devices, latest events) and says so.
 */
export async function answerRing(question: string, now: string, history: AssistantMessage[] = []): Promise<Omit<AssistantMessage, "id" | "role">> {
  const { events, session } = await getRingEvents();
  const devices = listConnected();
  const online = devices.filter((d) => d.status === "online").length;
  const today = eventsInRange(events, "today");
  const tc = countEvents(today);
  const base = { timestamp: now };
  const live = session && (session.status === "valid" || session.status === "expiring");
  const alertsToday = today.filter((e) => e.notification?.status === "sent").length;

  if (!devices.length) {
    return { ...base, content: "No Ring devices are connected yet. Connect the Ring Developer Playground and discover the simulator device, then ask me again.", banner: { tone: "warning", title: "No Ring devices connected", subtitle: "Real Mode uses only Ring-backed data" }, suggestions: ["Which devices are online?"] };
  }

  const chips: AssistantMessage["chips"] = [
    { label: "Today", value: tc.total, icon: "CalendarDays", tone: "primary" },
    { label: "Alerts sent today", value: alertsToday, icon: "Bell", tone: alertsToday ? "warning" : "success" },
    { label: "Devices online", value: `${online}/${devices.length}`, icon: "ShieldCheck", tone: online === devices.length ? "success" : "danger" },
  ];
  const sessionBanner: AssistantMessage["banner"] | undefined = live ? undefined : { tone: "warning", title: "Ring session expired", subtitle: "Answers use the last synced history until you reconnect the Playground" };

  const care = getCareContext();
  const settings = getUserSettings();
  const prefs = emailPrefs(settings);
  const ctx = buildAssistantContext({
    now,
    timezone: care?.timezone ?? TIME_ZONE,
    devices: devices.map((d) => ({ name: d.displayName, model: d.model, status: d.status, capabilities: d.capabilities })),
    events,
    session: session ? { status: session.status, expiresAt: session.expiresAt } : null,
    care: care ? { enabled: care.enabled, quietHours: care.quietHours, sensitivity: care.sensitivity } : null,
    rules: listRules().map((r) => ({ name: r.name, enabled: r.enabled, action: r.action.type })),
    alerts: { emailConfigured: Boolean(prefs.enabled && prefs.address), level: prefs.level },
  });

  const started = Date.now();
  try {
    const res = await generateTextWithNova(ASSISTANT_SYSTEM_PROMPT, buildAssistantPrompt(ctx, history, question), { maxTokens: 500, temperature: 0.2 });
    const parsed = parseAssistantReply(res.text, new Set(events.map((e) => e.id)));
    console.info({ event: "matan_assistant_answer", model: res.model, latencyMs: Date.now() - started, usage: res.usage, related: parsed.relatedEventIds.length });
    return {
      ...base,
      content: parsed.answer,
      chips,
      highlights: parsed.highlights.length ? parsed.highlights : undefined,
      relatedEventIds: parsed.relatedEventIds.length ? parsed.relatedEventIds : undefined,
      banner: sessionBanner,
      suggestions: ["What happened today?", "Which alerts did you send me?", "Which devices are online?", "What did the last package event show?"],
    };
  } catch (e) {
    const code = e instanceof MatanAiError ? e.code : "MATAN_AI_UNAVAILABLE";
    console.error({ event: "matan_assistant_fallback", code });
    return { ...base, ...fallbackAnswer(question, events, devices, online, tc, now), chips, banner: { tone: "danger", title: "Matan AI is unavailable right now", subtitle: `${code.replace("MATAN_AI_", "").replace(/_/g, " ").toLowerCase()} - showing facts from your Ring history instead` } };
  }
}

/** Deterministic facts when Nova cannot be reached - never pretends to be AI reasoning. */
function fallbackAnswer(question: string, events: RingEvent[], devices: ConnectedRingDevice[], online: number, tc: EventCounts, now: string): Pick<AssistantMessage, "content" | "highlights" | "relatedEventIds" | "suggestions"> {
  void now;
  const q = question.toLowerCase();
  const analyzed = events.filter((e) => e.analysis === "done").length;
  if (/(device|online|camera|offline)/.test(q)) {
    return { content: `${online} of ${devices.length} connected Ring ${devices.length === 1 ? "device is" : "devices are"} online. ${devices.map((d) => `${d.displayName}: ${d.status}${d.model ? ` · Ring ${d.model}` : ""}`).join("; ")}.`, suggestions: ["What happened today?"] };
  }
  const recent = events.slice(0, 3);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
  return {
    content: `Today Ring recorded ${tc.total} ${tc.total === 1 ? "event" : "events"} across ${devices.length} connected ${devices.length === 1 ? "device" : "devices"}; ${events.length} events are on record and ${analyzed} of them have a Matan AI analysis. ${events.length ? "Here are the latest:" : `No events yet - trigger a simulation in the Playground (${RING_PLAYGROUND_URL}).`}`,
    highlights: recent.map((e) => `${fmt.format(new Date(e.timestamp))} - ${e.title} on ${e.location}${e.intelligence?.analysis?.summary ? `: ${e.intelligence.analysis.summary.slice(0, 90)}` : ""}`),
    relatedEventIds: recent.map((e) => e.id),
    suggestions: ["Which devices are online?", "What happened today?"],
  };
}

import "server-only";
import type { AssistantMessage } from "@/lib/types";
import { getRingEvents } from "./overview";
import { listConnected } from "./session";
import { countEvents, eventsInRange } from "@/lib/mock/insights";
import { formatTime, relativeDay } from "@/lib/utils/format";
import { RING_PLAYGROUND_URL } from "./constants";

/**
 * Real-mode assistant. Answers are computed ONLY from connected Ring devices and
 * Ring event history. It never invents analysis: un-analysed events are reported
 * as "awaiting Matan AI analysis".
 */
export async function answerRing(question: string, now: string): Promise<Omit<AssistantMessage, "id" | "role">> {
  const q = question.toLowerCase();
  const has = (...w: string[]) => w.some((x) => q.includes(x));
  const { events, session } = await getRingEvents();
  const devices = listConnected();
  const online = devices.filter((d) => d.status === "online").length;
  const today = eventsInRange(events, "today");
  const tc = countEvents(today);
  const base = { timestamp: now };
  const live = session && (session.status === "valid" || session.status === "expiring");

  if (!devices.length) {
    return { ...base, content: "No Ring devices are connected yet. Connect the Ring Developer Playground and discover the simulator device, then ask me again.", banner: { tone: "warning", title: "No Ring devices connected", subtitle: "Real Mode uses only Ring-backed data" }, suggestions: ["Which devices are online?"] };
  }

  if (has("device", "online", "camera", "offline")) {
    return {
      ...base,
      content: `${online} of ${devices.length} connected Ring ${devices.length === 1 ? "device is" : "devices are"} online${live ? "" : " (last known - the Playground session has expired)"}. ${devices.map((d) => `${d.displayName}: ${d.status}${d.model ? ` · Ring ${d.model}` : ""}`).join("; ")}.`,
      chips: devices.slice(0, 5).map((d) => ({ label: d.displayName, value: d.status === "online" ? "Online" : d.status === "offline" ? "Offline" : "Unknown", icon: "Video", tone: d.status === "online" ? "success" : "danger" })),
      suggestions: ["What happened today?", "How many deliveries happened?"],
    };
  }

  if (has("deliver", "package")) {
    const pk = events.filter((e) => e.type === "package");
    return {
      ...base,
      content: pk.length
        ? `Ring reported ${pk.length} package ${pk.length === 1 ? "detection" : "detections"} in its history. Matan AI has not classified them yet, so I can't confirm deliveries versus pickups.`
        : "Ring hasn't reported any package detections yet. Trigger a Package simulation in the Playground and I'll pick it up on the next refresh.",
      relatedEventIds: pk.slice(0, 2).map((e) => e.id),
      suggestions: ["What happened today?", "Show unusual activity."],
    };
  }

  if (has("unusual", "alert", "why did i", "suspicious")) {
    return {
      ...base,
      content: `I haven't flagged anything - and I won't until the Matan AI analysis pipeline has actually processed your Ring events. Right now ${events.length} Ring ${events.length === 1 ? "event is" : "events are"} awaiting analysis. No alerts were sent in Real Mode.`,
      banner: { tone: "primary", title: "No alerts sent", subtitle: `${events.length} Ring events awaiting Matan AI analysis` },
      suggestions: ["What happened today?", "Which devices are online?"],
    };
  }

  if (has("away", "while i was")) {
    const recent = events.slice(0, 3);
    return {
      ...base,
      content: recent.length ? `Here are the latest Ring events on record. Priority classification is pending Matan AI analysis.` : "Ring has no events on record yet.",
      highlights: recent.map((e) => `${relativeDay(e.timestamp, now)} ${formatTime(e.timestamp)} - ${e.title} on ${e.location}`),
      relatedEventIds: recent.map((e) => e.id),
      suggestions: ["Which devices are online?", "How many deliveries happened?"],
    };
  }

  // default: today's summary from Ring history
  return {
    ...base,
    content: `Today Ring recorded ${tc.total} ${tc.total === 1 ? "event" : "events"} across ${devices.length} connected ${devices.length === 1 ? "device" : "devices"}. ${events.length ? `${events.length} events total are on record, all awaiting Matan AI analysis.` : `No events yet - trigger a simulation in the Playground (${RING_PLAYGROUND_URL}).`}`,
    chips: [
      { label: "Today", value: tc.total, icon: "CalendarDays", tone: "primary" },
      { label: "Motion", value: today.filter((e) => e.ringEventType === "motion").length, icon: "Activity", tone: "warning" },
      { label: "Doorbell", value: tc.byType.doorbell, icon: "Bell", tone: "success" },
      { label: "Live views", value: today.filter((e) => e.ringEventType === "on_demand").length, icon: "Video", tone: "purple" },
      { label: "Devices online", value: `${online}/${devices.length}`, icon: "ShieldCheck", tone: online === devices.length ? "success" : "danger" },
    ],
    banner: { tone: "primary", title: "Ring Simulator data only", subtitle: "Matan AI analysis of Ring events starts with the Bedrock milestone" },
    relatedEventIds: today.slice(0, 2).map((e) => e.id),
    suggestions: ["Which devices are online?", "How many deliveries happened?", "Show unusual activity."],
  };
}

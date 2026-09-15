import type { AssistantMessage, RingEvent } from "@/lib/types";
import type { MockState } from "./store";
import { countEvents, eventsInRange } from "./insights";
import { formatTime, relativeDay } from "@/lib/utils/format";

/**
 * Deterministic, keyword-driven assistant. Answers are computed from the
 * current mock store so they stay consistent with every other page.
 */
export function answer(question: string, state: MockState, now: string): Omit<AssistantMessage, "id" | "role"> {
  const q = question.toLowerCase();
  const today = eventsInRange(state.events, "today");
  const week = eventsInRange(state.events, "7d");
  const tc = countEvents(today);
  const wc = countEvents(week);
  const activeMode = state.securityModes.find((m) => m.id === state.activeModeId)!;
  const online = state.devices.filter((d) => d.status === "online").length;
  const important = today.filter((e) => e.priority === "important");
  const attention = today.filter((e) => e.priority === "attention");
  const base = { timestamp: now };

  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("weekly report", "create a report", "generate report", "daily report", "report")) {
    return {
      ...base,
      content: `Done - I generated a ${q.includes("daily") ? "daily" : "weekly"} report covering ${wc.total} events and emailed it to ${"ajito@example.com"}. It includes deliveries, visitors, unusual activity and device health.`,
      banner: { tone: "primary", title: "Report generated", subtitle: `${q.includes("daily") ? "Daily" : "Weekly"} Summary - Sep 2026` },
      highlights: [
        `${wc.byType.package} deliveries this week`,
        `${wc.important} important and ${wc.attention} attention events`,
        `${online}/${state.devices.length} devices online`,
      ],
      suggestions: ["Summarize this week", "Show unusual activity"],
    };
  }

  if (has("deliver", "package")) {
    const deliveries = week.filter((e) => e.type === "package");
    const unattended = deliveries.filter((e) => e.priority === "attention");
    return {
      ...base,
      content: `You had ${deliveries.length} ${deliveries.length === 1 ? "delivery" : "deliveries"} in the last 7 days. ${
        unattended.length ? `${unattended.length} ${unattended.length === 1 ? "package was" : "packages were"} left at the door for more than 2 hours.` : "All packages were collected promptly."
      } The most recent one arrived at the Front Door ${relativeDay(deliveries[0]?.timestamp ?? now, now).toLowerCase()} at ${formatTime(deliveries[0]?.timestamp ?? now)}.`,
      chips: [
        { label: "This week", value: deliveries.length, icon: "Package", tone: "success" },
        { label: "Today", value: tc.byType.package, icon: "CalendarDays", tone: "primary" },
        { label: "Unattended", value: unattended.length, icon: "Clock", tone: "warning" },
      ],
      relatedEventIds: deliveries.slice(0, 2).map((e) => e.id),
      suggestions: ["Notify me if a package is left for 2 hours", "Show delivery events"],
    };
  }

  if (has("unusual", "alert", "why did you", "suspicious", "strange")) {
    const target = important[0] ?? week.find((e) => e.priority === "important");
    if (!target) {
      return {
        ...base,
        content: "I haven't flagged anything unusual recently. Everything has matched your home's normal routine.",
        banner: { tone: "success", title: "No unusual activity", subtitle: "Nothing needs your review" },
      };
    }
    return {
      ...base,
      content: `I sent you an alert because of an ${target.title.toLowerCase()} at the ${target.location} at ${formatTime(target.timestamp)} ${relativeDay(target.timestamp, now).toLowerCase()}. ${target.aiAssessment ?? target.summary}`,
      banner: {
        tone: "danger",
        title: `${important.length || 1} important event needs your review`,
        subtitle: `${target.title} - ${target.location}, ${formatTime(target.timestamp)}`,
      },
      relatedEventIds: [target.id, ...attention.slice(0, 1).map((e) => e.id)],
      suggestions: ["Is my home safe now?", "Enable Night Mode lights automation", "Show me the clip"],
    };
  }

  if (has("safe", "protected", "secure", "status")) {
    return {
      ...base,
      content: `Yes. ${online} of ${state.devices.length} devices are online, ${activeMode.name} is active, and ${
        important.length ? `the ${important.length} important event from earlier has been flagged for your review, but there is no ongoing activity.` : "there is no ongoing activity that needs your attention."
      }`,
      banner: {
        tone: important.length ? "warning" : "success",
        title: important.length ? "Protected - 1 event to review" : "Your home is protected",
        subtitle: `${activeMode.name} · ${online}/${state.devices.length} devices online`,
      },
      chips: [
        { label: "Devices online", value: `${online}/${state.devices.length}`, icon: "Video", tone: "success" },
        { label: "Mode", value: activeMode.name, icon: "ShieldCheck", tone: "primary" },
        { label: "Alert level", value: activeMode.alertLevel, icon: "Bell", tone: "warning" },
      ],
      suggestions: ["Show unusual activity", "Switch to Away Mode"],
    };
  }

  if (has("camera", "device", "offline", "battery")) {
    const low = state.devices.filter((d) => (d.battery ?? 100) < 50);
    const offline = state.devices.filter((d) => d.status === "offline");
    return {
      ...base,
      content: `${online} of ${state.devices.length} devices are online.${
        offline.length ? ` ${offline.map((d) => d.name).join(", ")} ${offline.length === 1 ? "is" : "are"} currently offline.` : ""
      }${low.length ? ` ${low.map((d) => `${d.name} battery is at ${d.battery}%`).join("; ")}.` : " All batteries are healthy."}`,
      chips: state.devices.slice(0, 5).map((d) => ({ label: d.name, value: d.status === "online" ? "Online" : "Offline", icon: "Video", tone: d.status === "online" ? "success" : "danger" })),
      suggestions: ["Show me the front door camera", "Is my home safe now?"],
    };
  }

  if (has("front door", "show me")) {
    const ev = today.find((e) => e.cameraId === "cam-front");
    return {
      ...base,
      content: `The Front Door camera is online. The latest event there was "${ev?.title ?? "Delivery detected"}" at ${formatTime(ev?.timestamp ?? now)}. You can open Live View to watch it in real time.`,
      relatedEventIds: ev ? [ev.id] : [],
      suggestions: ["Open Live View", "What happened today?"],
    };
  }

  if (has("week", "7 days")) {
    const prevWeek = eventsInRange(state.events, "7d", 7);
    const delta = prevWeek.length ? Math.round(((week.length - prevWeek.length) / prevWeek.length) * 100) : 0;
    return {
      ...base,
      content: `This week I analyzed ${wc.total} events. Activity ${delta < 0 ? "decreased" : "increased"} ${Math.abs(delta)}% compared to last week. Most activity was routine family movement in the mornings and evenings.`,
      chips: [
        { label: "People", value: wc.byType.person, icon: "Users", tone: "primary" },
        { label: "Packages", value: wc.byType.package, icon: "Package", tone: "success" },
        { label: "Vehicles", value: wc.byType.vehicle, icon: "Car", tone: "purple" },
        { label: "Attention", value: wc.attention, icon: "CircleAlert", tone: "warning" },
        { label: "Important", value: wc.important, icon: "TriangleAlert", tone: "danger" },
      ],
      suggestions: ["Create a weekly report", "How many deliveries this week?"],
    };
  }

  if (has("visitor", "who came", "people")) {
    const people = week.filter((e) => e.type === "person" || e.type === "doorbell");
    return {
      ...base,
      content: `I recorded ${people.length} person or doorbell events in the last 7 days. Most were recognised family members. ${attention.length ? `${attention.length} unrecognised visitor today at the ${attention[0].location} is worth a quick look.` : ""}`,
      relatedEventIds: attention.slice(0, 2).map((e) => e.id),
      suggestions: ["Show unusual activity", "Add a known visitor"],
    };
  }

  if (has("away", "while i was")) {
    const recent = today.slice(0, 3);
    return {
      ...base,
      content: `While you were away I analyzed ${tc.total} events. ${important.length ? `One important event at ${formatTime(important[0].timestamp)} needs your review.` : "Nothing needed your attention."} Here are the latest moments:`,
      highlights: recent.map((e: RingEvent) => `${formatTime(e.timestamp)} - ${e.title} at ${e.location}`),
      relatedEventIds: recent.map((e) => e.id),
      suggestions: ["Why did you send me an alert?", "Is my home safe now?"],
    };
  }

  if (has("mode", "night", "away mode")) {
    return {
      ...base,
      content: `${activeMode.name} is currently active (${activeMode.alertLevel.toLowerCase()} alert level). ${activeMode.howItWorks}`,
      suggestions: ["Switch to Away Mode", "Is my home safe now?"],
    };
  }

  // Default: today's summary
  return {
    ...base,
    content: `Here's what happened today (Fri, 11 Sep 2026). I analyzed ${tc.total} events. Overall, everything looks normal.`,
    chips: [
      { label: "People", value: tc.byType.person, icon: "Users", tone: "primary" },
      { label: "Packages", value: tc.byType.package, icon: "Package", tone: "success" },
      { label: "Vehicles", value: tc.byType.vehicle, icon: "Car", tone: "purple" },
      { label: "Animals", value: tc.byType.animal, icon: "PawPrint", tone: "warning" },
      { label: "Others", value: tc.byType.other + tc.byType.doorbell + tc.byType.unusual, icon: "MessageSquare", tone: "neutral" },
    ],
    banner: important.length
      ? { tone: "warning", title: "Mostly normal, with 1 event to review.", subtitle: `${important[0].title} at ${formatTime(important[0].timestamp)}` }
      : { tone: "success", title: "Overall, everything looks normal.", subtitle: "No urgent action is required." },
    highlights: [
      `${tc.byType.package} package ${tc.byType.package === 1 ? "delivery" : "deliveries"} at the front door.`,
      "Regular family movement between 8:15 AM - 9:00 AM.",
      ...(important.length ? [`${important[0].title} at ${formatTime(important[0].timestamp)} flagged for review.`] : ["No unusual activity detected."]),
    ],
    relatedEventIds: today.slice(0, 2).map((e) => e.id),
    suggestions: ["Why did you send me an alert?", "How many deliveries this week?", "Is my home safe now?"],
  };
}

export function titleFor(question: string) {
  const t = question.trim().replace(/\s+/g, " ");
  return t.length > 40 ? `${t.slice(0, 38)}…` : t;
}

import type { EventPriority, EventType, RingEvent } from "@/lib/types";
import { images } from "./images";
import { at } from "./clock";

/* ---------------------------------------------------------------------------
   Showcase events - referenced by id across Home, Events, Live, Assistant.
--------------------------------------------------------------------------- */
export const showcaseEvents: RingEvent[] = [
  {
    id: "EVT-1042",
    type: "package",
    title: "Delivery detected",
    location: "Front Door",
    cameraId: "cam-front",
    timestamp: at(0, 9, 24, 1),
    priority: "normal",
    badgeLabel: "Low risk",
    confidence: 0.86,
    summary: "Person + package + doorbell. Likely delivery.",
    imageUrl: images.delivery,
    clipDuration: 15,
    tags: ["Person", "Package", "Delivery", "Normal behaviour"],
    aiAssessment:
      "A person is at your front door holding a package, likely a delivery. The person stayed for 28 seconds and left the area.",
    timeline: [
      { time: at(0, 9, 24, 1), label: "Person detected" },
      { time: at(0, 9, 24, 5), label: "Vehicle detected (driveway)" },
      { time: at(0, 9, 24, 12), label: "Doorbell pressed" },
      { time: at(0, 9, 24, 28), label: "Person left" },
    ],
    recommendedActions: [
      { id: "a1", label: "No immediate action required", done: true },
      { id: "a2", label: "Log as delivery", done: true },
      { id: "a3", label: "Notify if package remains > 1 hour", done: false },
      { id: "a4", label: "Add to delivery report", done: false },
    ],
  },
  {
    id: "EVT-1041",
    type: "unusual",
    title: "Unusual access pattern",
    location: "Back Entrance",
    cameraId: "cam-back",
    timestamp: at(0, 2, 17, 0),
    priority: "important",
    confidence: 0.91,
    summary: "Person appeared 3 times at 2 cameras within 8 minutes during quiet hours.",
    imageUrl: images.frontDoorNight,
    clipDuration: 28,
    tags: ["Person", "Repeated", "Quiet hours", "Review recommended"],
    aiAssessment:
      "The same person was seen at the Back Door and Side Door three times between 02:09 and 02:17 AM. No doorbell press and no recognised face. This pattern is unusual for your home at this hour.",
    timeline: [
      { time: at(0, 2, 9, 40), label: "Person detected - Side Door" },
      { time: at(0, 2, 12, 5), label: "Person detected - Back Door" },
      { time: at(0, 2, 15, 48), label: "Person returned - Back Door" },
      { time: at(0, 2, 17, 0), label: "Matan flagged as important" },
      { time: at(0, 2, 17, 6), label: "Immediate alert sent" },
    ],
    recommendedActions: [
      { id: "b1", label: "Review the clip", done: false },
      { id: "b2", label: "Check back door is locked", done: false },
      { id: "b3", label: "Enable Night Mode lights automation", done: false },
      { id: "b4", label: "Share with a family member", done: false },
    ],
  },
  {
    id: "EVT-1040",
    type: "person",
    title: "Unknown visitor",
    location: "Side Door",
    cameraId: "cam-side",
    timestamp: at(0, 7, 15, 0),
    priority: "attention",
    confidence: 0.78,
    summary: "Person stayed near entrance for 2 minutes. Monitor for changes.",
    imageUrl: images.sideDoor,
    clipDuration: 18,
    tags: ["Person", "Unrecognised", "Lingering"],
    aiAssessment:
      "An unrecognised person stood near the side door for about two minutes without pressing the doorbell. Nothing was touched. Worth a quick look, but no urgent action is needed.",
    timeline: [
      { time: at(0, 7, 15, 0), label: "Person detected" },
      { time: at(0, 7, 15, 40), label: "Person still present" },
      { time: at(0, 7, 17, 4), label: "Person left" },
    ],
    recommendedActions: [
      { id: "c1", label: "Review the clip", done: false },
      { id: "c2", label: "Add to known visitors if recognised", done: false },
      { id: "c3", label: "Enable quick reply for side door", done: false },
    ],
  },
  {
    id: "EVT-1040A",
    type: "animal",
    title: "Animal detected",
    location: "Backyard",
    cameraId: "cam-back",
    timestamp: at(0, 6, 48, 0),
    priority: "normal",
    confidence: 0.9,
    summary: "Cat crossed the backyard. No action required.",
    imageUrl: images.cat,
    clipDuration: 11,
    tags: ["Animal", "Cat", "Normal behaviour"],
    aiAssessment: "The neighbourhood cat passed through the backyard at dawn, as it does most mornings.",
    recommendedActions: [{ id: "k1", label: "No action required", done: true }],
  },
  {
    id: "EVT-1039",
    type: "vehicle",
    title: "Vehicle detected",
    location: "Driveway",
    cameraId: "cam-driveway",
    timestamp: at(-1, 21, 48, 0),
    priority: "normal",
    confidence: 0.93,
    summary: "Vehicle entered and left. Regular activity.",
    imageUrl: images.vehicle,
    clipDuration: 20,
    tags: ["Vehicle", "Known vehicle", "Normal behaviour"],
    aiAssessment:
      "A vehicle matching your registered car arrived and parked in the driveway. This matches your usual evening pattern.",
    timeline: [
      { time: at(-1, 21, 48, 0), label: "Vehicle detected" },
      { time: at(-1, 21, 48, 30), label: "Vehicle parked" },
      { time: at(-1, 21, 49, 10), label: "Person detected (Maria)" },
    ],
    recommendedActions: [{ id: "d1", label: "No action required", done: true }],
  },
  {
    id: "EVT-1038",
    type: "animal",
    title: "Animal detected",
    location: "Backyard",
    cameraId: "cam-back",
    timestamp: at(-1, 19, 15, 0),
    priority: "normal",
    confidence: 0.89,
    summary: "Cat detected in backyard. No action required.",
    imageUrl: images.cat,
    clipDuration: 12,
    tags: ["Animal", "Cat", "Normal behaviour"],
    aiAssessment: "A cat crossed the backyard. This is a regular visitor and not a concern.",
    recommendedActions: [{ id: "e1", label: "No action required", done: true }],
  },
  {
    id: "EVT-1037",
    type: "person",
    title: "Person at side door",
    location: "Side Door",
    cameraId: "cam-side",
    timestamp: at(-1, 18, 32, 0),
    priority: "attention",
    confidence: 0.81,
    summary: "Person paused at side door for 40 seconds. Review recommended.",
    imageUrl: images.sideDoor,
    clipDuration: 18,
    tags: ["Person", "Side Door", "Paused"],
    aiAssessment:
      "A person approached the side door, paused for about 40 seconds and then walked away. No doorbell press. This is slightly outside your normal pattern.",
    recommendedActions: [
      { id: "f1", label: "Review the clip", done: false },
      { id: "f2", label: "Mark as known visitor", done: false },
    ],
  },
  {
    id: "EVT-1036",
    type: "doorbell",
    title: "Doorbell pressed",
    location: "Front Door",
    cameraId: "cam-front",
    timestamp: at(-1, 13, 29, 0),
    priority: "normal",
    confidence: 0.99,
    summary: "Doorbell was pressed. Visitor greeted by Maria.",
    imageUrl: images.doorbell,
    clipDuration: 10,
    tags: ["Doorbell", "Visitor", "Answered"],
    aiAssessment: "The doorbell was pressed and answered within 20 seconds. Normal visitor activity.",
    recommendedActions: [{ id: "g1", label: "No action required", done: true }],
  },
  {
    id: "EVT-1035",
    type: "package",
    title: "Package left behind",
    location: "Front Door",
    cameraId: "cam-front",
    timestamp: at(-1, 11, 3, 0),
    priority: "attention",
    confidence: 0.84,
    summary: "Package remained at the door for more than 2 hours.",
    imageUrl: images.packageAtDoor,
    clipDuration: 14,
    tags: ["Package", "Unattended", "2h+"],
    aiAssessment:
      "A package was delivered at 11:03 AM and remained visible at the front door until 01:22 PM when Maria collected it.",
    timeline: [
      { time: at(-1, 11, 3, 0), label: "Package delivered" },
      { time: at(-1, 13, 3, 0), label: "Still unattended after 2 hours" },
      { time: at(-1, 13, 22, 0), label: "Collected by Maria" },
    ],
    recommendedActions: [
      { id: "h1", label: "Package collected", done: true },
      { id: "h2", label: "Review package alert threshold", done: false },
    ],
  },
  {
    id: "EVT-1034",
    type: "person",
    title: "Family arrival",
    location: "Front Door",
    cameraId: "cam-front",
    timestamp: at(-1, 15, 45, 0),
    priority: "normal",
    confidence: 0.96,
    summary: "Noel arrived home from school. Welcome notification sent.",
    imageUrl: images.familyArrival,
    clipDuration: 9,
    tags: ["Person", "Family", "Recognised"],
    aiAssessment: "Recognised family member Noel arrived home at the usual time.",
    recommendedActions: [{ id: "i1", label: "No action required", done: true }],
  },
  {
    id: "EVT-1033",
    type: "other",
    title: "Device status change",
    location: "Side Door",
    cameraId: "cam-side",
    timestamp: at(-2, 8, 12, 0),
    priority: "normal",
    confidence: 1,
    summary: "Side Door camera battery dropped to 41%.",
    tags: ["Device", "Battery"],
    aiAssessment: "The Side Door camera battery is at 41%. Consider charging it within the next week.",
    recommendedActions: [{ id: "j1", label: "Schedule a charge", done: false }],
  },
];

/* ---------------------------------------------------------------------------
   Deterministic filler so trends/insights have believable volume.
--------------------------------------------------------------------------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cams = [
  { id: "cam-front", loc: "Front Door", img: images.frontDoor },
  { id: "cam-back", loc: "Backyard", img: images.backDoor },
  { id: "cam-driveway", loc: "Driveway", img: images.driveway },
  { id: "cam-side", loc: "Side Door", img: images.sideDoor },
  { id: "cam-indoor", loc: "Living Room", img: images.livingRoom },
];

const normalTemplates: Record<Exclude<EventType, "unusual">, { title: string; summary: string; tags: string[] }[]> = {
  person: [
    { title: "Person detected", summary: "Family member passing by. Regular activity.", tags: ["Person", "Recognised"] },
    { title: "Person detected", summary: "Brief presence near entrance. Normal behaviour.", tags: ["Person", "Normal behaviour"] },
    { title: "Family departure", summary: "Recognised family member left the house.", tags: ["Person", "Family"] },
  ],
  package: [
    { title: "Delivery detected", summary: "Courier left a package and departed. Likely delivery.", tags: ["Package", "Delivery"] },
    { title: "Package collected", summary: "Package picked up by a family member.", tags: ["Package", "Collected"] },
  ],
  vehicle: [
    { title: "Vehicle detected", summary: "Known vehicle arrived. Regular activity.", tags: ["Vehicle", "Known vehicle"] },
    { title: "Vehicle passing", summary: "Vehicle drove past the driveway without stopping.", tags: ["Vehicle", "Passing"] },
  ],
  animal: [
    { title: "Animal detected", summary: "Cat crossed the yard. No action required.", tags: ["Animal", "Cat"] },
    { title: "Animal detected", summary: "Bird activity near the camera. No action required.", tags: ["Animal", "Bird"] },
  ],
  doorbell: [
    { title: "Doorbell pressed", summary: "Doorbell pressed and answered. Normal visitor.", tags: ["Doorbell", "Answered"] },
  ],
  other: [
    { title: "Motion detected", summary: "General motion, likely wind or shadows.", tags: ["Motion"] },
    { title: "Device status change", summary: "Camera reconnected after a short Wi-Fi drop.", tags: ["Device"] },
  ],
};

const attentionTemplates = [
  { type: "person" as EventType, title: "Person lingering", summary: "Person stayed near the entrance for over a minute.", tags: ["Person", "Lingering"] },
  { type: "package" as EventType, title: "Package left behind", summary: "Package remained unattended for more than 2 hours.", tags: ["Package", "Unattended"] },
  { type: "vehicle" as EventType, title: "Late-night vehicle", summary: "Unknown vehicle stopped briefly during quiet hours.", tags: ["Vehicle", "Quiet hours"] },
];

const importantTemplates = [
  { type: "unusual" as EventType, title: "Unusual access pattern", summary: "Repeated presence at multiple cameras during quiet hours.", tags: ["Person", "Repeated", "Quiet hours"] },
  { type: "unusual" as EventType, title: "Repeated unknown visitor", summary: "Same unrecognised person seen three times this week.", tags: ["Person", "Repeated"] },
];

const typeWeights: [Exclude<EventType, "unusual">, number][] = [
  ["person", 0.36],
  ["package", 0.14],
  ["vehicle", 0.16],
  ["animal", 0.1],
  ["doorbell", 0.08],
  ["other", 0.16],
];

function pickType(r: number): Exclude<EventType, "unusual"> {
  let acc = 0;
  for (const [t, w] of typeWeights) {
    acc += w;
    if (r <= acc) return t;
  }
  return "other";
}

function generateFiller(): RingEvent[] {
  const rnd = mulberry32(20260911);
  const out: RingEvent[] = [];
  let seq = 900;

  // Today: exactly 20 additional normal events before 09:24 -> 24 total (22/1/1).
  for (let i = 0; i < 20; i++) {
    const type = pickType(rnd());
    const cam = cams[Math.floor(rnd() * cams.length)];
    const tpl = normalTemplates[type][Math.floor(rnd() * normalTemplates[type].length)];
    const hour = 5 + Math.floor(rnd() * 4); // 05:00 - 08:59
    const minute = Math.floor(rnd() * 60);
    out.push({
      id: `EVT-${seq--}`,
      type,
      title: tpl.title,
      location: cam.loc,
      cameraId: cam.id,
      timestamp: at(0, hour, minute, Math.floor(rnd() * 60)),
      priority: "normal",
      confidence: 0.8 + rnd() * 0.18,
      summary: tpl.summary,
      imageUrl: type === "animal" ? images.cat : type === "package" ? images.delivery : type === "vehicle" ? images.vehicle : cam.img,
      clipDuration: 8 + Math.floor(rnd() * 20),
      tags: tpl.tags,
      aiAssessment: `${tpl.summary} Matan AI classified this as normal activity for your home.`,
      recommendedActions: [{ id: "n1", label: "No action required", done: true }],
    });
  }

  // Previous 29 days
  for (let day = 1; day <= 29; day++) {
    const count = 15 + Math.floor(rnd() * 10); // 15-24 per day
    for (let i = 0; i < count; i++) {
      const roll = rnd();
      const cam = cams[Math.floor(rnd() * cams.length)];
      const hourRoll = rnd();
      // Bias towards mornings and evenings.
      const hour = hourRoll < 0.35 ? 6 + Math.floor(rnd() * 4) : hourRoll < 0.7 ? 15 + Math.floor(rnd() * 5) : Math.floor(rnd() * 24);
      const minute = Math.floor(rnd() * 60);
      const ts = at(-day, hour, minute, Math.floor(rnd() * 60));
      let priority: EventPriority = "normal";
      let type: EventType;
      let tpl: { title: string; summary: string; tags: string[] };
      if (roll < 0.02) {
        priority = "important";
        const t = importantTemplates[Math.floor(rnd() * importantTemplates.length)];
        type = t.type;
        tpl = t;
      } else if (roll < 0.09) {
        priority = "attention";
        const t = attentionTemplates[Math.floor(rnd() * attentionTemplates.length)];
        type = t.type;
        tpl = t;
      } else {
        type = pickType(rnd());
        tpl = normalTemplates[type as Exclude<EventType, "unusual">][
          Math.floor(rnd() * normalTemplates[type as Exclude<EventType, "unusual">].length)
        ];
      }
      out.push({
        id: `EVT-${seq--}`,
        type,
        title: tpl.title,
        location: cam.loc,
        cameraId: cam.id,
        timestamp: ts,
        priority,
        confidence: 0.72 + rnd() * 0.26,
        summary: tpl.summary,
        imageUrl:
          type === "animal" ? images.cat : type === "package" ? images.delivery : type === "vehicle" ? images.vehicle : priority === "important" ? images.frontDoorNight : cam.img,
        clipDuration: 8 + Math.floor(rnd() * 24),
        tags: tpl.tags,
        aiAssessment:
          priority === "normal"
            ? `${tpl.summary} Matan AI classified this as normal activity for your home.`
            : priority === "attention"
              ? `${tpl.summary} Worth a quick look, but no urgent action is needed.`
              : `${tpl.summary} Matan AI recommends reviewing this event.`,
        recommendedActions:
          priority === "normal"
            ? [{ id: "n1", label: "No action required", done: true }]
            : [
                { id: "r1", label: "Review the clip", done: false },
                { id: "r2", label: "Mark as reviewed", done: false },
              ],
      });
    }
  }
  return out;
}

export const allEvents: RingEvent[] = [...showcaseEvents, ...generateFiller()].sort(
  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
);

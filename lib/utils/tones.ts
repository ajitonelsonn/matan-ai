import type { EventPriority, EventType } from "@/lib/types";

export type Tone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "cyan"
  | "neutral";

/** Tailwind class fragments for each semantic tone. */
export const toneStyles: Record<
  Tone,
  { text: string; bg: string; border: string; solid: string; dot: string; ring: string }
> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/12",
    border: "border-primary/30",
    solid: "bg-primary text-white",
    dot: "bg-primary",
    ring: "ring-primary/40",
  },
  success: {
    text: "text-success",
    bg: "bg-success/12",
    border: "border-success/30",
    solid: "bg-success text-bg",
    dot: "bg-success",
    ring: "ring-success/40",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning/12",
    border: "border-warning/30",
    solid: "bg-warning text-bg",
    dot: "bg-warning",
    ring: "ring-warning/40",
  },
  danger: {
    text: "text-danger",
    bg: "bg-danger/12",
    border: "border-danger/30",
    solid: "bg-danger text-white",
    dot: "bg-danger",
    ring: "ring-danger/40",
  },
  purple: {
    text: "text-purple",
    bg: "bg-purple/12",
    border: "border-purple/30",
    solid: "bg-purple text-white",
    dot: "bg-purple",
    ring: "ring-purple/40",
  },
  cyan: {
    text: "text-cyan",
    bg: "bg-cyan/12",
    border: "border-cyan/30",
    solid: "bg-cyan text-bg",
    dot: "bg-cyan",
    ring: "ring-cyan/40",
  },
  neutral: {
    text: "text-text-2",
    bg: "bg-surface-3/70",
    border: "border-border",
    solid: "bg-surface-3 text-text",
    dot: "bg-text-3",
    ring: "ring-border-strong",
  },
};

export const priorityTone: Record<EventPriority, Tone> = {
  normal: "success",
  attention: "warning",
  important: "danger",
};

export const priorityLabel: Record<EventPriority, string> = {
  normal: "Normal",
  attention: "Attention",
  important: "Important",
};

export const eventTypeTone: Record<EventType, Tone> = {
  person: "primary",
  package: "success",
  vehicle: "primary",
  animal: "purple",
  doorbell: "success",
  unusual: "danger",
  other: "neutral",
};

export const eventTypeLabel: Record<EventType, string> = {
  person: "People",
  package: "Packages",
  vehicle: "Vehicles",
  animal: "Animals",
  doorbell: "Doorbell",
  unusual: "Unusual",
  other: "Others",
};

/** Hex colors for charts - always the token values, never ad-hoc. */
export const chartColors = {
  people: "#12a8ff",
  packages: "#16df9b",
  vehicles: "#9a71ff",
  animals: "#ffc34a",
  others: "#7f95b0",
  security: "#ff4d5e",
  grid: "rgba(53,154,255,0.12)",
  axis: "#7f95b0",
};

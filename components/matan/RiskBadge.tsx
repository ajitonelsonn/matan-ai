import { Badge } from "@/components/ui/Badge";
import { priorityLabel, priorityTone } from "@/lib/utils/tones";
import type { EventPriority } from "@/lib/types";

/** The one place event priority becomes a colour. Green = normal, amber = attention, red = important. */
export function RiskBadge({ priority, label, size = "sm", variant = "solid", className }: { priority: EventPriority; label?: string; size?: "xs" | "sm" | "md"; variant?: "solid" | "soft"; className?: string }) {
  return (
    <Badge tone={priorityTone[priority]} variant={variant} size={size} uppercase className={className}>
      {label ?? priorityLabel[priority]}
    </Badge>
  );
}

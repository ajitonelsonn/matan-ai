import { Badge } from "@/components/ui/Badge";
import { priorityLabel, priorityTone } from "@/lib/utils/tones";
import type { EventPriority } from "@/lib/types";

/** The one place event priority becomes a colour. Green = normal, amber = attention, red = important. */
export function RiskBadge({ priority, label, size = "sm", variant = "solid", className, pending }: { priority: EventPriority; label?: string; size?: "xs" | "sm" | "md"; variant?: "solid" | "soft"; className?: string; pending?: boolean }) {
  // Ring-derived events carry no priority until Matan AI has actually analysed them.
  if (pending) {
    return (
      <Badge tone="neutral" variant="soft" size={size} uppercase className={className} title="Matan AI analysis has not run for this Ring event yet">
        Awaiting AI
      </Badge>
    );
  }
  return (
    <Badge tone={priorityTone[priority]} variant={variant} size={size} uppercase className={className}>
      {label ?? priorityLabel[priority]}
    </Badge>
  );
}

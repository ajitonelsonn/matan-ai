"use client";

import * as React from "react";
import { ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import { toneStyles, type Tone } from "@/lib/utils/tones";
import type { Automation } from "@/lib/types";

export function RuleChip({ prefix, icon, label, className }: { prefix?: string; icon?: React.ReactNode; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-9 max-w-full items-center gap-2 rounded-[10px] border border-border bg-bg/50 px-3 text-[13px] text-text", className)}>
      {prefix && <span className="text-text-3">{prefix}</span>}
      {icon && <span className="text-primary [&>svg]:size-4 shrink-0">{icon}</span>}
      <span className="truncate font-medium">{label}</span>
    </span>
  );
}

/** Trigger → Condition → Action, rendered identically wherever an automation appears. */
export function AutomationFlow({ trigger, condition, action, className, compact }: { trigger: string; condition?: string; action: string; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <RuleChip prefix="When" icon={<Zap />} label={trigger} className={compact ? "h-8 text-xs" : ""} />
      {condition && (
        <>
          <ArrowRight className="size-4 shrink-0 text-text-3" aria-hidden />
          <RuleChip prefix="If" label={condition} className={cn("border-dashed", compact ? "h-8 text-xs" : "")} />
        </>
      )}
      <ArrowRight className="size-4 shrink-0 text-text-3" aria-hidden />
      <RuleChip prefix="Then" label={action} className={cn("border-success/30 bg-success/8", compact ? "h-8 text-xs" : "")} />
    </div>
  );
}

export function AutomationCard({
  automation,
  onToggle,
  menu,
  onOpen,
  className,
  busy,
}: {
  automation: Automation;
  onToggle: (enabled: boolean) => void;
  menu?: React.ReactNode;
  onOpen?: () => void;
  className?: string;
  busy?: boolean;
}) {
  const t = toneStyles[automation.tone as Tone];
  return (
    <article className={cn("card grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]", !automation.enabled && "opacity-80", className)}>
      <div className="min-w-0">
        <div className="flex items-start gap-3.5">
          <span className={cn("inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border [&>svg]:size-6", t.bg, t.border, t.text)}>
            <Icon name={automation.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <button type="button" onClick={onOpen} className="text-left text-[17px] font-semibold text-text hover:text-primary-2 transition-colors">
                  {automation.name}
                </button>
                <p className="text-[13.5px] text-text-2">{automation.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={automation.enabled ? "success" : "neutral"} size="md" className="hidden sm:inline-flex">
                  {automation.enabled ? "Active" : "Paused"}
                </Badge>
                <Toggle checked={automation.enabled} onChange={onToggle} label={`${automation.enabled ? "Disable" : "Enable"} ${automation.name}`} disabled={busy} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <AutomationFlow trigger={automation.trigger} condition={automation.condition} action={automation.action} className="min-w-0 flex-1" />
              {menu}
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex items-start gap-3">
        <div className="relative h-[84px] w-[110px] shrink-0 overflow-hidden rounded-xl border border-border">
          <SafeImage src={automation.imageUrl} alt="" sizes="120px" />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <Badge tone="neutral" size="xs" className="mb-1.5">
            Example
          </Badge>
          <p className="text-[12.5px] leading-snug text-text-2">{automation.exampleText}</p>
          <p className="mt-2 text-[11px] text-text-3">{automation.runsThisWeek} runs this week</p>
        </div>
      </div>
    </article>
  );
}

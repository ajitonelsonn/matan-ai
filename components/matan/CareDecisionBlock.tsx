"use client";

import { Siren, BellRing, Eye, EyeOff, TriangleAlert, Moon, Repeat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import type { RuleDecision, RuleFailure } from "@/lib/matan/rules/types";

const tone = { IGNORE: "border-border bg-surface-2/40", MONITOR: "border-primary/30 bg-primary/8", NOTIFY: "border-warning/40 bg-warning/10", ESCALATE: "border-danger/50 bg-danger/10" } as const;
const badge = { IGNORE: "neutral", MONITOR: "primary", NOTIFY: "warning", ESCALATE: "danger" } as const;
const icon = { IGNORE: <EyeOff className="size-4" />, MONITOR: <Eye className="size-4" />, NOTIFY: <BellRing className="size-4" />, ESCALATE: <Siren className="size-4" /> } as const;

/** "Why Matan chose this action" - deterministic explanation from Care Context + Smart Rules. */
export function CareDecisionBlock({ decision, ruleNames = {} }: { decision: RuleDecision | RuleFailure; ruleNames?: Record<string, string> }) {
  if ("failed" in decision) {
    return (
      <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3" role="alert">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-danger"><TriangleAlert className="size-3.5" /> Matan decision · rule evaluation failed</p>
        <p className="mt-1 text-[13px] text-text-2">Smart rules could not be evaluated ({decision.error}). No notification was sent on the basis of rules; the risk assessment below still stands.</p>
      </div>
    );
  }
  return (
    <div className={cn("mt-3 rounded-xl border p-3", tone[decision.action])}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-text-3">Matan decision</p>
        <span className="flex items-center gap-1.5 text-[11.5px] text-text-3">
          {decision.facts.quietHoursActive && <span className="inline-flex items-center gap-1"><Moon className="size-3" /> quiet hours</span>}
          {decision.facts.repeatedCount !== undefined && decision.facts.repeatedCount > 1 && <span className="inline-flex items-center gap-1"><Repeat className="size-3" /> {decision.facts.repeatedCount}× recently</span>}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Badge tone={badge[decision.action]} variant="solid" size="md" uppercase icon={icon[decision.action]}>{decision.action}</Badge>
        {decision.confidence !== undefined && <Badge tone="neutral" size="md">Confidence {Math.round(decision.confidence * 100)}%</Badge>}
        {!decision.facts.careEnabled && <Badge tone="neutral" size="md">Care context off</Badge>}
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-text-3">Reason</p>
      <p className="text-[13.5px] text-text">{decision.reason}</p>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-text-3">Matched rules</p>
      {decision.matchedRuleIds.length ? (
        <ul className="mt-0.5 space-y-0.5 text-[13px] text-text-2">
          {decision.matchedRuleIds.map((id) => (
            <li key={id} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-text-3" aria-hidden />{ruleNames[id] ?? id}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-text-3">None - default action from the Decision Engine.</p>
      )}
    </div>
  );
}

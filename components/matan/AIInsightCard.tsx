import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { toneStyles, type Tone } from "@/lib/utils/tones";

/** One row of AI-derived finding / recommendation. Same look on Insights, Care, Business. */
export function AIInsightCard({
  icon,
  title,
  description,
  tone = "primary",
  onClick,
  className,
  trailing,
}: {
  icon: string | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: Tone;
  onClick?: () => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  const t = toneStyles[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "card-inset flex w-full items-center gap-3 p-3 text-left transition-[border-color,background-color] duration-150",
        onClick && "hover:border-border-strong hover:bg-surface-2/60",
        className,
      )}
    >
      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-5", t.bg, t.border, t.text)}>
        {typeof icon === "string" ? <Icon name={icon} /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-text leading-snug">{title}</span>
        {description && <span className="mt-0.5 block text-[12.5px] text-text-3 leading-snug">{description}</span>}
      </span>
      {trailing ?? (onClick && <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden />)}
    </Tag>
  );
}

/** Highlighted callout (e.g. "Activity decreased by 18% this week"). */
export function AICallout({ tone = "warning", icon, title, description, className, action }: { tone?: Tone; icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const t = toneStyles[tone];
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-3.5", t.bg, t.border, className)}>
      {icon && <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl [&>svg]:size-[18px]", t.solid)}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-text leading-snug">{title}</p>
        {description && <p className="text-[12.5px] text-text-2 leading-snug">{description}</p>}
      </div>
      {action}
    </div>
  );
}

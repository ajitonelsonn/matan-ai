import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hero?: boolean;
  interactive?: boolean;
  selected?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  as?: "div" | "section" | "article";
}

const paddings = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };

export function Card({ hero, interactive, selected, padding = "md", className, as: Tag = "div", ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        hero ? "card-hero" : "card",
        paddings[padding],
        interactive && "hover-lift cursor-pointer hover:border-border-strong",
        selected && "border-primary/60 glow-strong",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  action,
  className,
  iconTone = "primary",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  iconTone?: "primary" | "success" | "warning" | "danger" | "purple";
}) {
  const tones = {
    primary: "bg-primary/12 text-primary border-primary/25",
    success: "bg-success/12 text-success border-success/25",
    warning: "bg-warning/12 text-warning border-warning/25",
    danger: "bg-danger/12 text-danger border-danger/25",
    purple: "bg-purple/12 text-purple border-purple/25",
  };
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl border [&>svg]:size-[18px]", tones[iconTone])}>{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-text leading-tight truncate">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-3 leading-snug">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

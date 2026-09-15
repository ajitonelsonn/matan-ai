import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function SectionHeader({
  icon,
  title,
  subtitle,
  href,
  linkLabel = "View all",
  action,
  className,
  iconTone = "primary",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  action?: React.ReactNode;
  className?: string;
  iconTone?: "primary" | "success" | "warning" | "danger" | "purple";
}) {
  const tones = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    purple: "text-purple",
  };
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className={cn("shrink-0 [&>svg]:size-5", tones[iconTone])}>{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-text leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-3">{subtitle}</p>}
        </div>
      </div>
      {action ??
        (href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary hover:text-primary-2 transition-colors">
            {linkLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ))}
    </div>
  );
}

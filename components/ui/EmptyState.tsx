import * as React from "react";
import { Inbox, TriangleAlert, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8 px-4" : "py-14 px-6", className)}>
      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 [&>svg]:size-6">
        {icon ?? <Inbox />}
      </div>
      <h3 className="text-[15px] font-semibold text-text">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-text-3 leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, message, className, compact }: { onRetry?: () => void; message?: string; className?: string; compact?: boolean }) {
  return (
    <div className={cn("card border-danger/25", className)}>
      <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8 px-4" : "py-12 px-6")}>
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-danger/12 text-danger border border-danger/25">
          <TriangleAlert className="size-5" />
        </div>
        <h3 className="text-[15px] font-semibold text-text">We couldn&apos;t load this data.</h3>
        {message && <p className="mt-1 text-xs text-text-3">{message}</p>}
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-4" leftIcon={<RefreshCw className="size-4" />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

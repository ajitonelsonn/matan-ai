"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { sectionOf } from "@/lib/experience/mode-routes";

const LABELS: Record<string, string> = {
  "/": "Home",
  "/events": "Events",
  "/devices": "Devices",
  "/live": "Live View",
  "/automations": "Automations",
  "/insights": "AI Insights",
  "/assistant": "AI Assistant",
  "/security-modes": "Security Modes",
  "/care": "Care & Family",
  "/business": "Business",
  "/settings": "Settings",
};

const REDIRECT_SECONDS = 6;

/**
 * Unknown URL: offer the closest real page (the section the link pointed at, else Home)
 * and go there on its own, so a stale link or a mistyped id is never a dead end.
 */
export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const target = sectionOf(pathname);
  const label = LABELS[target] ?? "Home";
  const [left, setLeft] = React.useState(REDIRECT_SECONDS);

  React.useEffect(() => {
    const tick = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const go = setTimeout(() => router.replace(target), REDIRECT_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [router, target]);

  return (
    <div className="card mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={<SearchX />}
        title="Page not found"
        description={`Matan couldn't find that page. It may have moved, or the link is out of date. Taking you to ${label} in ${left}s…`}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button href={target}>Go to {label}</Button>
            {target !== "/" && (
              <Button href="/" variant="secondary">
                Back to Home
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}

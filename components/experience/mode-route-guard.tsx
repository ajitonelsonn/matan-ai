"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { routeForMode } from "@/lib/experience/mode-routes";
import { useExperience } from "./experience-provider";

/**
 * Keeps the URL inside the active experience. A detail page belongs to one mode only
 * (Ring events/devices and Smart Rules in Real Mode, the sample dataset in Demo Mode), so
 * after a mode switch - or when an old link, bookmark or notification points at the other
 * mode - the browser lands on that section's list page instead of a page that cannot load.
 */
export function ModeRouteGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { mode } = useExperience();

  React.useEffect(() => {
    if (!mode || !pathname) return;
    const next = routeForMode(pathname, window.location.search, mode);
    // Compare the whole URL: Live View keeps the camera in the query, so the target can
    // share this pathname and still be a different page.
    if (next && next !== pathname + window.location.search) router.replace(next);
  }, [pathname, mode, router]);

  return null;
}

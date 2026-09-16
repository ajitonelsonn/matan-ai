"use client";

import * as React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { MatanLoader } from "@/components/matan/MatanLoader";
import { refreshBus, useInflight } from "@/lib/loading/store";
import { useAppData } from "./AppDataProvider";

/** Topbar control: the animated logo while any data is loading; a refresh button when idle. */
export function RefreshIndicator({ className }: { className?: string }) {
  const inflight = useInflight();
  const { refresh } = useAppData();
  const toast = useToast();
  const [manual, setManual] = React.useState(false);
  const busy = inflight > 0 || manual;

  const onRefresh = async () => {
    setManual(true);
    refreshBus.emit();
    await refresh();
    setTimeout(() => {
      setManual(false);
      toast.success("Data refreshed", "Matan AI re-checked your home.");
    }, 700);
  };

  return (
    <div className={cn("relative flex size-11 items-center justify-center", className)}>
      {busy ? (
        <div className="flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 animate-fade-in" title="Refreshing data…">
          <MatanLoader size="xs" wordmark={false} messages={false} label="Refreshing data" />
        </div>
      ) : (
        <Tooltip content="Refresh data" side="bottom">
          <IconButton label="Refresh data" variant="outline" onClick={() => void onRefresh()} className="rounded-full size-11">
            <RefreshCw />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
}

/** Thin indeterminate progress bar at the very top of the viewport while requests are in flight. */
export function TopProgress() {
  const inflight = useInflight();
  const scope = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (inflight > 0) setShown(true);
    else {
      const t = setTimeout(() => setShown(false), 350);
      return () => clearTimeout(t);
    }
  }, [inflight]);

  useGSAP(
    () => {
      if (!shown) return;
      gsap.fromTo(scope.current!.querySelector("[data-bar]"), { xPercent: -100 }, { xPercent: 300, duration: 1.1, repeat: -1, ease: "power1.inOut" });
    },
    { scope, dependencies: [shown] },
  );

  if (!shown) return null;
  return (
    <div ref={scope} className={cn("pointer-events-none fixed inset-x-0 top-0 z-[140] h-[3px] overflow-hidden bg-primary/10 transition-opacity", inflight > 0 ? "opacity-100" : "opacity-0")} aria-hidden>
      <div data-bar className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary via-cyan to-primary-2 shadow-[0_0_12px_rgba(18,230,255,0.8)] will-change-transform" />
    </div>
  );
}

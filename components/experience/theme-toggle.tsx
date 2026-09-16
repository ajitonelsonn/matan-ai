"use client";

import { Moon, Sun, MonitorCog } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTheme, type ThemePreference } from "./theme-provider";

const options: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: "dark", label: "Dark", icon: <Moon /> },
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "system", label: "System", icon: <MonitorCog /> },
];

/** ☾ Dark · ☀ Light · ◐ System segmented control. */
export function ThemeToggle({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex rounded-control border border-border bg-surface-2/70 p-0.5", className)}>
      {options.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[9px] font-medium transition-colors [&>svg]:size-4",
              size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[13px]",
              active ? "bg-gradient-to-b from-primary-2 to-primary text-white shadow-[0_4px_14px_rgba(18,168,255,0.3)]" : "text-text-2 hover:bg-surface-3 hover:text-text",
            )}
          >
            {o.icon}
            <span className={size === "sm" ? "sr-only sm:not-sr-only" : ""}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

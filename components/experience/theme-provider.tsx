"use client";

import * as React from "react";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

import { THEME_STORAGE_KEY } from "./theme-script";

interface ThemeContextValue {
  theme: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function apply(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

/**
 * Global theme (dark / light / system). Independent of Demo/Real mode.
 * The resolved theme is stamped on <html data-theme> (an inline script in the
 * root layout does the same before first paint to avoid a flash).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePreference>("dark");
  const [resolved, setResolved] = React.useState<ResolvedTheme>("dark");

  React.useEffect(() => {
    let pref: ThemePreference = "dark";
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
      if (stored === "dark" || stored === "light" || stored === "system") pref = stored;
    } catch {
      /* ignore */
    }
    setThemeState(pref);
    const r = pref === "system" ? systemTheme() : pref;
    setResolved(r);
    apply(r);
  }, []);

  React.useEffect(() => {
    if (theme !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const r = systemTheme();
      setResolved(r);
      apply(r);
    };
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((t: ThemePreference) => {
    setThemeState(t);
    const r = t === "system" ? systemTheme() : t;
    setResolved(r);
    apply(r);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

"use client";

import * as React from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { AppDataProvider } from "./AppDataProvider";
import { SplashGate } from "./SplashGate";
import { TopProgress } from "./RefreshIndicator";
import { ThemeProvider } from "@/components/experience/theme-provider";
import { ExperienceProvider } from "@/components/experience/experience-provider";
import { ModeSelection } from "@/components/experience/mode-selection";
import { ModeTransition } from "@/components/experience/mode-transition";
import { ExperienceModals } from "@/components/experience/experience-modals";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ExperienceProvider>
            <AppDataProvider>
              {children}
              <TopProgress />
              <ModeTransition />
              <ModeSelection />
              <ExperienceModals />
              <SplashGate />
            </AppDataProvider>
          </ExperienceProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

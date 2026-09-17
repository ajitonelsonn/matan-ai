"use client";

import * as React from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { AppDataProvider } from "./AppDataProvider";
import { AppShell } from "./AppShell";
import { SplashGate } from "./SplashGate";
import { TopProgress } from "./RefreshIndicator";
import { ThemeProvider } from "@/components/experience/theme-provider";
import { ExperienceProvider } from "@/components/experience/experience-provider";
import { ModeSelection } from "@/components/experience/mode-selection";
import { ModeTransition } from "@/components/experience/mode-transition";
import { ExperienceModals } from "@/components/experience/experience-modals";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthGuard } from "@/components/auth/AuthGuard";

/**
 * Provider order matters: theme and toasts are available on the public auth
 * pages; everything experience/data related (Demo vs Real mode, Ring session,
 * dashboard polling, first-run chooser) mounts only once Cognito confirms a user.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <AuthGuard app={(page) => <AuthenticatedApp>{page}</AuthenticatedApp>}>{children}</AuthGuard>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  return (
    <ExperienceProvider>
      <AppDataProvider>
        <AppShell>{children}</AppShell>
        <TopProgress />
        <ModeTransition />
        <ModeSelection />
        <ExperienceModals />
        <SplashGate />
      </AppDataProvider>
    </ExperienceProvider>
  );
}

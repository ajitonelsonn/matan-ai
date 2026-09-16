"use client";

import * as React from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { AppDataProvider } from "./AppDataProvider";
import { SplashGate } from "./SplashGate";
import { TopProgress } from "./RefreshIndicator";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppDataProvider>
          {children}
          <TopProgress />
          <SplashGate />
        </AppDataProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

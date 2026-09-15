import * as React from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:pl-60">
      <Sidebar />
      <MobileNav />
      <main id="main" className="mx-auto w-full max-w-[1640px] px-4 py-5 sm:px-6 sm:py-6 xl:px-7 animate-fade-in">
        {children}
      </main>
    </div>
  );
}

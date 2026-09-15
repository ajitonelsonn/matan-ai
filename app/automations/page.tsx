import { Suspense } from "react";
import type { Metadata } from "next";
import { AutomationsPage } from "@/components/pages/AutomationsPage";

export const metadata: Metadata = { title: "Automations" };

export default function Page() {
  return (
    <Suspense>
      <AutomationsPage />
    </Suspense>
  );
}

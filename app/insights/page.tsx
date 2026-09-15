import { Suspense } from "react";
import type { Metadata } from "next";
import { InsightsPage } from "@/components/pages/InsightsPage";

export const metadata: Metadata = { title: "AI Insights" };

export default function Page() {
  return (
    <Suspense>
      <InsightsPage />
    </Suspense>
  );
}

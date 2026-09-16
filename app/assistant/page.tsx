import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantPage } from "@/components/pages/AssistantPage";

export const metadata: Metadata = { title: "AI Assistant" };

export default function Page() {
  return (
    <Suspense>
      <AssistantPage />
    </Suspense>
  );
}

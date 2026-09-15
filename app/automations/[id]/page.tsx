import { Suspense } from "react";
import type { Metadata } from "next";
import { AutomationsPage } from "@/components/pages/AutomationsPage";

export const metadata: Metadata = { title: "Automation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <AutomationsPage initialId={id} />
    </Suspense>
  );
}

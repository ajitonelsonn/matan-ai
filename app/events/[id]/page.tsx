import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsPage } from "@/components/pages/EventsPage";

export const metadata: Metadata = { title: "Event details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <EventsPage initialEventId={id} />
    </Suspense>
  );
}

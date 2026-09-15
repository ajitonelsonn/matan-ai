import { Suspense } from "react";
import type { Metadata } from "next";
import { EventsPage } from "@/components/pages/EventsPage";

export const metadata: Metadata = { title: "Events" };

export default function Page() {
  return (
    <Suspense>
      <EventsPage />
    </Suspense>
  );
}

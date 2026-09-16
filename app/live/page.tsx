import type { Metadata } from "next";
import { Suspense } from "react";
import { LivePage } from "@/components/pages/LivePage";

export const metadata: Metadata = { title: "Live View" };

export default function Page() {
  return (
    <Suspense>
      <LivePage />
    </Suspense>
  );
}

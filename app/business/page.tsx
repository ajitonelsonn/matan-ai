import type { Metadata } from "next";
import { BusinessPage } from "@/components/pages/BusinessPage";

export const metadata: Metadata = { title: "Business" };

export default function Page() {
  return <BusinessPage />;
}

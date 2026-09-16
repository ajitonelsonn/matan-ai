import type { Metadata } from "next";
import { SecurityModesPage } from "@/components/pages/SecurityModesPage";

export const metadata: Metadata = { title: "Security Modes" };

export default function Page() {
  return <SecurityModesPage />;
}

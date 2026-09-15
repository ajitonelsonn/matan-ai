import type { Metadata } from "next";
import { HomeDashboard } from "@/components/pages/HomeDashboard";

export const metadata: Metadata = { title: "Home · Matan AI" };

export default function HomePage() {
  return <HomeDashboard />;
}

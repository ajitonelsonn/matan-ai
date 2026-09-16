import type { Metadata } from "next";
import { BusinessPage } from "@/components/pages/BusinessPage";

export const metadata: Metadata = { title: "Business location" };

export default async function Page({ params }: { params: Promise<{ location: string }> }) {
  const { location } = await params;
  return <BusinessPage initialLocationSlug={location} />;
}

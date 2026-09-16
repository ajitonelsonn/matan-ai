import type { Metadata } from "next";
import { DevicesPage } from "@/components/pages/DevicesPage";

export const metadata: Metadata = { title: "Device" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DevicesPage initialDeviceId={id} />;
}

import type { Metadata } from "next";
import { DevicesPage } from "@/components/pages/DevicesPage";

export const metadata: Metadata = { title: "Devices" };

export default function Page() {
  return <DevicesPage />;
}

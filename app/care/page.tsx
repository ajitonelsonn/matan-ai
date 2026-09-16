import type { Metadata } from "next";
import { CarePage } from "@/components/pages/CarePage";

export const metadata: Metadata = { title: "Care & Family" };

export default function Page() {
  return <CarePage />;
}

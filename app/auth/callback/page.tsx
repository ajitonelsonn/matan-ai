import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallback } from "@/components/auth/AuthCallback";
import { AuthLoadingScreen } from "@/components/auth/AuthGuard";

export const metadata: Metadata = { title: "Signing in" };

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <AuthCallback />
    </Suspense>
  );
}

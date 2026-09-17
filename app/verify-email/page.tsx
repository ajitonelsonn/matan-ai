import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";
import { AuthLoadingScreen } from "@/components/auth/AuthGuard";

export const metadata: Metadata = { title: "Verify email" };

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <VerifyEmailForm />
    </Suspense>
  );
}

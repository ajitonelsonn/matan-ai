import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AuthLoadingScreen } from "@/components/auth/AuthGuard";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

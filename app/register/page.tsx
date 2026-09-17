import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthLoadingScreen } from "@/components/auth/AuthGuard";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <SignUpForm />
    </Suspense>
  );
}

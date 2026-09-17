import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthLoadingScreen } from "@/components/auth/AuthGuard";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <LoginForm />
    </Suspense>
  );
}

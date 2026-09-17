"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { ArrowRight, Mail } from "lucide-react";
import { signInWithEmail } from "@/lib/auth/client";
import { mapAuthError, friendlyAuthError, type FriendlyAuthError } from "@/lib/auth/errors";
import { useAuth } from "./AuthProvider";
import { safeNext, useRedirectIfAuthenticated } from "./AuthGuard";
import { AuthAlert, AuthDivider, AuthLayout, IconInput } from "./AuthLayout";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { PasswordInput } from "./PasswordInput";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh, oauthError } = useAuth();
  const redirecting = useRedirectIfAuthenticated();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<FriendlyAuthError | null>(null);
  const notice = params.get("notice");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError({ code: "AUTH_UNKNOWN", title: "Enter your email and password", message: "" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await signInWithEmail(email, password);
      if (out.status === "confirm_sign_up") {
        router.push(`/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
        return;
      }
      if (out.status === "done") {
        await refresh();
        router.replace(next);
        return;
      }
      setError({ code: "AUTH_UNKNOWN", title: "Additional step required", message: "This account needs a step Matan AI doesn't support yet. Contact support." });
    } catch (err) {
      const f = mapAuthError(err);
      if (f.code === "AUTH_USER_NOT_CONFIRMED") {
        router.push(`/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
        return;
      }
      setError(f);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Matan AI account."
      footer={
        <>
          New to Matan AI?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate aria-busy={busy || redirecting}>
        {notice === "verified" && <AuthAlert tone="success" title="Email verified" message="You can sign in now." />}
        {notice === "password-reset" && <AuthAlert tone="success" title="Password updated" message="Sign in with your new password." />}
        {notice === "oauth-failed" && <AuthAlert {...friendlyAuthError("AUTH_OAUTH_UNAVAILABLE")} />}
        {notice === "signed-out" && <AuthAlert tone="info" title="You're signed out" message="Sign in again to continue." />}
        {oauthError && !error && <AuthAlert {...friendlyAuthError("AUTH_OAUTH_UNAVAILABLE")} />}
        {error && <AuthAlert title={error.title} message={error.message} />}

        <GoogleSignInButton next={next} />
        <AuthDivider />

        <Field label="Email" htmlFor="login-email">
          <IconInput icon={<Mail />} id="login-email" name="email" type="email" inputMode="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput id="login-password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        </Field>
        <div className="flex items-center justify-end -mt-1">
          <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-[13px] font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={redirecting} rightIcon={<ArrowRight className="size-4" />}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

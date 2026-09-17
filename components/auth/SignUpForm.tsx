"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { ArrowRight, Mail, UserRound } from "lucide-react";
import { signUpWithEmail } from "@/lib/auth/client";
import { mapAuthError, type FriendlyAuthError } from "@/lib/auth/errors";
import { safeNext, useRedirectIfAuthenticated } from "./AuthGuard";
import { AuthAlert, AuthDivider, AuthLayout, IconInput } from "./AuthLayout";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { PasswordInput, passwordProblems } from "./PasswordInput";

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirecting = useRedirectIfAuthenticated();
  const next = safeNext(params.get("next"));
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<FriendlyAuthError | null>(null);
  const problems = passwordProblems(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return setError({ code: "AUTH_UNKNOWN", title: "Name and email are required", message: "" });
    if (problems.length) return setError({ code: "AUTH_INVALID_PASSWORD", title: "Password doesn't meet the policy", message: `Add ${problems.join(", ")}.` });
    if (password !== confirm) return setError({ code: "AUTH_UNKNOWN", title: "Passwords don't match", message: "" });
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUpWithEmail(name, email, password);
      router.push(needsConfirmation ? `/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}&sent=1` : `/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError(mapAuthError(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      wide
      title="Create your account"
      subtitle="Matan AI turns Ring events into clear, calm decisions."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate aria-busy={busy || redirecting}>
        {error && <AuthAlert title={error.title} message={error.message} />}
        <GoogleSignInButton label="Sign up with Google" next={next} />
        <AuthDivider />
        <Field label="Full name" htmlFor="su-name">
          <IconInput icon={<UserRound />} id="su-name" name="name" autoComplete="name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Email" htmlFor="su-email">
          <IconInput icon={<Mail />} id="su-email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="su-password" hint={password && problems.length ? `Still needs ${problems.join(", ")}.` : "At least 8 characters with upper & lower case, a number and a symbol."}>
          <PasswordInput id="su-password" name="new-password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" aria-describedby="su-password-hint" />
        </Field>
        <Field label="Confirm password" htmlFor="su-confirm" error={mismatch ? "Passwords don't match." : undefined}>
          <PasswordInput id="su-confirm" name="confirm-password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" aria-invalid={mismatch || undefined} />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={redirecting} rightIcon={<ArrowRight className="size-4" />}>
          Create account
        </Button>
        <p className="text-center text-[12px] text-text-3">We&apos;ll email you a 6-digit code to verify your address.</p>
      </form>
    </AuthLayout>
  );
}

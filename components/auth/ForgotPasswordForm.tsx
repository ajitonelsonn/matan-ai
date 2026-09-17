"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { ArrowRight, Mail } from "lucide-react";
import { completePasswordReset, requestPasswordReset } from "@/lib/auth/client";
import { mapAuthError, type FriendlyAuthError } from "@/lib/auth/errors";
import { maskEmail } from "@/lib/auth/user";
import { AuthAlert, AuthLayout, IconInput } from "./AuthLayout";
import { PasswordInput, passwordProblems } from "./PasswordInput";

export function ForgotPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [stage, setStage] = React.useState<"request" | "confirm">("request");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<FriendlyAuthError | null>(null);
  const problems = passwordProblems(password);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError({ code: "AUTH_UNKNOWN", title: "Enter your email", message: "" });
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
    } catch (err) {
      const f = mapAuthError(err);
      // Don't reveal whether an account exists: unknown users see the same "check your email" step.
      if (f.code !== "AUTH_USER_NOT_FOUND") {
        setError(f);
        setBusy(false);
        return;
      }
    }
    setStage("confirm");
    setBusy(false);
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) return setError({ code: "AUTH_INVALID_CODE", title: "Enter the 6-digit code", message: "" });
    if (problems.length) return setError({ code: "AUTH_INVALID_PASSWORD", title: "Password doesn't meet the policy", message: `Add ${problems.join(", ")}.` });
    if (password !== confirm) return setError({ code: "AUTH_UNKNOWN", title: "Passwords don't match", message: "" });
    setBusy(true);
    setError(null);
    try {
      await completePasswordReset(email, code, password);
      router.replace(`/login?email=${encodeURIComponent(email)}&notice=password-reset`);
    } catch (err) {
      setError(mapAuthError(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={stage === "request" ? "Reset your password" : "Choose a new password"}
      subtitle={stage === "request" ? "We'll email you a 6-digit code." : <>Enter the code sent to <span className="font-medium text-text">{maskEmail(email)}</span> and your new password.</>}
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {stage === "request" ? (
        <form onSubmit={request} className="space-y-4" noValidate aria-busy={busy}>
          {error && <AuthAlert title={error.title} message={error.message} />}
          <Field label="Email" htmlFor="fp-email">
            <IconInput icon={<Mail />} id="fp-email" name="email" type="email" inputMode="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={busy} rightIcon={<ArrowRight className="size-4" />}>
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={finish} className="space-y-4" noValidate aria-busy={busy}>
          {!error && <AuthAlert tone="success" title="Check your inbox" message="If an account exists for this email, a code is on its way." />}
          {error && <AuthAlert title={error.title} message={error.message} />}
          <Field label="Verification code" htmlFor="fp-code">
            <Input id="fp-code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="h-14 text-center text-[24px] font-bold tracking-[0.45em]" />
          </Field>
          <Field label="New password" htmlFor="fp-password" hint={password && problems.length ? `Still needs ${problems.join(", ")}.` : "At least 8 characters with upper & lower case, a number and a symbol."}>
            <PasswordInput id="fp-password" name="new-password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
          </Field>
          <Field label="Confirm new password" htmlFor="fp-confirm" error={confirm && confirm !== password ? "Passwords don't match." : undefined}>
            <PasswordInput id="fp-confirm" name="confirm-password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={busy} rightIcon={<ArrowRight className="size-4" />}>
            Update password
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={() => { setStage("request"); setError(null); }}>
            Use a different email
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

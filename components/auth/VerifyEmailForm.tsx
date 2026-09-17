"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { confirmEmail, resendEmailCode } from "@/lib/auth/client";
import { mapAuthError, type FriendlyAuthError } from "@/lib/auth/errors";
import { maskEmail } from "@/lib/auth/user";
import { safeNext } from "./AuthGuard";
import { AuthAlert, AuthLayout } from "./AuthLayout";

export function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [resent, setResent] = React.useState(params.get("sent") === "1" ? "A verification code was sent to your email." : "");
  const [error, setError] = React.useState<FriendlyAuthError | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.replace(/\D/g, "").length !== 6) return setError({ code: "AUTH_INVALID_CODE", title: "Enter the 6-digit code", message: "" });
    setBusy(true);
    setError(null);
    try {
      await confirmEmail(email, code);
      router.replace(`/login?email=${encodeURIComponent(email)}&notice=verified&next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError(mapAuthError(err));
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email) return setError({ code: "AUTH_UNKNOWN", title: "Enter your email first", message: "" });
    setError(null);
    try {
      await resendEmailCode(email);
      setResent(`A new code was sent to ${maskEmail(email)}.`);
      setCooldown(30);
    } catch (err) {
      setError(mapAuthError(err));
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={email ? <>We sent a 6-digit code to <span className="font-medium text-text">{maskEmail(email)}</span>.</> : "Enter the email you signed up with and the code we sent."}
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate aria-busy={busy}>
        {resent && !error && <AuthAlert tone="success" title="Check your inbox" message={resent} />}
        {error && <AuthAlert title={error.title} message={error.message} />}
        {!params.get("email") && (
          <Field label="Email" htmlFor="ve-email">
            <Input id="ve-email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
        )}
        <Field label="Verification code" htmlFor="ve-code" hint="Codes expire after 24 hours. Check spam if it hasn't arrived.">
          <Input
            id="ve-code"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-[20px] font-semibold tracking-[0.4em]"
          />
        </Field>
        <Button type="submit" fullWidth loading={busy}>
          Verify email
        </Button>
        <Button type="button" variant="ghost" fullWidth onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
      </form>
    </AuthLayout>
  );
}

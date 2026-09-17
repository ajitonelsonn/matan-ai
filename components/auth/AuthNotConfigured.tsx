"use client";

import { ShieldAlert } from "lucide-react";
import { AuthLayout } from "./AuthLayout";

/** Shown instead of the app when the public Cognito env vars are missing. Never lists secret values. */
export function AuthNotConfigured() {
  return (
    <AuthLayout title="Authentication isn't configured" subtitle="Matan AI requires Amazon Cognito before any page can be opened.">
      <div className="rounded-[14px] border border-warning/30 bg-warning/10 p-4 text-sm text-text-2">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="space-y-2">
            <p>Set these public variables in <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">.env</code> and restart the dev server:</p>
            <ul className="list-disc space-y-1 pl-5 font-mono text-[12px]">
              <li>NEXT_PUBLIC_AWS_REGION</li>
              <li>NEXT_PUBLIC_COGNITO_USER_POOL_ID</li>
              <li>NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID</li>
              <li>NEXT_PUBLIC_COGNITO_DOMAIN</li>
            </ul>
            <p className="text-text-3">
              Provision with <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">pnpm cognito:provision</code> or copy the IDs from the Cognito console. See <code className="rounded bg-surface-3 px-1 py-0.5 text-[12px]">docs/COGNITO_AUTH_IMPLEMENTATION.md</code>.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { startGoogleSignIn } from "@/lib/auth/client";
import { authConfig } from "@/lib/auth/config";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1C3.2 21.3 7.3 24 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.2c-1.6 3.3-1.6 7.2 0 10.5l4.1-2.8Z" />
      <path fill="#EA4335" d="M12 4.7c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.1 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4.1 3.1c1-2.9 3.6-5 6.7-5Z" />
    </svg>
  );
}

/** Launches Cognito managed login with the Google identity provider. Hidden until Google is enabled on the pool. */
export function GoogleSignInButton({ label = "Continue with Google", next }: { label?: string; next?: string }) {
  const [busy, setBusy] = React.useState(false);
  if (!authConfig.googleEnabled) return null;
  return (
    <Button
      variant="outline"
      fullWidth
      loading={busy}
      leftIcon={<GoogleMark />}
      onClick={async () => {
        setBusy(true);
        try {
          if (next) sessionStorage.setItem("matan.auth.next", next);
          await startGoogleSignIn();
        } catch {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

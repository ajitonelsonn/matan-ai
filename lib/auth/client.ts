"use client";

/**
 * Thin wrappers over AWS Amplify Auth (Cognito User Pools). Runs only in the
 * browser. Tokens stay inside Amplify's storage; page components only ever see
 * the MatanUser model.
 */
import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  resendSignUpCode as amplifyResendSignUpCode,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  signInWithRedirect,
} from "aws-amplify/auth";
import { authConfig, isAuthConfigured, oauthRedirects } from "./config";
import type { MatanUser } from "./user";

let configured = false;

/** Idempotent Amplify configuration for the current origin. Safe to call many times. */
export function configureAuth() {
  if (configured || typeof window === "undefined" || !isAuthConfigured) return isAuthConfigured;
  const { signIn, signOut } = oauthRedirects(window.location.origin);
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: authConfig.userPoolId,
        userPoolClientId: authConfig.userPoolClientId,
        signUpVerificationMethod: "code",
        loginWith: {
          email: true,
          ...(authConfig.domain
            ? {
                oauth: {
                  domain: authConfig.domain,
                  scopes: ["openid", "email", "profile"],
                  redirectSignIn: [signIn],
                  redirectSignOut: [signOut],
                  responseType: "code" as const,
                  providers: authConfig.googleEnabled ? (["Google"] as const) : [],
                },
              }
            : {}),
        },
        userAttributes: { email: { required: true }, name: { required: true } },
      },
    },
  });
  configured = true;
  return true;
}

/**
 * Build the MatanUser from the ID token claims (works for both SRP and OAuth
 * sessions). `fetchUserAttributes` needs the `aws.cognito.signin.user.admin`
 * scope, which hosted-login (Google) access tokens don't have, so it is only a
 * best-effort supplement.
 */
export async function currentMatanUser(): Promise<MatanUser | null> {
  try {
    const u = await getCurrentUser();
    let claims: Record<string, unknown> = {};
    try {
      const session = await fetchAuthSession();
      claims = (session.tokens?.idToken?.payload as Record<string, unknown> | undefined) ?? {};
    } catch {
      /* offline or expired - fall through */
    }
    let attrs: Record<string, string | undefined> = {};
    if (!claims.email) {
      try {
        attrs = (await fetchUserAttributes()) as Record<string, string | undefined>;
      } catch {
        /* not permitted for OAuth tokens; claims are enough */
      }
    }
    const str = (k: string) => (typeof claims[k] === "string" ? (claims[k] as string) : undefined) ?? attrs[k];
    const identities = JSON.stringify(claims.identities ?? attrs.identities ?? "");
    const username = str("cognito:username") ?? u.username ?? "";
    const provider: MatanUser["provider"] = /google/i.test(identities) || /^google_/i.test(username) ? "google" : "cognito";
    return {
      id: u.userId,
      email: str("email") ?? u.signInDetails?.loginId ?? "",
      name: str("name") ?? str("given_name"),
      pictureUrl: str("picture"),
      provider,
    };
  } catch {
    return null;
  }
}

export type SignInOutcome = { status: "done" } | { status: "confirm_sign_up" } | { status: "other"; step: string };

export async function signInWithEmail(email: string, password: string): Promise<SignInOutcome> {
  let res;
  try {
    res = await amplifySignIn({ username: normalizeEmail(email), password });
  } catch (e) {
    // An unverified account's email alias doesn't resolve yet - retry with the derived username
    // so Cognito can tell us "not confirmed" instead of "not authorized".
    const name = (e as { name?: string }).name ?? "";
    if (!/NotAuthorizedException|UserNotFoundException/.test(name)) throw e;
    try {
      res = await amplifySignIn({ username: await usernameFor(email), password });
    } catch (e2) {
      const n2 = (e2 as { name?: string }).name ?? "";
      if (/UserNotConfirmedException/.test(n2)) throw e2;
      throw e;
    }
  }
  if (res.isSignedIn) return { status: "done" };
  const step = res.nextStep.signInStep;
  if (step === "CONFIRM_SIGN_UP") return { status: "confirm_sign_up" };
  return { status: "other", step };
}

/**
 * The pool uses email as an *alias* (username + email alias), so the Cognito
 * username must not look like an email - and the alias only resolves once the
 * email is verified. We derive an opaque, deterministic username from the
 * normalized email so registration, code confirmation, resend and
 * "unverified sign-in" all work from any device without storing state.
 */
export async function usernameFor(email: string) {
  const data = new TextEncoder().encode(`matan-ai:${normalizeEmail(email)}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return `u-${Array.from(new Uint8Array(hash)).slice(0, 20).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const res = await amplifySignUp({ username: await usernameFor(email), password, options: { userAttributes: { email: normalizeEmail(email), name: name.trim() } } });
  return { needsConfirmation: res.nextStep.signUpStep === "CONFIRM_SIGN_UP" };
}

export async function confirmEmail(email: string, code: string) {
  const res = await amplifyConfirmSignUp({ username: await usernameFor(email), confirmationCode: code.trim() });
  return res.isSignUpComplete;
}

export async function resendEmailCode(email: string) {
  await amplifyResendSignUpCode({ username: await usernameFor(email) });
}

export async function requestPasswordReset(email: string) {
  const res = await amplifyResetPassword({ username: normalizeEmail(email) });
  return res.nextStep.resetPasswordStep;
}

export async function completePasswordReset(email: string, code: string, newPassword: string) {
  await amplifyConfirmResetPassword({ username: normalizeEmail(email), confirmationCode: code.trim(), newPassword });
}

export async function signOutEverywhere() {
  await amplifySignOut();
}

export async function startGoogleSignIn(customState?: string) {
  await signInWithRedirect({ provider: "Google", customState });
}

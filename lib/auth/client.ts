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

export async function currentMatanUser(): Promise<MatanUser | null> {
  try {
    const u = await getCurrentUser();
    let attrs: Record<string, string | undefined> = {};
    try {
      attrs = (await fetchUserAttributes()) as Record<string, string | undefined>;
    } catch {
      /* attributes may be unavailable offline; keep the identity */
    }
    const identities = attrs.identities ?? "";
    return {
      id: u.userId,
      email: attrs.email ?? u.signInDetails?.loginId ?? "",
      name: attrs.name ?? attrs.given_name,
      pictureUrl: attrs.picture,
      provider: /google/i.test(identities) ? "google" : "cognito",
    };
  } catch {
    return null;
  }
}

export type SignInOutcome = { status: "done" } | { status: "confirm_sign_up" } | { status: "other"; step: string };

export async function signInWithEmail(email: string, password: string): Promise<SignInOutcome> {
  const res = await amplifySignIn({ username: email.trim().toLowerCase(), password });
  if (res.isSignedIn) return { status: "done" };
  const step = res.nextStep.signInStep;
  if (step === "CONFIRM_SIGN_UP") return { status: "confirm_sign_up" };
  return { status: "other", step };
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const res = await amplifySignUp({ username: email.trim().toLowerCase(), password, options: { userAttributes: { email: email.trim().toLowerCase(), name: name.trim() } } });
  return { needsConfirmation: res.nextStep.signUpStep === "CONFIRM_SIGN_UP" };
}

export async function confirmEmail(email: string, code: string) {
  const res = await amplifyConfirmSignUp({ username: email.trim().toLowerCase(), confirmationCode: code.trim() });
  return res.isSignUpComplete;
}

export async function resendEmailCode(email: string) {
  await amplifyResendSignUpCode({ username: email.trim().toLowerCase() });
}

export async function requestPasswordReset(email: string) {
  const res = await amplifyResetPassword({ username: email.trim().toLowerCase() });
  return res.nextStep.resetPasswordStep;
}

export async function completePasswordReset(email: string, code: string, newPassword: string) {
  await amplifyConfirmResetPassword({ username: email.trim().toLowerCase(), confirmationCode: code.trim(), newPassword });
}

export async function signOutEverywhere() {
  await amplifySignOut();
}

export async function startGoogleSignIn(customState?: string) {
  await signInWithRedirect({ provider: "Google", customState });
}

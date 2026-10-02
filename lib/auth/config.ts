/**
 * Public Cognito configuration (safe for the browser): pool id, app client id,
 * managed-login domain, region. No secrets - IAM keys and the Google client
 * secret never appear here.
 */
export const authConfig = {
  region: process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1",
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "",
  userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID ?? "",
  /** e.g. matan-ai-xxxx.auth.us-east-1.amazoncognito.com (no scheme) */
  domain: (process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
  /** Set to "true" once the Google identity provider is configured on the pool. */
  googleEnabled: process.env.NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED === "true",
};

export const isAuthConfigured = Boolean(authConfig.userPoolId && authConfig.userPoolClientId);

/** Routes that never require authentication (the docs are public so anyone can read the project). */
export const PUBLIC_ROUTES = ["/login", "/register", "/verify-email", "/forgot-password", "/auth/callback", "/docs"];

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** OAuth redirect URLs for the current origin (localhost in dev; the deployed origin in production). */
export function oauthRedirects(origin: string) {
  return { signIn: `${origin}/auth/callback`, signOut: `${origin}/` };
}

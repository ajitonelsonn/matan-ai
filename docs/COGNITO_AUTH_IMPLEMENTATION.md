# Amazon Cognito Authentication — Implementation Notes

Matan AI requires a signed-in user before any dashboard page, Demo/Real mode data, Ring session or Bedrock analysis is loaded. Authentication is handled by **Amazon Cognito User Pools** through **AWS Amplify Auth v6** (`aws-amplify` 6.20). Scope of this milestone: authentication only (email + password, Google via Cognito managed login). No DynamoDB, SES, EventBridge or account linking.

## Status

| Item | State |
| --- | --- |
| App code (provider, guard, pages, forms, user menu, sign-out) | ✅ done, typechecks, builds, 14 tests pass |
| Provisioning script (`pnpm cognito:provision`) | ✅ written, idempotent, dry-run verified |
| Cognito User Pool `MatanAI-Users` / app client `matan-ai-web` / managed-login domain | ⏳ **blocked** — see "AWS permission blocker" |
| Google identity provider | ⏳ pending real `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| `.env` public identifiers | ⏳ written automatically by the provisioning script |

### AWS permission blocker

The only AWS identity available in this environment is IAM user **`BedrockAPIKey-djsb`** (account `5115********`, `us-east-1`). It is scoped to Bedrock. The first Cognito call failed:

```
✖ AWS operation failed: cognito-idp:ListUserPools
  AccessDeniedException: User: arn:aws:iam::********5893:user/BedrockAPIKey-djsb is not authorized to perform:
  cognito-idp:ListUserPools on resource: * because no identity-based policy allows the cognito-idp:ListUserPools action
```

To unblock, attach a **least-privilege inline policy** to that user (or supply another identity) with exactly these actions — do **not** attach `AdministratorAccess`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "cognito-idp:ListUserPools", "cognito-idp:CreateUserPool", "cognito-idp:DescribeUserPool", "cognito-idp:UpdateUserPool",
      "cognito-idp:ListUserPoolClients", "cognito-idp:CreateUserPoolClient", "cognito-idp:DescribeUserPoolClient", "cognito-idp:UpdateUserPoolClient",
      "cognito-idp:CreateUserPoolDomain", "cognito-idp:DescribeUserPoolDomain",
      "cognito-idp:CreateIdentityProvider", "cognito-idp:DescribeIdentityProvider", "cognito-idp:UpdateIdentityProvider",
      "cognito-idp:TagResource"
    ],
    "Resource": "*"
  }]
}
```

Alternatively create the pool by hand in the Cognito console (settings below) and paste the four public IDs into `.env`.

## Provisioning

```bash
pnpm cognito:inspect              # STS identity + existing pools (never prints secrets)
pnpm cognito:provision --dry-run  # plan only
pnpm cognito:provision            # create/reuse, then write NEXT_PUBLIC_* to .env
```

`scripts/cognito-provision.mjs` is idempotent (reuses by name) and creates:

- **User Pool `MatanAI-Users`** — sign-in with email (case-insensitive), email auto-verified with a 6-digit code, required attributes `email` + `name`, password policy 8+ chars with upper/lower/number/symbol, recovery via verified email, Cognito default email sender, deletion protection on, **Essentials** tier (the lowest tier that supports managed login v2).
- **App client `matan-ai-web`** — public (no secret), auth flows `USER_SRP_AUTH`, `USER_AUTH`, `REFRESH_TOKEN_AUTH`; OAuth `code` flow with PKCE, scopes `openid email profile`; callback `http://localhost:3000/auth/callback`, logout `http://localhost:3000/`; IdPs `COGNITO` (+ `Google` once configured); `PreventUserExistenceErrors` on; token revocation on; access/id tokens 60 min, refresh 30 days. Extra origins: `MATAN_APP_ORIGINS="http://localhost:3000,https://app.example.com"`.
- **Domain** `matan-ai-<poolsuffix>.auth.us-east-1.amazoncognito.com` with **managed login v2**.
- **Google IdP** only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present in `.env` (attribute mapping email/name/picture/username←sub). Otherwise it prints the redirect URI to register in Google Cloud Console: `https://<domain>/oauth2/idpresponse`. Re-run the script after adding the credentials; it also flips `NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED=true`.

## Environment variables

Public (browser-safe identifiers, in `.env` and `.env.example`):

```
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=
NEXT_PUBLIC_COGNITO_DOMAIN=            # no scheme
NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED=false
```

Server-only (never `NEXT_PUBLIC_`): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. `.env` is git-ignored; nothing in this milestone logs or returns these.

When the public variables are missing, every protected route renders the **"Authentication isn't configured"** screen (lists the variable names only) instead of the dashboard.

## Architecture

```
ThemeProvider > ToastProvider > ConfirmProvider
  > AuthProvider                        (Cognito session, Hub listener)
    > AuthGuard
        public route  → page as-is (login/register/verify-email/forgot-password/auth/callback)
        protected     → loading screen → redirect /login?next=… | AuthenticatedApp
          AuthenticatedApp = ExperienceProvider > AppDataProvider > AppShell + ModeSelection + modals + SplashGate
```

- `AuthProvider` sits **above** `ExperienceProvider`, so Demo/Real mode, the first-run chooser, Ring polling and dashboard data mount only for an authenticated user. The Ring server session (HttpOnly cookie) and the Bedrock pipeline are untouched.
- `lib/auth/config.ts` — public config, `isAuthConfigured`, `PUBLIC_ROUTES`, `oauthRedirects(origin)` (callbacks derive from `window.location.origin`, so dev on :3000 and any deployed origin both work as long as they're registered on the client).
- `lib/auth/client.ts` — idempotent `configureAuth()` (`Amplify.configure`) and thin wrappers: `signInWithEmail`, `signUpWithEmail`, `confirmEmail`, `resendEmailCode`, `requestPasswordReset`, `completePasswordReset`, `signOutEverywhere`, `startGoogleSignIn`, `currentMatanUser`.
- `lib/auth/user.ts` — `MatanUser { id = Cognito sub, email, name?, pictureUrl?, provider: "cognito" | "google" }`. `sub` is the stable key for future per-user storage (never email).
- `lib/auth/errors.ts` — maps Amplify/Cognito exceptions to friendly copy (`NotAuthorizedException` → "email or password is incorrect", `UserNotConfirmedException` → verify flow, `UsernameExistsException`, `InvalidPasswordException`, `CodeMismatchException`, `ExpiredCodeException`, `LimitExceeded/TooManyRequests`, network, OAuth cancel/unavailable, `ResourceNotFoundException` → not configured). Raw AWS messages never reach the UI.
- `components/auth/AuthGuard.tsx` — `AuthGuard`, `AuthLoadingScreen` ("Checking your Matan AI session…" with the Matan loader), `safeNext()` (same-origin paths only; never bounces back to an auth page), `useRedirectIfAuthenticated()`.
- Pages: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/auth/callback` (each wrapped in `Suspense`, rendered in `AuthLayout` with logo + `ThemeToggle`, no sidebar).
- `components/auth/AuthCallback.tsx` — Amplify performs the PKCE code exchange on load; the page waits for the `signInWithRedirect` Hub event, restores the destination saved in `sessionStorage("matan.auth.next")`, and falls back to `/login?notice=oauth-failed` on `error=` params, Hub failure, or a 15 s timeout.
- `ProfileMenu` (Topbar) shows the Cognito name/email/avatar with an Email/Google badge; **Sign out** calls `signOut()`, shows "Signing you out…", and lands on `/login?notice=signed-out`. Settings → Account card gained "Sign-in method", "Change Password" (email users → reset-code flow) and a confirmed Sign out.
- `AppDataProvider` overlays the Cognito identity (`id`, `name`, `firstName`, `email`, `avatarUrl`) on the shell user model so Home greeting, Topbar and Settings show the real user; role/plan/location still come from mock data (no profile store yet).

## User flows

| Flow | Path |
| --- | --- |
| Sign up | `/register` → `signUp` (attrs email+name) → `/verify-email?email=…&sent=1` → `confirmSignUp` → `/login?notice=verified` |
| Sign in | `/login` → `signIn` → `refresh()` → `next` (default `/`) → first-run Demo/Real chooser if never chosen |
| Unverified sign-in | `UserNotConfirmedException` / `CONFIRM_SIGN_UP` step → `/verify-email` (resend with 30 s cooldown) |
| Forgot password | `/forgot-password` → `resetPassword` → code + new password → `/login?notice=password-reset`. Unknown emails see the same "check your inbox" step (no enumeration). |
| Google | `signInWithRedirect({provider:"Google"})` → Cognito managed login → `/auth/callback` → destination. Button hidden until `NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED=true`. |
| Protected route while signed out | `/events?range=7d` → `/login?next=%2Fevents%3Frange%3D7d` → back to `/events?range=7d` after sign-in |
| Signed-in user visits `/login` | redirected to `next` or `/` |
| Sign out | tokens cleared by Amplify, app state unmounted, `/login?notice=signed-out`; Demo/Real preference (`localStorage matan.experience.mode`) is kept on the device |

Accessibility: labelled inputs, `autocomplete` (`username`, `current-password`, `new-password`, `email`, `name`, `one-time-code`), `inputmode="numeric"` for codes, show/hide password with `aria-pressed`, `role="alert"` errors, `aria-busy` forms, focus-visible styles from the design system, dark/light theme on every auth page.

## Verification performed

- `tsc --noEmit` clean; `pnpm build` clean (routes `/login`, `/register`, `/verify-email`, `/forgot-password`, `/auth/callback` static); `pnpm test` 14/14.
- Playwright against a production build **without** pool IDs: `/` and `/events` show the not-configured screen (no sidebar, no data fetch), all auth pages render, theme toggle works, empty submit shows inline validation, zero console errors.
- Playwright against a build with **placeholder** pool IDs: `/events?range=7d` → `/login?next=%2Fevents%3Frange%3D7d`; weak password blocked client-side with policy hint; Cognito error mapped to friendly copy; "Continue with Google" redirects to `https://<domain>/oauth2/authorize?…response_type=code&identity_provider=Google&scope=openid+email+profile&code_challenge_method=S256&redirect_uri=…/auth/callback`.
- **Not yet run** (needs the real pool): sign-up email delivery, code verification, sign-in, refresh persistence, Google round-trip, sign-out end-to-end. Run these once `pnpm cognito:provision` succeeds — the spec's §40 matrix.

## Security notes

- No AWS secret, Google client secret or Ring token is in source, docs, logs or API responses. No `NEXT_PUBLIC_` secret variables exist.
- Tokens live in Amplify's browser storage (default `localStorage`) — Cognito ID/access/refresh tokens for the SPA client, which has no secret; PKCE protects the code flow.
- The app client sets `PreventUserExistenceErrors=ENABLED`; the UI additionally uses identical copy for wrong-email vs wrong-password.
- `safeNext` rejects absolute URLs and protocol-relative paths (no open redirect).
- Server API routes (`/api/ring/*`, `/api/matan/*`) are still protected only by the UI gate and the HttpOnly Ring session cookie; server-side JWT verification is deliberately out of scope for this milestone and should be the next hardening step before any public deployment.

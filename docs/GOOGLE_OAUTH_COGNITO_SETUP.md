# Setting up Google Sign-In with Amazon Cognito for Matan AI

This guide walks through connecting **Sign in with Google** to the Matan AI user pool, end to end: Google Cloud Console → Amazon Cognito → the app's `.env`. It also lists the exact mistakes we hit while setting it up and how each one shows up, so you can recognise them quickly.

Time needed: about 15 minutes, plus up to a few minutes for Google settings to propagate.

> **Never commit secrets.** The Google *client secret*, AWS keys and Cognito tokens must only ever live in the git-ignored `.env` (or Cognito itself). Only the `NEXT_PUBLIC_*` identifiers are safe for the browser.

---

## How the flow works

```
Matan AI (/login)  ──"Continue with Google"──▶  Cognito managed login
        ▲                                             │  redirects to Google
        │                                             ▼
   /auth/callback  ◀── Cognito issues tokens ◀──  Google consent  ──▶  https://<cognito-domain>/oauth2/idpresponse
```

1. The app calls Amplify `signInWithRedirect({ provider: "Google" })`, which opens `https://<cognito-domain>/oauth2/authorize?identity_provider=Google&…`.
2. Cognito forwards the user to Google. Google asks for consent and redirects to Cognito's `/oauth2/idpresponse` with a code.
3. Cognito exchanges the code with Google (using the client ID + secret you store in Cognito), reads the profile (`name`, `email`, `picture`) via the **People API**, creates/updates a `google_<sub>` user in the pool, and finally redirects to the app's `/auth/callback` with Cognito's own code.
4. Amplify exchanges that code (PKCE) for Cognito tokens. The app reads the user's `email`, `name`, `picture` from the **ID token**.

You will need three values from your Cognito pool (already in `.env` as `NEXT_PUBLIC_COGNITO_*`):

| Placeholder used below | Where to find it |
| --- | --- |
| `<cognito-domain>` | Cognito → your pool → *Branding → Domain* (e.g. `xxxx.auth.us-east-1.amazoncognito.com`, no `https://`) |
| `<pool-id>` | Cognito → your pool → *Overview* (`us-east-1_XXXXXXXXX`) |
| `<client-id>` | Cognito → your pool → *App clients* → your client |

Tip: the domain can also be read from the pool's public metadata: `https://cognito-idp.<region>.amazonaws.com/<pool-id>/.well-known/openid-configuration` → `authorization_endpoint`.

---

## Part 1 — Google Cloud Console

Open https://console.cloud.google.com/ and pick (or create) a project, e.g. **Matan AI**. Do **all** of the following in that same project.

### 1.1 Consent screen ("Google Auth Platform → Branding / Audience")

1. **Branding**: App name `Matan AI`, user-support email, developer contact email → Save.
2. **Audience**: User type **External**. While the app is in *Testing* status only listed test users can sign in — add every Gmail address you'll test with under **Test users**. (Click **Publish app** before opening it to the public.)
3. **Data access / Scopes**: the defaults are enough — `openid`, `…/auth/userinfo.email`, `…/auth/userinfo.profile` are non-sensitive and added automatically.

### 1.2 Enable the People API

Cognito reads the user's name and photo through the People API. If it is not enabled the federated sign-in fails with a blank Cognito error page.

- **APIs & Services → Library** → search **Google People API** → **Enable**
  (direct link: https://console.cloud.google.com/apis/library/people.googleapis.com)

### 1.3 Create the OAuth client

**APIs & Services → Credentials → + Create credentials → OAuth client ID**

| Field | Value |
| --- | --- |
| Application type | **Web application** |
| Name | `Matan AI Cognito` |
| Authorized JavaScript origins | `https://<cognito-domain>` (optional, harmless) |
| **Authorized redirect URIs** | `https://<cognito-domain>/oauth2/idpresponse` ← **exact**, `https`, no trailing slash |

Click **Create**. A dialog shows the **Client ID** (ends in `.apps.googleusercontent.com`, ~72 characters) and the **Client secret** (`GOCSPX-…`). Copy both **in full** — a truncated client ID is the #1 cause of failure (see Troubleshooting).

Put them in the project's `.env` (server-only, git-ignored):

```
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Google notes that credential changes "may take 5 minutes to a few hours to take effect" — in practice a few minutes.

---

## Part 2 — Amazon Cognito

You can do this with the console (steps below) or, if your IAM identity has `cognito-idp:*IdentityProvider` / `*UserPoolClient` permissions, with `pnpm cognito:provision` (it reads `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from `.env` and does 2.1–2.2 for you).

### 2.1 Add Google as an identity provider

Cognito → your user pool → **Authentication → Social and external providers → Add identity provider → Google**

| Field | Value |
| --- | --- |
| Client ID | the full Google client ID |
| Client secret | the Google client secret |
| Authorized scopes | `openid email profile` |
| Attribute mapping | `email` ← `email`, `name` ← `name`, `picture` ← `picture` (`username` ← `sub` is preset) |

Save. After saving, re-open it and confirm the client ID is complete (ends with `.apps.googleusercontent.com`).

### 2.2 Enable Google on the app client ← the step the console wizard skips

Cognito → your pool → **Applications → App clients → your client → Login pages → Edit**

| Setting | Value |
| --- | --- |
| **Identity providers** | tick **Google** *and* keep *Cognito user pool directory* |
| Allowed callback URLs | `http://localhost:3000/auth/callback` (add your production origin's `/auth/callback` too) |
| Allowed sign-out URLs | `http://localhost:3000/` (and production `/`) |
| OAuth grant types | Authorization code grant |
| OpenID Connect scopes | `openid`, `email`, `profile` (untick `phone` if the wizard added it) |

Save changes.

> If "Identity providers" shows only *Cognito user pool directory*, Google sign-in **will fail after the Google consent screen**, even though the redirect to Google works. This was the root cause of our blank `/error` page.

### 2.3 Attribute permissions (verify only)

**App clients → your client → Attribute permissions**: `email`, `name`, `picture` must be **writable**. The wizard normally grants this; if any is read-only, edit and enable Write.

---

## Part 3 — Matan AI app

1. In `.env` set:
   ```
   NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED=true
   ```
   (the other `NEXT_PUBLIC_COGNITO_*` values should already be there — see `docs/COGNITO_AUTH_IMPLEMENTATION.md`).
2. Restart the dev server (`pnpm dev`). The **Continue with Google** button on `/login` and `/register` becomes active (it renders disabled with a hint while the flag is `false`).
3. Test: http://localhost:3000/login → **Continue with Google** → Google account picker → consent → "Signing you in…" → Demo/Real chooser → dashboard. The profile menu (top-right) shows your Google name, email, photo and a **Google** badge.

No code changes are needed; the app already:
- requests `openid email profile` with the PKCE code flow,
- restores the page you came from (`/login?next=…`) after the Google round-trip,
- reads `email` / `name` / `picture` from the Cognito **ID token** (`fetchUserAttributes()` is not permitted for hosted-login tokens because they lack the `aws.cognito.signin.user.admin` scope),
- maps OAuth failures to a friendly notice on `/login`.

---

## Troubleshooting

Cognito's managed-login `/error` page returns an **empty HTTP 400** ("This page isn't working" in Chrome) with no `error_description`, so you have to reason from *where* the flow stopped.

| Where it stops | What you see | Cause | Fix |
| --- | --- | --- | --- |
| On **Google**, before consent | `Error 401: invalid_client` — "The OAuth client was not found" | Client ID in Cognito is wrong or **truncated** (missing `.apps.googleusercontent.com`) | Re-paste the full client ID in Cognito → Google IdP |
| On **Google**, before consent | `Error 400: redirect_uri_mismatch` | `https://<cognito-domain>/oauth2/idpresponse` isn't in the client's Authorized redirect URIs (or was added to a different OAuth client, or hasn't propagated yet) | Add it to the *same* client whose ID Cognito uses; wait a few minutes |
| On **Google**, before consent | "Access blocked: app has not completed verification" / account not allowed | App in Testing and the Gmail isn't a test user | Add the address under *Audience → Test users* |
| On **Cognito** `…/error?…code=…&iss=https://accounts.google.com` (blank 400) | Google issued a code, Cognito rejected the sign-in | Most often: **Google not ticked under the app client's Identity providers**. Also: People API disabled; client secret in Cognito doesn't match; a required attribute (`name`) not mapped; existing native user with the same email in an email-alias pool | Check 2.2 first, then 1.2, 2.1, 2.3 |
| Back in the app, `/login?notice=oauth-failed` | Amplify's code exchange failed or timed out | Callback URL not allowed on the client, or clock/network issue | Confirm `http://localhost:3000/auth/callback` is an Allowed callback URL |
| Signed in, but **name/email/avatar blank** | Profile menu shows badges only | App tried `fetchUserAttributes()` with an OAuth token | Already fixed: profile comes from the ID token. If the photo is missing, ensure the `picture` mapping exists, then sign out/in once |

### Diagnosing from outside (no AWS permissions needed)

- **Which client ID Cognito sends to Google** — follow one redirect:
  `curl -s -o /dev/null -w "%{redirect_url}\n" "https://<cognito-domain>/oauth2/authorize?client_id=<client-id>&response_type=code&scope=openid+email&identity_provider=Google&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback"` → inspect `client_id=` in the Google URL (should end with `.apps.googleusercontent.com`).
- **Is `profile` scope allowed on the client** — same call with `scope=openid+email+profile`; a redirect back to the app with `error=invalid_scope` means it isn't.
- **Are the Google credentials valid** — POST to `https://oauth2.googleapis.com/token` with the ID/secret and a bogus code: `invalid_grant` = credentials fine, `invalid_client` = mismatch. (Do this from a script that reads `.env`; never paste the secret into a terminal history.)
- **Rule Google out entirely** — temporarily add `http://localhost:4321/cb` to the OAuth client's redirect URIs and replay the code flow locally (token exchange → `openidconnect.googleapis.com/v1/userinfo` → `people.googleapis.com/v1/people/me`). If all three succeed, the problem is in Cognito.

### Account linking (not implemented)

A Google user and an email/password user with the same address are **two different users** in Cognito. In an email-alias pool the second one to arrive fails to sign in. Linking them requires a Pre sign-up Lambda calling `AdminLinkProviderForUser`; this is intentionally out of scope for the current milestone.

---

## Going to production

- Add `https://<your-domain>/auth/callback` and `https://<your-domain>/` to the app client's callback / sign-out URLs (the app derives redirect URLs from `window.location.origin`).
- **Publish** the Google consent screen (Audience → Publish app) so any Google account can sign in; Google may require verification if you add sensitive scopes (we don't).
- Rotate the Google client secret if it was ever displayed/shared; update it in Cognito and `.env`.
- Keep `GOOGLE_CLIENT_SECRET` out of any `NEXT_PUBLIC_*` variable, logs, screenshots and docs.

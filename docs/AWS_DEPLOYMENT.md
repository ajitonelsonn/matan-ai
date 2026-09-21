# AWS Amplify deployment — runtime notes and production fixes

MATAN AI runs on **AWS Amplify Hosting (Next.js SSR compute)** with a compute role for AWS access (no long-lived keys). Two production symptoms appeared after the first deployment; both had the same cause — the server was written for one long-lived Node process, while Amplify SSR compute is a **stateless fleet of short-lived Lambda instances**.

## Symptom 1 — stored events shown, but no S3 media requested

**Observed:** Events page lists stored events; DevTools shows *no* request to `/api/matan/media/...`; CloudWatch shows `dynamodb_hydrated` for analyses, notifications, events, care and devices — but never for `media`.

**Root cause:** Amplify exposes console environment variables (and Secrets) to the **build** only; the SSR runtime does not receive them unless the build writes them into `.env.production`. `lib/aws/s3.ts` read `process.env.S3_MEDIA_BUCKET` and found nothing, so `isS3Configured()` was false → `hydrateMedia()` returned before its log line → `hasMediaSync()` was false → events were served without `imageUrl` / `videoUrl` → the browser had nothing to request. DynamoDB kept working because the table name and region have code defaults and credentials come from the compute role. IAM was never the problem. The same gap silently disabled `SES_FROM_EMAIL`, the SMTP fallback and `APP_BASE_URL`.

**Fix (commit `ac3af68`):**
- `amplify.yml` build phase appends allow-listed server variables to `.env.production` before `pnpm run build`:
  `S3_MEDIA_BUCKET, DYNAMODB_TABLE_NAME, SES_FROM_EMAIL, SES_CONFIGURATION_SET, APP_BASE_URL, EMAIL_PROVIDER, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_PASSWORD, BEDROCK_MODEL_ID, MATAN_AI_MONTHLY_TOKEN_BUDGET, RING_SESSION_SECRET`.
  Nothing starting with `AWS_` and no `NEXT_PUBLIC_S3_*` is written; the browser never learns the bucket name.
- `lib/aws/s3.ts` reads the bucket lazily.
- `hydrateUserScope` logs one safe `runtime_config` line per process (`{ s3: true/false, ses, smtp, ringSessionSecret, appBaseUrl, dynamoTable }` — names/booleans only), so a misconfigured runtime is visible in CloudWatch immediately.

## Symptom 2 — Ring connects, then any refresh shows "SESSION EXPIRED"

**Root cause:** the Ring Playground token was held only in process memory (`globalThis.__matanRing.sessions`) keyed by an HttpOnly cookie id. The next request lands on a different Lambda instance (or a cold start) that has never seen that id → no session → *expired*, although the token is still valid. Locally one `pnpm dev` process keeps the map, which is why it only failed in deployment.

**Fix (commit `ac3af68`):** the session is now **sealed into the HttpOnly/Secure cookie itself** — AES-256-GCM with a key derived from `RING_SESSION_SECRET` (`lib/ring/session-seal.ts`, chunked under the 4 KB cookie limit). Any instance can restore it (`ring_session_restored` log); the in-memory map is now only a cache. Properties kept:
- browser JavaScript can never read the token (HttpOnly), and it is still never written to DynamoDB, S3, logs or responses;
- tampering or a different secret yields *no session*, not an error;
- discovered-device **metadata** (names, capabilities, status — no token) is persisted per user as `RING_DISCOVERED` so the Add-device dialog works on every instance;
- without `RING_SESSION_SECRET` the code falls back to the old memory-only behaviour and logs `ring_session_secret_missing` once.

## Symptom 3 — auto-analysis shows "AI unavailable" / stuck at "Capturing evidence"

**Observed (compute logs):** `matan_auto_queued` inside a 166 ms request, then nothing until the next request wakes the instance: `ring_snapshot_failed: TimeoutError`, later `matan_ai_bedrock_error … MATAN_AI_TIMEOUT`, `matan_auto_failed`. The list said *AI unavailable* while the detail panel said *Capturing evidence* (two instances, two memories). No `AccessDenied` — Bedrock and IAM were fine.

**Root cause:** the auto-analysis pipeline ran as fire-and-forget background work *after* the sync response, and the alert email was fire-and-forget after the analysis response. Lambda freezes the instance as soon as a response is sent, so the abort timers fire on the next wake-up. In addition the scheduler's watermark/queue and the in-flight/failure marks lived in memory, so every new instance behaved like a first sync and showed a different state.

**Fix (commit below):**
- The sync only **records pending event ids**, persisted per user with the watermark and rate window (`SK=AUTO_STATE`).
- The browser drives execution: while the overview reports `autoPending > 0`, it calls **`POST /api/matan/auto/step`**, which analyzes one event fully inside that request (Ring media → Nova → decision → DynamoDB/S3 → alert email, all awaited), then repeats. Each step is well under Amplify's 30 s response limit for snapshot analysis.
- `notifyForIntelligence` is awaited inside the pipeline (manual and automatic).
- Analysis failures are persisted (`SK=AIFAIL#<eventId>`) and hydrated with analyses, so all instances show the same *AI unavailable* state until a manual retry; the browser overlays *analyzing* on the event it is currently stepping.

## Symptom 4 — analysis completes, "Notification could not be sent"

**Observed:** `email_provider_failed: SES_ACCESS_DENIED` and `runtime_config … smtpPassword: false`.

**Root causes:** (a) the compute role had no `ses:SendEmail` / `ses:SendRawEmail` on the sender identity **and** the configuration set (SES v2 authorizes both); (b) an Amplify *Secret* is not injected into the build environment, so `SMTP_PASSWORD` never reached `.env.production` and the SMTP fallback was unavailable.

**Fix (configuration only):**
- Add to `MatanAI-Amplify-ComputeRole`:
  `ses:SendEmail`, `ses:SendRawEmail` on `arn:aws:ses:us-east-1:<account-id>:identity/<sending-domain>` and `arn:aws:ses:us-east-1:<account-id>:configuration-set/matan-ai` (plus `identity/<recipient>` while SES is in sandbox).
- Provide `SMTP_PASSWORD` as a regular Amplify environment variable (rotated Gmail app password) so the build can copy it into the private server bundle; the runtime log then shows `smtpPassword: true`.

## Amplify configuration checklist

1. **Add `RING_SESSION_SECRET`** (Environment variables or Secrets; 32+ random characters, e.g. `openssl rand -base64 48`). Rotating it simply signs everyone out of Ring.
2. Keep the existing variables (`S3_MEDIA_BUCKET`, `SES_*`, `SMTP_*`, `APP_BASE_URL`, `BEDROCK_MODEL_ID`, `NEXT_PUBLIC_COGNITO_*`). `SMTP_PASSWORD` must be a regular environment variable (Amplify Secrets are not visible to the build); it is copied into the private server build only.
3. Do **not** add `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`; the compute role provides credentials and Lambda sets `AWS_REGION`.
4. Redeploy `main`.
5. Cognito app client: the production callback/sign-out URLs (`https://main.<app>.amplifyapp.com/auth/callback`, `/login`) must be listed; Google OAuth client must have the Cognito domain redirect URI.

## Production verification

| Check | Expected |
| --- | --- |
| CloudWatch after first request | `runtime_config` with `s3: true`, `ses: true`, `smtp: true`, `smtpPassword: true` (Secrets reached the build), `ringSessionSecret: true` |
| Sign in → Events | `dynamodb_hydrated` lines now include `kind: 'media'` |
| Events with a stored snapshot | DevTools: `GET /api/matan/media/<eventId>.jpg` → `200 image/jpeg`; thumbnails and the detail image render |
| Event with a clip | `GET /api/matan/media/<eventId>.mp4` → `200 video/mp4` |
| Connect Ring → hard refresh several times | banner stays *Connected · Session mm:ss*; logs show `ring_session_restored` on other instances |
| Wait past 30 min | banner shows *session expired* (correct — the token really expired) |
| Settings → Send test alert | email arrives via SES (or SMTP fallback while SES is in sandbox) |
| Home → Send Report | `POST /api/matan/report` → `sent` |
| Media route without token | `401` |
| Trigger a Playground simulation | logs: `matan_auto_queued` → `POST /api/matan/auto/step` → `matan_ai_escalation` / `matan_auto_analyzed` in the **same** request; email sent; the event shows *AI analysis complete* within ~20 s |

## Files
`amplify.yml`, `lib/aws/s3.ts`, `lib/auth/scope.ts`, `lib/ring/session.ts`, `lib/ring/session-seal.ts`, `app/api/ring/refresh/route.ts`, `tests/ring-session-seal.test.ts`, `.env.example`, `lib/matan/auto.ts`, `lib/matan/store.ts`, `lib/matan/pipeline.ts`, `lib/ring/overview.ts`, `app/api/matan/auto/step/route.ts`, `components/layout/AppDataProvider.tsx`, `lib/data/get-data-source.ts`.

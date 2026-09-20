# Email Notifications (Amazon SES + SMTP fallback) — Implementation Notes

Matan AI emails the signed-in user when a Matan analysis finishes and the decision clears the user's chosen **alert level**. Email is transactional only, sent **server-side** through **Amazon SES v2** (configuration set `matan-ai`) with an **SMTP fallback** (nodemailer) while the SES account is still in Sandbox. Demo/mock data never emails.

```
Ring event ─▶ Nova Pro analysis ─▶ Matan Decision Engine (final) ─▶ Notification service
                                                                        ├─ gate: Ring event · email channel on · valid address · priority ≥ alert level
                                                                        ├─ idempotency: DynamoDB NOTIFICATION#{eventId}#EMAIL
                                                                        ├─ content: branded HTML + text, inline logo + analyzed snapshot (S3)
                                                                        └─ transport: Amazon SES ──(sandbox/IAM/transient failure)──▶ SMTP
```

## Status (all implemented)

| Area | State |
| --- | --- |
| SES v2 client, `Content.Simple` (text + HTML) or `Content.Raw` (with inline images), always via configuration set `matan-ai` | ✅ `lib/aws/ses.ts` |
| SMTP fallback via nodemailer, pure provider-selection rules | ✅ `lib/matan/email-transport.ts`, `lib/matan/email-provider.ts` |
| Notification service + pure, unit-tested flow (gate, content, idempotency) | ✅ `lib/matan/notifications.ts`, `lib/matan/notification-email.ts` |
| Hooked once at the analysis finalize point → manual **and** automatic analyses | ✅ `lib/matan/pipeline.ts` |
| Decision Engine high-priority email rule wired to user settings | ✅ `lib/matan/analysis.ts` (`emailRuleEnabled`) |
| Per-user recipient + alert level in `USER#{sub}/SETTINGS`; Settings UI (address modal, alert level, *Send test alert*) | ✅ `components/pages/SettingsPage.tsx` |
| Test-alert endpoint (authenticated, user-scoped, 1/min) | ✅ `POST /api/matan/notifications/test` |
| Branded email template with inline logo and the analyzed snapshot | ✅ matches `ilu-pages/email.png` |
| Scripts `pnpm ses:check`, `pnpm email:check [recipient]` | ✅ |
| Unit tests: `tests/notifications.test.ts` (10), `tests/email-provider.test.ts` (3) | ✅ 31/31 total |
| Verified sending domain `matanai.<your-domain>` (DKIM), sender `alerts@…` | ✅ verified in SES |
| SES production access | ⏳ requested (support case open); SMTP fallback covers unverified recipients meanwhile |

## Files

| File | Purpose |
| --- | --- |
| `lib/aws/ses.ts` | Server-only SESv2 client. `sendEmail()` chooses `Simple` or `Raw` (attachments → MIME composed with nodemailer's MailComposer). Safe error codes `SES_ACCESS_DENIED / SES_MESSAGE_REJECTED / SES_THROTTLED / SES_NETWORK / SES_CONFIGURATION_ERROR / SES_ERROR`. |
| `lib/matan/email-transport.ts` | `sendWithFallback()`: SES → SMTP. SMTP transporter (`SMTP_*`), error codes `SMTP_AUTH / SMTP_REJECTED / SMTP_NETWORK / SMTP_CONFIGURATION_ERROR / SMTP_ERROR`. |
| `lib/matan/email-provider.ts` | Pure `chooseFallback(failed, code, order, configured)` — which provider to try next. |
| `lib/matan/notification-email.ts` | Pure: `emailPrefs`, `meetsAlertLevel`, `shouldEmail`, `buildEventEmail` (HTML + text), `notifyByEmail` (orchestration with injected deps). No AWS imports → unit-testable. |
| `lib/matan/notifications.ts` | Wires the flow to the signed-in user: settings, DynamoDB records, media loader (logo + snapshot), transport. `notifyForIntelligence()`, `sendTestAlert()`. |
| `lib/matan/pipeline.ts` | Calls `notifyForIntelligence(event, intelligence)` after the decision is final (fire-and-forget). |
| `lib/matan/analysis.ts` | `emailRuleEnabled()` feeds the Decision Engine's `highPriorityEmailRule`. |
| `lib/types/index.ts` | `SettingsData.notifications.emailAddress?`, `alertLevel?`. |
| `app/api/matan/notifications/test/route.ts` | Test alert endpoint. |
| `components/pages/SettingsPage.tsx` | Notifications tab: *Alert email address*, *Alert level*, *Send test alert*. |
| `scripts/ses-check.mjs`, `scripts/email-check.mjs` | Diagnostics (never print secrets). |
| `public/brand/matan-ai-logo-160.png` | 28 KB logo embedded in emails. |

## Environment

```
# Amazon SES (primary) — server-only
SES_FROM_EMAIL=alerts@<verified sending domain>
SES_CONFIGURATION_SET=matan-ai
APP_BASE_URL=http://localhost:3000        # links in emails; never derived from request headers

# Fallback — server-only
EMAIL_PROVIDER=auto                        # auto (SES → SMTP) | ses | smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<mailbox>
SMTP_PASSWORD=<app password>
SMTP_FROM=<mailbox or alias>
```

No `NEXT_PUBLIC_*` variables. `.env` is git-ignored; `.env.example` carries placeholders only.

IAM (least privilege, no `AmazonSESFullAccess`):

```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": [
    "arn:aws:ses:us-east-1:<account-id>:identity/<verified-sender-or-domain>",
    "arn:aws:ses:us-east-1:<account-id>:configuration-set/matan-ai"
  ]
}
```

SES v2 authorizes `SendEmail` against **both** the identity **and** the configuration set; omitting the configuration-set ARN produced `AccessDeniedException … on resource …:configuration-set/matan-ai` (our first failure). In Sandbox the *recipient* is also evaluated as an identity (`… on resource …:identity/<recipient>`).

## When an email is sent (gate)

`shouldEmail(event, intelligence, settings)` — all must hold:

1. `event.source === "ring"` — Demo/mock data never emails (Demo Mode also never runs the pipeline).
2. `settings.notifications.channels.email` is on.
3. `settings.notifications.emailAddress` is a valid address (normalized lower-case).
4. `decision.priority` ≥ `settings.notifications.alertLevel`.

**Alert level** (Settings → Notifications → Alert level) is a minimum decision priority; the Decision Engine itself is untouched:

| Level | Emails these decision priorities | Typical use |
| --- | --- | --- |
| `high` (default) | high | real households — only when it matters |
| `medium` | medium, high | more alerts |
| `low` | low, medium, high | everything notable |
| `all` | normal, low, medium, high — **every completed analysis** | Ring simulator / demos (Playground live-view sessions are "normal") |

Decision priorities come from the engine: **normal** = nothing of concern (live-view sessions, single daytime motion, animals) · **low** (e.g. delivery) · **medium** (person/doorbell at night, repeated unusual activity) · **high** (repeated person/motion at night with good confidence). The engine's `action: "email"` (high + email rule) is produced only when the user has the email channel on with a valid address (`emailRuleEnabled()`); this rule was a `false` placeholder from the Bedrock milestone and is now live.

Recipient and level are resolved **server-side from the caller's own partition** (`USER#{sub}/SETTINGS`); nothing in a request can choose another user's address. Background auto-analysis runs inside the same user scope, so it emails the right person.

## Idempotency

```
PK = USER#{sub}
SK = NOTIFICATION#{eventId}#EMAIL
{ status: "pending" | "sent" | "failed", messageId?, sentAt?, to?, provider?: "ses" | "smtp", code? }
```

`claim` = `PutItem` with `attribute_not_exists(PK)` → only one worker (manual click, auto-analysis, re-sync) can own an event. `pending`/`sent` → `duplicate`, nothing sent. `failed` → retried on the next analysis. Re-analysis of the same event therefore never emails twice.

## Transport and fallback

```
sendWithFallback(n)
  1. Amazon SES   — SES_FROM_EMAIL, ConfigurationSetName=matan-ai
                    Simple (text+HTML) or Raw MIME when inline attachments are present
  2. SMTP         — only when SES fails with SES_MESSAGE_REJECTED / SES_ACCESS_DENIED /
                    SES_CONFIGURATION_ERROR / SES_THROTTLED / SES_NETWORK / SES_ERROR
                    and SMTP_* is configured (EMAIL_PROVIDER=auto)
```

- `EMAIL_PROVIDER=ses` or `smtp` forces one provider; SMTP is always the last link, its failure ends the chain.
- Logs: `email_provider_fallback { provider, code, next }` on fallback, `email_provider_failed` when nothing is left. The delivery record and `email_notification_sent` carry `provider`.
- Gmail SMTP needs an App Password (2-step verification), `smtp.gmail.com:587`; Gmail caps ~500 mails/day and sends from the Gmail identity — a stop-gap until SES leaves Sandbox, after which SES simply succeeds first.

## Email content

Branded, table-based HTML (renders in Gmail/Outlook) plus a plain-text alternative. Structure, top to bottom:

1. **Header** — logo · MATAN AI / SEE A SAFER TOMORROW · "AI for Safer Communities".
2. **Kicker + title + time card** — "Security Alert" (high) / "Activity Alert" (low–medium) / "Activity Update" (normal); event title; date/time in Asia/Dili.
3. **Snapshot Matan AI analyzed** (inline, with capture time and device caption) beside **Device / Event / Time / Priority** cards (priority colour-coded).
4. **✨ What Matan AI saw** (up to 4 observations) and **💡 AI Summary**.
5. **Open Matan AI** button (`APP_BASE_URL/events/<id>`) and **View Full Clip** when a clip exists (`?media=clip`).
6. **Footer** — logo, "Smarter Monitoring for a Safer Timor-Leste 🇹🇱", opt-out note, copyright.

Subjects: `Matan AI Alert — <title>` for high decisions, `Matan AI Update — <title>` otherwise.

Inline images are `cid:` attachments — `matan-logo` (the 160 px PNG) and `matan-snapshot` (the S3 snapshot read through the user's own media store, ≤ 2.5 MB). No storage URL, login link, Ring/Cognito token or AWS value ever appears; all text is HTML-escaped. If media can't be loaded the email still goes out with a placeholder panel.

## Test alert

Settings → Notifications → **Send test alert** → `POST /api/matan/notifications/test` (Cognito-authenticated via `userRoute`, no recipient accepted, 1 per minute per user through the `NOTIFICATION#TEST-<minute>#EMAIL` record). Builds a synthetic high-priority Ring event and runs the exact production path (gate, template with logo, idempotency, SES → SMTP). Responses: `sent {messageId, provider}` · `skipped {reason}` 400 · `duplicate` 429 · `failed {code}` 502; the UI names the provider that delivered and explains Sandbox rejections.

## Error handling and logging

- SES/SMTP failures never affect the analysis response or Ring sync: `notifyForIntelligence` is fire-and-forget and `notifyByEmail` never throws.
- `email_notification_sent { eventId, messageId, provider }` · `email_notification_skipped { eventId, reason }` · `email_notification_failed { eventId, code }` · `email_snapshot_unavailable { eventId, code }`.
- Never logged: AWS keys, SMTP password, Ring/Cognito tokens, email bodies; script output masks addresses.

## Verification

- `tsc --noEmit` ✓ · `pnpm build` ✓ · `pnpm test` **31/31** — recipient validation; gating per alert level (full priority × level matrix, demo never emails); template content, escaping, cid references, clip button; false → no send; true → one send to the user's address; duplicate → one email; per-user deps; SES failure recorded and retried without throwing; media failure still sends; provider fallback rules.
- Live: `pnpm ses:check` ✓ (SES via `matan-ai`, MessageId returned, delivered from the domain sender) · `pnpm email:check <unverified recipient>` ✓ (SES `AccessDenied` in Sandbox → SMTP → Gmail `250 OK`) · branded template with inline logo + snapshot delivered via SMTP · in-app *Send test alert* → `email_notification_sent … provider: "smtp"`.
- Real Mode: analyses run and the gate logs the correct outcome (`email_notification_skipped: decision (normal/none) is below alert level "high"` for a Playground live-view session). With alert level **All**, every completed analysis is emailed.

## Sandbox → production (what we learned)

- **Sandbox**: 200 emails/day, 1/s, recipients must be verified identities (also enforced through IAM as `identity/<recipient>`). Hence the SMTP fallback for real users until approval.
- **Request production access** is disabled in the console until a **sending domain** is verified — a verified email address alone is not enough.
- Domain identity: SES → Get set up → *Verify sending domain* → a subdomain is fine (`matanai.<your-domain>`) → Easy DKIM → 3 CNAME records at the DNS host → *Verified* / DKIM *Successful*. Then set `SES_FROM_EMAIL=alerts@<domain>` and add `…:identity/<domain>` to the IAM statement (no code change).
- Production request form: Transactional, website URL, acknowledgement; AWS follows up in a support case asking for volume, list management, bounce/complaint handling and a sample email — answered with the details above (hackathon context, opt-in per user, one email per event, `matan-ai` configuration set metrics).
- Optional deliverability records: `TXT <domain> "v=spf1 include:amazonses.com ~all"`, `TXT _dmarc.<domain> "v=DMARC1; p=none;"`.
- After approval: recipients no longer need verification; set `EMAIL_PROVIDER=ses` to retire SMTP explicitly.

## Not implemented (later milestones)

Bounce/complaint event publishing from the configuration set (auto-disable an address), SNS/SQS/EventBridge/Lambda, inbound email, custom MAIL FROM, templates stored in SES, bulk/marketing mail.

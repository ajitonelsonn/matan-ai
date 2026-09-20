# Amazon SES Notifications — Implementation Notes

Matan AI emails the signed-in user when the **existing Decision Engine** says so (`decision.action === "email"`, i.e. the high-priority automation rule). Email is transactional only, sent server-side through **Amazon SES v2** with the `matan-ai` configuration set, and never for Demo/mock data.

## Status

| Item | State |
| --- | --- |
| `lib/aws/ses.ts` server-only SESv2 client, `Content.Simple` text + HTML, configuration set on every send | ✅ |
| Notification service (`lib/matan/notifications.ts`) + pure flow (`lib/matan/notification-email.ts`) | ✅ |
| Hooked at the single finalize point (`runMatanPipeline`) → manual and automatic analyses | ✅ |
| Recipient from `USER#{sub}/SETTINGS` (`notifications.emailAddress`, `channels.email`) + Settings UI row | ✅ |
| Idempotency `NOTIFICATION#{eventId}#EMAIL` in DynamoDB (claim → send → sent/failed) | ✅ |
| Unit tests (`tests/notifications.test.ts`, 8) | ✅ 26/26 total |
| `pnpm ses:check` | ✅ passes (MessageId returned, mail delivered) after adding the configuration-set ARN to IAM |

### IAM note (resolved)

```
✖ ses:SendEmail on resource arn:aws:ses:us-east-1:<account-id>:configuration-set/matan-ai
  AccessDeniedException for the app IAM user
```

This was the initial failure. SES v2 authorizes `SendEmail` against **both** the sender identity ARN **and** the configuration-set ARN when `ConfigurationSetName` is given. The current policy only lists the identity. A diagnostic send *without* the configuration set succeeded (MessageId returned, mail delivered), so credentials, verified sender and Sandbox recipient are fine.

Fix — add the configuration set to the same statement (least privilege, no `AmazonSESFullAccess`):

```json
{
  "Effect": "Allow",
  "Action": ["ses:SendEmail", "ses:SendRawEmail"],
  "Resource": [
    "arn:aws:ses:us-east-1:<account-id>:identity/<verified-sender>",
    "arn:aws:ses:us-east-1:<account-id>:configuration-set/matan-ai"
  ]
}
```

Then run `pnpm ses:check` (sends one test email to the verified sender) — it prints the SES MessageId.

## Flow

```
Ring event → Nova Pro analysis → Matan decision (final, in runMatanPipeline)
   → notifyForIntelligence(event, intelligence)           (fire-and-forget, never throws)
      → shouldEmail: event.source === "ring" && decision.action === "email"
                     && settings.notifications.channels.email && valid settings.notifications.emailAddress
      → DynamoDB claim  PK=USER#{sub} SK=NOTIFICATION#{eventId}#EMAIL  { status: "pending" }   (attribute_not_exists)
      → SES SendEmail (from SES_FROM_EMAIL, ConfigurationSetName=matan-ai, text + HTML)
      → record { status: "sent", messageId, sentAt, to }   |  { status: "failed", code }
```

- **Decision reuse**: no second risk system. `"notify"` stays in-app; only `"email"` sends mail.
- **Recipient**: resolved server-side from the caller's own settings partition; nothing in the request can choose it. Sandbox note: the address must be a verified identity (e.g. the same Gmail as the sender) until production access is granted.
- **Idempotency**: `pending`/`sent` records short-circuit re-processing (re-sync, re-analysis, manual + auto racing); a `failed` record is retried on the next analysis.
- **Failures**: `SES_ACCESS_DENIED / SES_MESSAGE_REJECTED / SES_THROTTLED / SES_NETWORK / SES_CONFIGURATION_ERROR / SES_ERROR` are logged as `{ event: "email_notification_failed", eventId, code }` and recorded; the analysis response and Ring sync are unaffected.
- **Logging**: `email_notification_sent { eventId, messageId }`, `email_notification_skipped { eventId, reason }`, `email_notification_failed { eventId, code }`. No addresses in success logs beyond the masked script output; never tokens or bodies.
- **Demo Mode**: `shouldEmail` rejects any event whose `source !== "ring"`; Demo Mode also never runs the pipeline. Unit tests use fakes — nothing in `pnpm test` talks to SES.

## Decision rule wiring
The Decision Engine's high-priority email rule (`ctx.highPriorityEmailRule`) was a placeholder left `false` by the Bedrock milestone. It is now `emailRuleEnabled()` = the signed-in user's `channels.email` is on **and** a valid `emailAddress` is set — so a *high* decision (person/motion/unusual activity + Night Mode or quiet hours + ≥2 related events in 30 min, confidence not low) becomes `action: "email"` only for users who opted in.

## Alert level (user setting)
`settings.notifications.alertLevel` = `"high"` (default) · `"medium"` · `"low"` is the **minimum decision priority** that is emailed: *low* → low+medium+high, *medium* → medium+high, *high* → high only. `"normal"` decisions (nothing of concern - e.g. a live-view session) are never emailed at any level. The Decision Engine is untouched; only the threshold is user-configurable (Settings → Notifications → Alert level). Subjects read "Matan AI Alert — …" for high decisions and "Matan AI Update — …" otherwise.

## Test alert
Settings → Notifications → **Send test alert** → `POST /api/matan/notifications/test` (authenticated, user-scoped, no recipient accepted, 1 per minute per user via the `NOTIFICATION#TEST-<minute>#EMAIL` idempotency record). It builds a synthetic high-priority Ring event and runs the *same* `notifyByEmail` path (gate, content, SES sender + `matan-ai` configuration set). Responses: `sent {messageId}` · `skipped {reason}` (400) · `duplicate` (429) · `failed {code}` (502). The UI explains `SES_MESSAGE_REJECTED` as the Sandbox verified-recipient rule.

## Email content
Subject `Matan AI Alert — <event title>`; body lists Event, Device, Time (Asia/Dili), Priority, the analysis summary as "Reason", up to three observations, and an **Open Matan AI** link built from `APP_BASE_URL` (`/events/<id>`), never from request headers. HTML is escaped. No Ring/Cognito tokens, AWS values or storage URLs.

## Environment
```
SES_FROM_EMAIL=<address on the verified sending domain>   # server-only
SES_CONFIGURATION_SET=matan-ai
APP_BASE_URL=http://localhost:3000
```
No `NEXT_PUBLIC_*` additions.

## Settings
`SettingsData.notifications.emailAddress?: string` (new, optional) alongside the existing `channels.email` toggle. Settings → Notifications → **Alert email address** row opens a small modal (prefilled with the Cognito email); saving sets the address and turns the email channel on (empty = off). Stored per user in `SETTINGS`.

## Verification
- `tsc --noEmit` ✓ · `pnpm build` ✓ · `pnpm test` 26/26 ✓ (recipient validation, decision gating incl. demo, content + escaping, false→no send, true→one send to the user's address, duplicate→one email, per-user deps, SES failure recorded/retried without throwing).
- Live: `pnpm ses:check` ✓ — SendEmail via `matan-ai` returned a MessageId and the mail was delivered to the verified Gmail.
- Pending: the browser flow (Real Mode → high-priority event → email arrives → re-analyze → no duplicate).

## Fallback transport: SMTP via nodemailer

While SES production access is pending (Sandbox: only verified recipients), the app falls back to SMTP so real users still get alerts.

```
notifyByEmail → sendWithFallback()            lib/matan/email-transport.ts
   1. Amazon SES  (SES_FROM_EMAIL, configuration set matan-ai)
   2. SMTP        (SMTP_HOST/PORT/USER/PASSWORD/FROM via nodemailer)  ← only if SES fails with
                   SES_MESSAGE_REJECTED / SES_ACCESS_DENIED / SES_CONFIGURATION_ERROR / SES_THROTTLED / SES_NETWORK / SES_ERROR
```

- `EMAIL_PROVIDER=auto` (default: SES then SMTP) · `ses` (SES only) · `smtp` (SMTP only).
- Provider choice is a pure rule (`lib/matan/email-provider.ts`, unit-tested). The delivery record and the `email_notification_sent` log carry `provider: "ses" | "smtp"`; a fallback logs `email_provider_fallback { provider, code, next }`.
- Content, gating, idempotency and the recipient rule are identical for both providers. SMTP errors map to `SMTP_AUTH / SMTP_REJECTED / SMTP_NETWORK / SMTP_CONFIGURATION_ERROR / SMTP_ERROR`; the password is never logged.
- Gmail SMTP needs an **App Password** (2-step verification on) - `smtp.gmail.com:587`, `SMTP_FROM` must be that Gmail account or an alias it can send as. Gmail caps sending (~500/day) and is a stop-gap, not the production path.
- `pnpm email:check [recipient]` walks the same chain and prints which provider delivered. Verified: SES → AccessDenied for an unverified recipient → SMTP → Gmail `250 OK`.
- Once SES production access is granted, SES will succeed first and SMTP is simply never used; set `EMAIL_PROVIDER=ses` to retire it explicitly.

## Going to production (Sandbox → production access)

What we learned setting this up:

- **Sandbox** (default for new accounts): 200 emails/day, 1/s, and *recipients must be verified identities*. IAM is even evaluated against the recipient identity ARN (`ses:SendEmail … on resource identity/<recipient>`), so unverified users simply can't be emailed. The app records these as `SES_MESSAGE_REJECTED` / `SES_ACCESS_DENIED` and carries on.
- The console's **Request production access** button stays disabled until a **sending domain** is verified. Verifying an email address alone is not enough.
- Domain identity: SES → Get set up → *Verify sending domain* → Domain (a subdomain is fine, e.g. `matanai.<your-domain>`) → Easy DKIM → publish the 3 CNAMEs at the DNS host → status *Verified*, DKIM *Successful*. Then request production access (Transactional, app URL, use case, bounce/complaint handling).
- After the domain is verified, set `SES_FROM_EMAIL` to any address on it (e.g. `alerts@matanai.<your-domain>`) and add `arn:aws:ses:<region>:<account-id>:identity/<domain>` to the IAM statement next to the configuration set. No code change - `pnpm ses:check` confirms.
- Optional deliverability records: `TXT <domain> "v=spf1 include:amazonses.com ~all"` and `TXT _dmarc.<domain> "v=DMARC1; p=none;"`.
- Once production access is granted the recipient restrictions disappear; each user's alert address just needs to be a real mailbox.

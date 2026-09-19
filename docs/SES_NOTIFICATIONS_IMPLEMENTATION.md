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
| `pnpm ses:check` | ⚠️ blocked by IAM — see below |

### IAM blocker (exact operation)

```
✖ ses:SendEmail on resource arn:aws:ses:us-east-1:<account-id>:configuration-set/matan-ai
  AccessDeniedException for the app IAM user
```

SES v2 authorizes `SendEmail` against **both** the sender identity ARN **and** the configuration-set ARN when `ConfigurationSetName` is given. The current policy only lists the identity. A diagnostic send *without* the configuration set succeeded (MessageId returned, mail delivered), so credentials, verified sender and Sandbox recipient are fine.

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

## Email content
Subject `Matan AI Alert — <event title>`; body lists Event, Device, Time (Asia/Dili), Priority, the analysis summary as "Reason", up to three observations, and an **Open Matan AI** link built from `APP_BASE_URL` (`/events/<id>`), never from request headers. HTML is escaped. No Ring/Cognito tokens, AWS values or storage URLs.

## Environment
```
SES_FROM_EMAIL=<verified sender>      # server-only
SES_CONFIGURATION_SET=matan-ai
APP_BASE_URL=http://localhost:3000
```
No `NEXT_PUBLIC_*` additions.

## Settings
`SettingsData.notifications.emailAddress?: string` (new, optional) alongside the existing `channels.email` toggle. Settings → Notifications → **Alert email address** row opens a small modal (prefilled with the Cognito email); saving sets the address and turns the email channel on (empty = off). Stored per user in `SETTINGS`.

## Verification
- `tsc --noEmit` ✓ · `pnpm build` ✓ · `pnpm test` 26/26 ✓ (recipient validation, decision gating incl. demo, content + escaping, false→no send, true→one send to the user's address, duplicate→one email, per-user deps, SES failure recorded/retried without throwing).
- Live: `SendEmail` without configuration set ✓ delivered; with `matan-ai` ✗ IAM (above).
- Pending after the IAM fix: `pnpm ses:check`, then the browser flow (Real Mode → high-priority event → email arrives → re-analyze → no duplicate).

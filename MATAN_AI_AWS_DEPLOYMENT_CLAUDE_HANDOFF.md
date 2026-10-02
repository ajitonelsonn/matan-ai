# Matan AI — AWS Deployment & Production Troubleshooting Handoff

## Purpose

This document is for Claude Code to analyze the deployed AWS production version of **Matan AI**, identify why Ring media/images are not currently being displayed through the S3-backed media path, and recommend the smallest safe fix.

The application is already deployed successfully to AWS Amplify.

---

## 1. Project

**Application:** Matan AI  
**Repository:** `ajitonelsonn/matan-ai`  
**Production branch:** `main`

The application integrates:

- Ring Developer Playground / Ring Partner APIs
- Amazon Bedrock Nova Pro
- Amazon Cognito
- Amazon DynamoDB
- Amazon S3
- Amazon SES
- Gmail SMTP fallback
- AWS Amplify Hosting / SSR Compute

Latest known Real Mode audit commit before deployment:

```text
db1d19d
```

---

## 2. Local Build

Local versions:

```text
Node.js v22.22.2
pnpm 10.6.4
```

Git status was clean and `main` was synchronized with GitHub.

Amplify initially failed because:

```text
pnpm: command not found
```

The fix was to use Corepack and the exact pnpm version.

Current `amplify.yml`:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - corepack prepare pnpm@10.6.4 --activate
        - pnpm install
    build:
      commands:
        - pnpm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - .next/cache/**/*
      - node_modules/**/*
```

The Amplify build now succeeds.

---

## 3. AWS Amplify Production

Amplify application:

```text
matan-ai
```

App ID:

```text
d3q4rxuohabv2i
```

Production branch:

```text
main
```

Production URL:

```text
https://main.d3q4rxuohabv2i.amplifyapp.com
```

Current deployment status:

```text
Deployed
```

The production homepage loads successfully.

---

## 4. Amplify IAM

The application has an SSR Compute role:

```text
MatanAI-Amplify-ComputeRole
```

It is configured as the Amplify app's **Default Compute role**.

The role is intended to let the Next.js SSR runtime access the application's AWS resources without long-lived AWS access keys.

The intended permissions are restricted to:

```text
Bedrock:
  bedrock:InvokeModel

DynamoDB:
  GetItem
  PutItem
  UpdateItem
  DeleteItem
  Query

S3:
  GetObject
  PutObject
  ListBucket

SES:
  SendEmail
  SendRawEmail
```

DynamoDB resource:

```text
arn:aws:dynamodb:us-east-1:511558195893:table/MatanAI
```

S3 object resource:

```text
arn:aws:s3:::matan-ai-media-c71e17d3/*
```

S3 bucket resource:

```text
arn:aws:s3:::matan-ai-media-c71e17d3
```

Region:

```text
us-east-1
```

SES identity:

```text
alerts@matanai.ecolafaek.xyz
```

Claude should inspect the live attached IAM policy before assuming every permission is present.

---

## 5. Amplify Environment Variables

Configured production variables include:

```text
BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
MATAN_AI_MONTHLY_TOKEN_BUDGET=5000000
DYNAMODB_TABLE_NAME=MatanAI
S3_MEDIA_BUCKET=matan-ai-media-c71e17d3
SES_FROM_EMAIL=<verified SES sender>
SES_CONFIGURATION_SET=matan-ai
APP_BASE_URL=https://main.d3q4rxuohabv2i.amplifyapp.com

EMAIL_PROVIDER=auto
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<SMTP account>
SMTP_FROM=<SMTP sender>
```

Cognito variables:

```text
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<existing pool>
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=<existing client>
NEXT_PUBLIC_COGNITO_DOMAIN=<existing Cognito domain>
NEXT_PUBLIC_COGNITO_GOOGLE_ENABLED=true
```

The Gmail SMTP password is stored as an Amplify Secret:

```text
SMTP_PASSWORD
```

The actual secret is intentionally not included here.

Do not expose or print any secrets.

---

## 6. AWS_REGION Detail

Amplify rejected manually adding:

```text
AWS_REGION
```

because environment variable names beginning with `AWS` are reserved.

The application already has a server-side region fallback to:

```text
us-east-1
```

and the browser-safe variable is:

```text
NEXT_PUBLIC_AWS_REGION=us-east-1
```

Do not blindly rename the server-side variable. Inspect the actual AWS SDK configuration first.

---

## 7. Security

The local `.env` is not tracked:

```bash
git ls-files .env
```

returned no output.

Production must NOT use long-lived AWS access keys in Amplify environment variables.

Do NOT add:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

to Amplify.

The original Gmail SMTP App Password was accidentally exposed during setup and should be considered compromised. It should be revoked/rotated; the replacement should only exist in Amplify Secrets.

---

## 8. S3 Media Storage

Bucket:

```text
matan-ai-media-c71e17d3
```

Region:

```text
us-east-1
```

The bucket is private.

Block Public Access remains enabled.

The browser is intentionally NOT supposed to access S3 directly.

Media flow:

```text
Ring snapshot/clip
      ↓
Matan analysis pipeline
      ↓
S3 PutObject
      ↓
DynamoDB MEDIA#{eventId}
      ↓
Authenticated media API
      ↓
S3 GetObject
      ↓
Browser
```

S3 keys:

```text
users/{cognitoSub}/events/{eventId}/snapshot/snapshot-{eventId}.jpg

users/{cognitoSub}/events/{eventId}/clip/clip-{eventId}.mp4
```

Media metadata is stored in DynamoDB:

```text
PK = USER#{sub}
SK = MEDIA#{eventId}
```

The metadata contains the media ID, type, content type, S3 key, size, timestamps, and optional clip length.

---

## 9. Protected Media API

The intended API is:

```text
GET /api/matan/media/{eventId}.jpg
GET /api/matan/media/{eventId}.mp4
```

The server:

1. validates Cognito authentication;
2. obtains the user identity from the verified Cognito `sub`;
3. loads that user's media metadata;
4. validates that the S3 key belongs to that user;
5. calls S3 `GetObject`;
6. streams the object back to the browser.

Expected responses:

```text
401 AUTH_REQUIRED / AUTH_INVALID
400 MEDIA_BAD_REQUEST
404 MEDIA_NOT_FOUND
502 S3_ACCESS_DENIED / S3_NETWORK / S3_ERROR
500 S3_CONFIGURATION_ERROR
200 media bytes
```

The frontend uses a protected-media hook because normal `<img>` and `<video>` elements cannot send the required Cognito Authorization header.

Intended frontend flow:

```text
<img>/<video>
      ↓
useProtectedMedia
      ↓
fetch('/api/matan/media/...')
      + Cognito access token
      ↓
Matan media route
      ↓
S3 GetObject
      ↓
Object URL
      ↓
Browser
```

---

## 10. Existing S3 Verification

Before deployment, the S3 implementation passed:

```text
pnpm s3:check
```

and real integration tests.

Tests covered:

- upload snapshot
- upload clip
- correct content type
- deterministic re-upload
- restart/re-hydration
- retrieve media
- missing media
- cross-user isolation
- cleanup/deletion

The production media route also had tests for:

```text
no token → 401
forged token → 401
```

So the S3 implementation was already verified locally/integration-test-wise.

The current investigation is specifically about the deployed production path.

---

## 11. Ring Real Mode

Real Mode uses the actual Ring Developer Playground.

No fake Ring event generator is used.

Real Playground testing previously passed:

- Motion
- Package
- Vehicle
- Animal

Ring tokens are:

- server-side;
- held in an HttpOnly session;
- not stored in DynamoDB;
- not stored in S3;
- not stored in localStorage;
- not exposed to browser JavaScript.

When the Ring token expires, the UI intentionally shows:

```text
REAL · SESSION EXPIRED
No Ring Playground session.
Reconnect Ring
```

Stored Matan/DynamoDB data can remain visible after Ring session expiration.

Do not "fix" this by pretending that the Ring session is connected.

---

## 12. Production Evidence

CloudWatch logs from the Amplify SSR Compute runtime show successful DynamoDB hydration:

```text
{ event: 'dynamodb_hydrated', kind: 'analyses', count: 40 }

{ event: 'dynamodb_hydrated', kind: 'notifications', count: 28 }

{ event: 'dynamodb_hydrated', kind: 'events', count: 61 }

{ event: 'dynamodb_hydrated', kind: 'care', rules: 2, stored: true }

{ event: 'dynamodb_hydrated', kind: 'devices', count: 1 }
```

This proves the production Next.js runtime is successfully reaching DynamoDB through the Compute role.

---

## 13. Current Production Problem

The production Events page displays stored events.

However, the expected S3-backed event image is not currently displayed.

Chrome DevTools Network was inspected while viewing Events.

The screenshot showed:

```text
REAL · SESSION EXPIRED
No Ring Playground session.
Reconnect Ring
```

The Events list still displayed stored events:

```text
All Events (60)
```

Filtering the Network tab for media showed **no request matching**:

```text
/api/matan/media/...
```

Therefore the current evidence does NOT prove that S3 `GetObject` is failing.

The current evidence instead suggests that the frontend is not requesting the protected media endpoint in the observed state.

Possible causes must be investigated rather than assumed.

---

## 14. Most Important Investigation

Trace the entire media path:

```text
1. Ring event synchronization
2. Ring media acquisition
3. S3 PutObject
4. DynamoDB MEDIA# metadata
5. Event hydration
6. imageUrl/media URL generation
7. EventCard/EventDetail rendering
8. useProtectedMedia
9. Cognito access token availability
10. GET /api/matan/media/[id]
11. S3 GetObject
12. response Content-Type
13. browser Object URL
14. image rendering
```

Inspect at minimum:

```text
lib/aws/s3.ts
lib/matan/media-store.ts
lib/matan/media-key.ts
hooks/useProtectedMedia.ts
app/api/matan/media/[id]
components/matan/EventDetail.tsx
components/matan/EventCard.tsx
lib/ring/overview.ts
Ring media acquisition code
DynamoDB MEDIA# hydration code
```

Also inspect how production resolves:

```text
S3_MEDIA_BUCKET
```

and whether server runtime environment variables are available inside Amplify SSR Compute.

---

## 15. Recommended Diagnostics

### A. Check S3 environment configuration

Verify in the server-side production path that:

```text
S3_MEDIA_BUCKET
```

is configured.

A safe diagnostic is:

```text
S3_MEDIA_BUCKET configured: true
```

Do not log secrets.

### B. Check DynamoDB MEDIA metadata

For an event with expected media, inspect:

```text
PK=USER#{authenticatedCognitoSub}
SK=MEDIA#{eventId}
```

Verify:

```text
media.snapshot exists
s3Key exists
contentType exists
```

### C. Check the S3 object

Using the exact metadata `s3Key`, verify the object exists in:

```text
matan-ai-media-c71e17d3
```

Do not make the object public.

### D. Check the media API

While authenticated in production, request:

```text
GET /api/matan/media/{eventId}.jpg
```

Record:

```text
HTTP status
Content-Type
Content-Length
```

Expected success:

```text
200
Content-Type: image/jpeg
```

### E. Check Cognito token availability

Verify `useProtectedMedia` can obtain the current Cognito access token.

Do not log the token.

Safe diagnostic:

```text
Cognito access token available: true
```

### F. Check the event media URL

Inspect the event object returned to the Events page.

Determine whether the media field/image URL is:

- present;
- correct;
- `/api/matan/media/...`;
- missing because there is no MEDIA# metadata.

---

## 16. Do NOT Do These Things

Do NOT:

- make the S3 bucket public;
- add `NEXT_PUBLIC_S3_MEDIA_BUCKET`;
- expose S3 keys to unauthorized clients;
- bypass Cognito;
- add AWS credentials to browser variables;
- add AWS access keys to Amplify;
- create fake S3 URLs;
- replace protected media with public URLs;
- disable S3 Block Public Access;
- change Real Mode into a simulation;
- invent Ring API endpoints;
- store Ring tokens in DynamoDB/S3/localStorage;
- remove ownership checks.

---

## 17. Current Architecture

```text
                         AWS AMPLIFY
                    Next.js SSR application
                             |
                    MatanAI-ComputeRole
                             |
        +--------------------+---------------------+
        |                    |                     |
        v                    v                     v
   DynamoDB               Bedrock                S3
   MatanAI              Nova Pro          matan-ai-media...
        |                    |                     |
        +--------------------+---------------------+
                             |
                            SES
                             |
                         SMTP fallback


Browser
   |
   | Cognito authentication
   v
Matan AI
   |
   | Ring token held server-side
   v
Ring Developer Playground
   |
   | real Ring history/media
   v
Matan analysis pipeline
   |
   +--> Nova Pro
   +--> S3
   +--> DynamoDB
   +--> SES / SMTP
```

---

## 18. Real Mode Rule

Current project rule:

> Nothing is simulated in Real Mode.

Every Real Mode feature must be backed by:

- Ring;
- AWS;
- Matan's own per-user persisted data;

or explicitly labelled as a future integration.

---

## 19. Desired Production Flow

```text
Sign in with Cognito
        ↓
Connect Ring Playground
        ↓
Ring event arrives
        ↓
Matan fetches Ring media
        ↓
S3 PutObject
        ↓
DynamoDB MEDIA# succeeds
        ↓
Events page receives media metadata
        ↓
useProtectedMedia gets Cognito token
        ↓
GET /api/matan/media/{eventId}.jpg
        ↓
S3 GetObject
        ↓
200 image/jpeg
        ↓
Browser displays stored Ring snapshot
```

The same architecture should support MP4 clips.

---

## 20. Claude Code Task

Do not immediately rewrite the media system.

First:

1. inspect the repository;
2. trace the production media request path;
3. identify the exact missing link;
4. reproduce locally if possible;
5. inspect Amplify/runtime assumptions;
6. verify the live IAM role;
7. propose the smallest safe fix;
8. implement only after identifying the root cause;
9. run:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm run build
```

10. report exactly what changed;
11. provide a production verification checklist.

### Primary question

> Why does the deployed Matan AI Events page show stored Ring events but not request/display the S3-backed media through `/api/matan/media/...`?

Do not assume S3 IAM is the problem simply because the image is missing. The current browser evidence shows that the protected media request was not being made while the Ring session was expired.


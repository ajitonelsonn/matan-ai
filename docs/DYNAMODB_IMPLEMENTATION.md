# DynamoDB Persistence — Implementation Notes

Matan AI's server-side state (Ring events, Matan/Nova analyses, connected Ring devices, user settings) is persisted in the single Amazon DynamoDB table **`MatanAI`** (us-east-1, on-demand, `PK`/`SK`). Ownership is the verified Cognito `sub`; the browser never talks to DynamoDB and never chooses a partition.

## Status

| Item | State |
| --- | --- |
| Server-only DynamoDB client (`@aws-sdk/client-dynamodb` + `lib-dynamodb`, SDK v3) | ✅ `lib/aws/dynamodb.ts` |
| Connectivity check (`DescribeTable` + harmless `GetItem`) | ✅ `pnpm dynamodb:check` |
| Server-side Cognito identity for API routes | ✅ `lib/auth/server.ts` (`aws-jwt-verify`) |
| Analyses `ANALYSIS#{eventId}` | ✅ `dynamoIntelligenceStore` |
| Ring events `EVENT#{eventId}` (idempotent) | ✅ `lib/ring/overview.ts` |
| Connected devices `DEVICE#{id}` | ✅ `lib/ring/session.ts` |
| Settings `SETTINGS` | ✅ `lib/matan/user-settings.ts` |
| Ring Playground token | ❌ never persisted — stays in the HttpOnly-cookie memory session |
| Integration test (persist → "restart" → isolation → cleanup) | ✅ 13/13 against the real table |

## Data model

```
PK = USER#{cognitoSub}
SK = SETTINGS                       { settings: SettingsData }
SK = DEVICE#{matanDeviceId}         ConnectedRingDevice fields (+type)
SK = EVENT#{ringEventId}            { eventId, timestamp, event: RingEvent (analysis reset to "pending", no intelligence) }
SK = ANALYSIS#{ringEventId}         { eventId, analyzedAt, intelligence: MatanEventIntelligence }
```

Every item also carries `createdAt`/`updatedAt`. All reads are `GetItem` or `Query PK = :pk AND begins_with(SK, :prefix)` following `LastEvaluatedKey`; there is no `Scan` anywhere (and the IAM policy denies it — verified).

Ordering: events are sorted in memory by `timestamp` (Ring ids are not chronological), exactly as before. Intelligence is stored separately and re-applied onto events on read, so re-syncing an event from Ring never wipes its analysis.

## Identity: how the server knows the user

1. The browser's `request()` helper (`lib/api/client.ts`) attaches the Cognito **access token** from Amplify as `Authorization: Bearer …` on every same-origin `/api/*` call.
2. `requireUser(req)` verifies it with `aws-jwt-verify` (`CognitoJwtVerifier`, `tokenUse: "access"`, pool + client id from the `NEXT_PUBLIC_COGNITO_*` env) → `{ sub, username }`. Missing/invalid → `401 { error: { code: AUTH_REQUIRED | AUTH_INVALID } }`; the client fires `matan:auth-expired` and `AuthProvider` re-checks the session so the guard sends the user to `/login`.
3. `withUser(user, fn)` puts the identity in an `AsyncLocalStorage` scope. Existing synchronous call sites (`listConnected()`, `getIntelligenceSync()`, `getUserSettings()`) read `currentUserSub()` from that scope, so the Matan Decision Engine, pipeline and read models were not rewritten. Background auto-analysis jobs are started inside `withUser(...)` for the user whose sync queued them.
4. `userRoute(handler)` (`lib/auth/scope.ts`) = `requireUser` + `withUser` + one-time-per-process hydration of that user's caches from DynamoDB (4 small queries). Applied to **all** `/api/ring/*`, `/api/matan/analyze`, `/api/settings`; `/api/assistant` requires it only for `mode=ring`. Demo/mock routes are unchanged and need no token.

A client-supplied user id is never read anywhere.

## Persistence behind the existing interfaces

- **`MatanIntelligenceStore`** (`lib/matan/store.ts`): interface unchanged (`get/save/all`). `dynamoIntelligenceStore` writes through to `ANALYSIS#` and keeps a per-user in-memory cache so `getIntelligenceSync()` still works for the Ring read model. `memoryIntelligenceStore` remains for tests.
- **Events** (`lib/ring/overview.ts`): the 60 s cache is now per user and is seeded from `EVENT#` on first access, so history survives restarts and token expiry. After each Ring sync, new events are written with `PutItem` + `attribute_not_exists(PK)` — duplicates from repeated syncs are impossible. Persisted history is merged with Ring's (limited) history window.
- **Devices** (`lib/ring/session.ts`): `upsert/update/remove/syncConnected` are now `async` and write through to `DEVICE#`; `listConnected()` stays synchronous over the per-user cache. Device items contain only application fields (verified: no token-like field).
- **Settings** (`lib/matan/user-settings.ts`): `/api/settings` reads/writes the user's `SETTINGS` item (defaults merged). `currentUserSettings()` and `autoSettings()` read the per-user settings when in scope, else the mock store (Demo/tests).
- **Auto-analysis state** (`lib/matan/auto.ts`): watermark, queue and rate limit are per user.
- **Media** (snapshot/clip bytes): private S3 + `MEDIA#{eventId}` metadata — see [S3_MEDIA_IMPLEMENTATION.md](./S3_MEDIA_IMPLEMENTATION.md).

## Environment

```
DYNAMODB_TABLE_NAME=MatanAI        # server-only; AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY as before
```

No new `NEXT_PUBLIC_*` variables. The JWT verifier reuses `NEXT_PUBLIC_COGNITO_USER_POOL_ID` / `..._CLIENT_ID` (public identifiers).

## Error handling

`lib/aws/dynamodb.ts` maps SDK failures to safe codes — `DYNAMO_ACCESS_DENIED`, `DYNAMO_TABLE_NOT_FOUND`, `DYNAMO_THROTTLED`, `DYNAMO_NETWORK`, `DYNAMO_ERROR` — logs `{ event: "dynamodb_error", op, code }` (never credentials/ARNs) and rethrows; route error handlers turn them into JSON errors. Event persistence failures are logged per event and never fail the sync request.

## Verification performed

- `tsc --noEmit` ✓ · `pnpm build` ✓ · `pnpm test` 14/14 ✓ · `pnpm dynamodb:check` ✓ (ACTIVE, PK/SK, PAY_PER_REQUEST).
- Integration test against the real table (throwaway `USER#itest-…` partitions, deleted afterwards): save analysis/device/settings → forced re-hydration ("restart") → all present; a second user sees none of it; key layout `ANALYSIS#`, `DEVICE#`, `SETTINGS` verified; `removeConnected` deletes; cleanup leaves the partition empty.
- Production build probes: `/api/ring/*`, `/api/settings`, `/api/matan/analyze` → `401 AUTH_REQUIRED` without a token, `401 AUTH_INVALID` with a forged token; `/api/dashboard`, `/api/events`, `/api/assistant?mode=demo` → 200 (Demo unaffected).
- `dynamodb:Scan` from the app identity → `AccessDeniedException` (IAM stays scoped to the listed actions).

Pending a signed-in browser session (needs your Cognito login): Real Mode end-to-end — connect Playground → devices saved → events synced → analysis → `pnpm dev` restart → devices/events/analyses still present. The code path is the one exercised by the integration test.

## Security notes

- Ring token: unchanged design (server memory keyed by random id in the HttpOnly `matan_ring_session` cookie). Not written to any DynamoDB item; event/device/analysis items are built from normalized data only.
- Partition key derives from the verified JWT `sub` only. Users cannot address another partition through any request field.
- No AWS secret in the browser: `lib/aws/dynamodb.ts` and `lib/auth/server.ts` are `server-only`; `.env` is git-ignored; nothing logs secret values.
- `/api/matan/media/:id` now requires the Cognito token and resolves media through the caller's partition (see the S3 notes).

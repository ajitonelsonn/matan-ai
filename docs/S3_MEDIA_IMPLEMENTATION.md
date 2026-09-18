# S3 Media Storage — Implementation Notes

Ring snapshot/clip bytes that Matan AI analyzes now live in a **private S3 bucket** with metadata in DynamoDB, instead of bounded process memory. Media survives restarts, and `/api/matan/media/:id` is **authenticated** and **ownership-checked**. The browser still only ever calls the Matan API.

## Status

| Item | State |
| --- | --- |
| Bucket `matan-ai-media-<suffix>` (us-east-1, Block Public Access ON, ACLs disabled / owner enforced, SSE-S3) | ✅ created by `pnpm s3:provision`, verified |
| `pnpm s3:check` (HeadBucket, Put/Get/Delete temp object) | ✅ passes (SSE `AES256`) |
| Server-only S3 client `lib/aws/s3.ts` (SDK v3) | ✅ |
| Media store abstraction `lib/matan/media-store.ts` | ✅ `putMedia / getMediaStream / deleteMedia / hasMediaSync` |
| Authenticated media route | ✅ `userRoute` — 401 `AUTH_REQUIRED` / `AUTH_INVALID` |
| Frontend contract `/api/matan/media/<eventId>.jpg|.mp4` | ✅ unchanged |
| Integration test (upload → restart → retrieve → isolation → 404 → cleanup) | ✅ 14/14 against the real bucket + table |
| Unit tests for key/id helpers | ✅ 4 tests (`tests/media-key.test.ts`) |

## Architecture

```
Ring Playground ── snapshot/clip bytes ──▶ pipeline ──▶ putMedia()
                                                          ├─▶ S3 PutObject  users/{sub}/events/{eventId}/{snapshot|clip}/{mediaId}.{ext}
                                                          └─▶ (only after success) DynamoDB  PK=USER#{sub}  SK=MEDIA#{eventId}
Browser <img>/<video> ──(Bearer token via useProtectedMedia)──▶ GET /api/matan/media/:id ──▶ userRoute ──▶ getMediaStream()
                                                                                                  ├─ metadata from the caller's partition
                                                                                                  ├─ keyBelongsTo(sub, s3Key) check
                                                                                                  └─ S3 GetObject (streamed) ──▶ bytes
```

### S3 object keys (`lib/matan/media-key.ts`, pure + unit-tested)
- `users/{cognitoSub}/events/{eventId}/snapshot/snapshot-{eventId}.jpg`
- `users/{cognitoSub}/events/{eventId}/clip/clip-{eventId}.mp4`
- The user segment always comes from the **verified** Cognito `sub`; ids must match `^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$` and never contain `..` or `/`.
- Deterministic per (event, type): repeated analysis/sync **overwrites** the same object — no duplicate uploads (Ring event idempotency preserved).
- Extension from `Content-Type` (`image/jpeg`→jpg, `image/png`→png, `video/mp4`→mp4); never one hardcoded type.

### DynamoDB metadata
A separate item per event (keeps the `EVENT#` record untouched, and works for events that aren't persisted, e.g. external analyze requests):

```
PK = USER#{sub}, SK = MEDIA#{eventId}
{ eventId, media: { snapshot?: MediaMeta, clip?: MediaMeta } }
MediaMeta = { mediaId, type: "snapshot"|"clip", contentType, s3Key, size, createdAt, capturedAt?, lengthMs? }
```

Hydrated into a per-user cache with the other user data (`hydrateUserScope`) so the read model can still build `imageUrl`/`videoUrl` synchronously.

### Upload order & failures
`putObject` → confirmed → `putItem(MEDIA#)`. If the upload fails, nothing is written to DynamoDB, a safe `{ event: "media_upload_failed", eventId, type, code }` is logged, and the Nova analysis still proceeds with the bytes already in hand (the event stays fully usable, just without persisted media).

### Fallback without a bucket
If `S3_MEDIA_BUCKET` is unset, the store transparently uses the previous bounded per-user memory map, so local dev/tests and Demo Mode keep working. Demo Mode never touches S3 (its media are static mock URLs).

## API

`GET /api/matan/media/:id` — `:id` is `<eventId>.jpg` or `<eventId>.mp4` (or `?type=video`), exactly what the frontend already used.

| Case | Response |
| --- | --- |
| No token | `401 { error: { code: "AUTH_REQUIRED" } }` |
| Invalid token | `401 { error: { code: "AUTH_INVALID" } }` |
| Bad id (traversal etc.) | `400 MEDIA_BAD_REQUEST` |
| Not this user's / missing | `404 MEDIA_NOT_FOUND` (same answer — no existence leak) |
| S3 problems | `502 S3_ACCESS_DENIED / S3_NETWORK / S3_ERROR`, `500 S3_CONFIGURATION_ERROR` |
| OK | streamed body, `Content-Type` from S3, `Content-Length`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `X-Media-Captured-At` |

### Frontend (minimal change)
`<img>`/`<video>` cannot send an `Authorization` header, so `hooks/useProtectedMedia.ts` fetches `/api/matan/media/*` with the Cognito access token and exposes a same-document object URL (revoked on unmount). `SafeImage` uses it automatically for protected URLs; `EventDetail` plays clips through a small `ProtectedVideo`. All other image sources are untouched.

## Environment & IAM

```
S3_MEDIA_BUCKET=<bucket-name>   # server-only; no NEXT_PUBLIC_ variant
```

Required object permissions for the app identity, scoped to the bucket: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*` (+ `s3:ListBucket` on the bucket ARN if HeadBucket/listing is wanted). Note: the current identity was able to run `CreateBucket`/`ListBuckets` during provisioning, i.e. it holds broader S3 rights than the spec's minimum — tightening that policy is recommended; the app code itself only needs the three object actions.

## Verification performed
- `tsc --noEmit` ✓ · `pnpm build` ✓ · `pnpm test` 18/18 (14 existing + 4 media-key) ✓
- `pnpm s3:check` ✓ · `pnpm dynamodb:check` ✓
- Integration test (real bucket/table, throwaway `USER#itest-…` partition, cleaned up): upload snapshot + clip with correct content types → same key on re-upload → forced re-hydration ("restart") → retrieve both (bytes, type, `capturedAt`) → missing → `MEDIA_NOT_FOUND` → user B sees no metadata and gets 404 → `deleteMedia` removes objects and the item.
- Production-build probes: media route 401 without token / 401 with forged token; demo routes 200.
- Pending your browser session (needs Cognito login + Playground token): Real Mode → analyze an event → snapshot visible → restart `pnpm dev` → still visible. Code path is the one covered by the integration test.

## Security checklist
- [x] Bucket private, Block Public Access on, ACLs disabled, SSE-S3 default encryption
- [x] AWS credentials server-side only; no `NEXT_PUBLIC_*` AWS values
- [x] Media API requires Cognito; ownership via verified `sub`; client never supplies an S3 key
- [x] No public/presigned URLs; no CloudFront
- [x] Ring token never in S3 or DynamoDB (unchanged HttpOnly memory session)

## Limitations
- No `Range` support on the media route (clips are ≤ 60 s; the client plays from a fully fetched object URL). 
- Media is not deleted automatically (no lifecycle rules, by design); `deleteMedia()` exists for a future event-deletion feature.
- The write-through metadata cache is per process; multiple server instances would each hydrate from DynamoDB (correct, just extra reads).

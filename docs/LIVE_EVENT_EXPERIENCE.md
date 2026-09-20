# Live Ring Playground Event Experience — Implementation Notes

Goal: make the existing real pipeline — Ring Playground → event history sync → auto-analysis → Ring snapshot → Nova Pro → Matan Decision Engine → DynamoDB/S3 → notification — *visible* as a continuous flow in the dashboard, with no manual refresh. Nothing in this milestone generates Ring events; Real Mode shows only what the Ring API returned.

## What changed (smallest set)

### Server: expose the state that already existed
| Piece | Change |
| --- | --- |
| `lib/matan/store.ts` | The in-flight guard now records a **stage** (`capturing` → `analyzing`) and remembers the last **failure** per event (`markAnalysisFailed`, cleared on success). |
| `lib/matan/pipeline.ts` | Sets the stage around media fetch vs. Nova call; on error marks the failure (except throttling) and rethrows — the event itself is untouched. |
| `lib/matan/notifications.ts` | Per-user **notification status** cache hydrated from `NOTIFICATION#…#EMAIL` records, write-through on claim/write, skips remembered in-process; `getNotificationSync(eventId)`. |
| `lib/matan/media-store.ts` | `getMediaMetaSync()` for the snapshot capture timestamp. |
| `lib/matan/auto.ts` → `overlayProcessingState()` (replaces `markAnalyzingState`) | Overlays onto each Ring event: `analysis` = `pending \| capturing \| analyzing \| done \| failed`, `analysisError`, `notification { status, reason, sentAt, provider, code }`, `processing { receivedAt, capturedAt?, analyzedAt?, notifiedAt? }`. Timestamps are only present when the step really happened. |
| `lib/types/index.ts` | The fields above on `RingEvent`. |
| `lib/auth/scope.ts` | Hydrates notification status with the other per-user data. |

No new polling, scheduler, queue or route. Existing idempotency (one analysis in flight per event, one notification per event) is unchanged.

### UI
| Piece | Change |
| --- | --- |
| `lib/matan/event-state.ts` (pure, tested) | Maps server fields to the spec's **NEW → CAPTURING → ANALYZING → COMPLETE / FAILED** views, the 5-step **timeline** (Ring event received · Snapshot captured · Nova Pro analysis · Matan decision · Notification) with `pending/active/complete/failed/skipped` states, and the **notification line** ("Notification sent via …", "Notification not required", "Notification could not be sent", "Notifications off in Settings"). |
| `components/matan/EventTimeline.tsx` | Compact timeline; real timestamps only; `motion-safe:` pulse on the active step; screen-reader text per step. |
| `components/matan/EventCard.tsx` | `EventStatusLines` under Ring events on Home tiles and Events rows ("✓ AI analysis complete", "✓ Notification sent…"), **New** badge + subtle glow for events that arrived after the page loaded (`hooks/useNewItems.ts`, 90 s), stage-aware `RiskBadge` (Awaiting AI · Capturing… · Analyzing… · AI unavailable · priority). |
| `components/matan/MatanAnalysisPanel.tsx` | Follows the server stage while polling (capturing copy with camera icon, analyzing with the Matan loader), spec copy for **Analysis unavailable + Retry** (retry = existing manual analyze), notification status line, collapsible **Processing timeline** (open until complete). |
| `components/layout/AppDataProvider.tsx` | Home polls every **6 s while any latest event is capturing/analyzing, else 30 s** — the same cadence the Events page already used. |
| `components/pages/EventsPage.tsx`, `HomeDashboard.tsx` | New-event highlighting; polling condition uses `isProcessing()`. Stale "analysis starts with the Bedrock milestone" copy replaced. |

Status language follows the spec: *Ring event received · Capturing evidence · Matan AI analyzing · Decision ready · Notification sent*. Nothing exaggerated; the Decision Engine's output is displayed, never re-derived.

### Error handling (distinct states)
- Ring connection expired → existing `ExperienceBanner` (unchanged).
- Snapshot unavailable → timeline step "Snapshot captured" shown as *skipped* with the pipeline's `mediaNote`; analysis proceeds context-only.
- Nova failure → event stays in the list; badge "AI unavailable", panel "Analysis unavailable … The Ring event is saved and unchanged. Code: …" + Retry; timeline marks analysis/decision failed.
- Notification failure → "Notification could not be sent" (event and analysis intact).

### Accessibility & motion
Status lines and the panel use `aria-live="polite"` and change only on real state transitions (polling that returns the same state re-renders identical text, so nothing is re-announced). Animations are `motion-safe:` only; badges/lines remain readable without them. All controls are semantic buttons with the existing focus styles.

## Tests
`tests/event-state.test.ts` (5): state machine mapping incl. demo events never "processing"; stage copy/active flags; timeline transitions with real-timestamp-only rule; failed vs context-only rendering; notification status text incl. "nothing claimed before completion". Full suite **36/36**; `tsc` ✓; `pnpm build` ✓. Fixtures are unit-test only — nothing mocked reaches Real Mode.

## Real Ring Playground acceptance test
Requires a signed-in browser session with a Playground token (not runnable from the CLI):
- Motion: **NOT TESTED in this session** — the code path is the existing auto-analysis pipeline, previously verified live (events synced, snapshot from Ring, Nova analysis, DynamoDB/S3 persisted, notification gate logged).
- Package / Vehicle: **NOT TESTED in this session**. Note from earlier sessions: the Playground's Package/Vehicle/Motion buttons create `on_demand` live-view history entries (no detections), which the engine classifies *normal / no action*; to see a "Notification sent" state set Settings → Notifications → Alert level to **All**.

Procedure: sign in → Real Mode → connect Playground → select device → open Home or Events → trigger a scenario in the Playground → within ≤30 s the event appears with **New**, then Capturing… → Analyzing… → priority badge, status lines and timeline fill in; open the event for the panel/timeline; confirm `dynamodb_hydrated`/`media_persisted`/`email_notification_*` in the server log.

## Security
Ring token: unchanged memory session; not in any new field. Cognito: all new data flows through the existing `userRoute` + per-user caches. S3: only metadata timestamps are exposed, never keys. No new `NEXT_PUBLIC_*`. Demo Mode: `eventStage()` treats non-Ring events as complete and shows no processing UI.

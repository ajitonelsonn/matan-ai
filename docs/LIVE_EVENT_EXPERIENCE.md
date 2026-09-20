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

## Real Ring Playground acceptance test (performed 2026-09-21)

Signed-in browser session, Real Mode, Playground token, one Playground device; scenarios triggered in the Ring Developer Playground while the Matan Events page was open. Verified from the server log (sync → snapshot → Nova → decision → DynamoDB/S3 → notification) and on screen (New → Capturing… → Analyzing… → badge + status lines + timeline).

| Scenario | Result | Evidence (event ids) |
| --- | --- | --- |
| Motion | **PASS** | `ring-UCQZMVIYOFIEZWXQ`, `ring-HMCT65JC66PHIBCN` — snapshot 88 KB, Nova *motion* (5.5 s), priority medium, S3 + DynamoDB, email sent |
| Package | **PASS** | `ring-OHEGT6UDBXVVLBIB`, `ring-NK62IIYRMR6Y4BF6`, `ring-4BEPYOSR2GGH3QFC`, `ring-Y6YKV5O2NVODWGU2` — Nova *delivery* (4.7–4.9 s), priority low, email sent |
| Vehicle | **PASS** | `ring-TL6PIWPNWT5QSPXN`, `ring-KQLWRERRRKXPA7ZX` — snapshot 110–113 KB, Nova *vehicle* (5.2–5.6 s), priority normal, email sent |
| (Animal, extra) | PASS | `ring-AWOK574WXZRUG45L`, `ring-KKD4XOCQY6X4DRJ5` — Nova *animal* |

Also observed: two events synced together were analyzed concurrently and each notified exactly once; Ring's first snapshot attempt occasionally returns `422 GRECO_NO_VALID_KEY` and the `at_timestamp` fallback succeeds; a Playground token expiry surfaced as `refresh 401` → reconnect → sync resumed. Notifications used the SMTP fallback (SES still in Sandbox) with alert level **All**.

### Bug found and fixed during the test
The auto-analysis scheduler skips `on_demand` history entries that Matan's own snapshot/clip requests create on Ring (to avoid a feedback loop). That filter treated *any* `on_demand` event within **3 minutes** after a Matan media request as Matan's own, so a Playground scenario clicked shortly after an analysis was silently dropped (it showed "Awaiting AI"). Fix (`lib/matan/auto.ts`): an event is Matan's footprint only if it starts within −5 s … +20 s of a request **and** lasts ≤ 6 s (Playground sessions run ~20 s), and each request can claim at most one event. The scheduler now also logs `matan_auto_skipped { fresh, skipped }` per sync so any drop is explained.

## Acceptance criteria (spec §29) — status

| # | Criterion | Status | Where |
| --- | --- | --- | --- |
| 1 | Existing Ring Playground integration still works | ✅ | discover/devices/refresh/events unchanged; verified live 2026-09-21 |
| 2 | Real Mode still receives actual Ring Playground events | ✅ | `lib/ring/overview.ts` history sync; 10 real events processed in the test |
| 3 | No fake Ring events introduced into Real Mode | ✅ | fixtures exist only in `tests/`; the temporary visual preview route was deleted before commit |
| 4 | New Ring events appear automatically | ✅ | existing 30 s history poll; **New** badge via `hooks/useNewItems.ts` |
| 5 | User does not need to manually refresh | ✅ | Home/Events polling (6 s while working, 30 s idle) |
| 6 | Existing automatic analysis scheduler is reused | ✅ | `lib/matan/auto.ts` (only the own-footprint filter + skip logging changed) |
| 7 | Snapshot retrieval uses the existing Ring integration | ✅ | `obtainRingMedia` → `getRingSnapshot` unchanged |
| 8 | Nova Pro analysis uses the existing pipeline | ✅ | `runMatanPipeline` unchanged except stage/failure bookkeeping |
| 9 | Deterministic Decision Engine remains authoritative | ✅ | `lib/matan/decision.ts` untouched; UI only displays its output |
| 10 | Event state is visible to the user | ✅ | stage badges, status lines, panel copy, timeline |
| 11 | Analysis completion appears automatically | ✅ | server overlay + polling; `aria-live` on transitions |
| 12 | Notification status visible where applicable | ✅ | "Notification sent via …" / "not required" / "could not be sent" / "off in Settings" |
| 13 | Duplicate analysis prevented | ✅ | in-flight guard + `seen` set + intelligence check (unchanged) |
| 14 | Duplicate notification prevented | ✅ | `NOTIFICATION#{eventId}#EMAIL` claim (unchanged); one email per event in the live test |
| 15 | Ring tokens remain server-side only | ✅ | untouched memory session; no new fields carry it |
| 16 | Cognito user isolation intact | ✅ | all new reads go through `userRoute` + per-user caches |
| 17 | Demo Mode remains separate | ✅ | `eventStage()` treats non-Ring events as complete; no processing UI in Demo |
| 18 | Accessibility preserved | ✅ | semantic buttons, focus styles, `aria-live` only on state changes, SR text per timeline step |
| 19 | Mobile/responsive UI works | ✅ | status lines collapse into the row; cards stack (existing breakpoints) |
| 20 | Existing tests pass | ✅ | 36/36 |
| 21 | Type checking passes | ✅ | `tsc --noEmit` |
| 22 | Production build passes | ✅ | `pnpm build` |
| 23 | Actual Playground Motion scenario tested | ✅ PASS | see table above |
| 24 | Actual Playground Package scenario tested | ✅ PASS | see table above |
| 25 | Actual Playground Vehicle scenario tested | ✅ PASS | see table above |

Non-goals respected: no Ring device control, no fake event generator, no webhooks, no token auto-refresh, no changes to the Decision Engine, Nova, DynamoDB, S3 or SES designs.

## Security
Ring token: unchanged memory session; not in any new field. Cognito: all new data flows through the existing `userRoute` + per-user caches. S3: only metadata timestamps are exposed, never keys. No new `NEXT_PUBLIC_*`. Demo Mode: `eventStage()` treats non-Ring events as complete and shows no processing UI.

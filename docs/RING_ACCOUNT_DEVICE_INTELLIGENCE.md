# Ring Account & Device Intelligence — Implementation Notes

## 1. Goal

Show the signed-in user real facts about their Ring account and devices — status, capabilities, coarse region, configuration — using only what the Ring Partner API returns, feed that device context into the existing Matan/Nova pipeline, and present every Ring capability the Playground cannot demonstrate as an honest, non-interactive **future feature**. Real Mode never contains invented Ring data.

**Core rule applied:** if the Ring Playground cannot demonstrate it, Matan AI does not pretend that it can.

## 2. API endpoints used

All calls are server-side (`lib/ring/client.ts`) with the Playground token from the HttpOnly-cookie memory session; the browser never talks to Ring.

| Endpoint | Used for | Status in Matan |
| --- | --- | --- |
| `GET /v1/users/me` | Ring account id + display name (email masked) | **New** — fetched on connect, kept in the session, shown in the *Ring account* card |
| `GET /v1/devices?include=status,capabilities,location,configurations` | discovery + all four related resources in one call | Existing (normalization extended) |
| `GET /v1/devices/{id}` | single device | Existing |
| `GET /v1/devices/{id}/status` | online/offline, `reported_at`, chime snooze | Existing (*Refresh status*) |
| `GET /v1/devices/{id}/capabilities` | read-only capability facts | Existing wrapper; now fully normalized |
| `GET /v1/devices/{id}/location` | coarse `country` / `state` | Existing; shown as "Region: US / CA" |
| `GET /v1/devices/{id}/configurations` | motion/privacy zones, image settings, audio volume | Existing wrapper; now normalized and displayed |
| `GET /v1/history/devices/{id}/events` | event history (existing pipeline) | Existing |
| `GET /v1/accounts/me/subscriptions` | subscription/trial status | Probed only — Playground returns 422 (see §4) |

Not used: `POST /v1/devices/{id}/media/audio/playback` (chime), `/v1/accounts/me/app-integrations` (account-linking, write-only), webhooks — see §4/§10.

## 3. Playground capabilities verified (live, 2026-09-21)

Verified with `pnpm ring:inspect` (read-only script, token from the environment for one command, never printed) against `https://api.amazonvision.com` with a fresh Playground token, plus the running app.

| Call | Result |
| --- | --- |
| `GET /v1/users/me` | **200** — `type: users`, id `ava1.ring.account.…`, `first_name: "Playground"`, `last_name: "User"`, synthetic `@example.com` email |
| `GET /v1/devices?include=…` | **200** — 1 device "Playground Device" (attributes `name`, `image_url`), relationships `status`, `capabilities`, `location`, `configurations`; `included` types `device-status`, `device-capabilities`, `locations`, `device-configurations` |
| `GET /v1/devices/{id}` | **200** — same resource |
| `GET /v1/devices/{id}/status` | **200** — `online: true`, `reported_at`, `state: null`, `audio.snooze { active: null, until: null }` |
| `GET /v1/devices/{id}/capabilities` | **200** — `motion_detection.configurations ["enabled","motion_zones"]`, `image_enhancements.configurations ["color_night_vision","privacy_zones","snapshot"]`, `video { codecs ["AVC"], ratio "16:9", max_resolution 1080, supported_resolutions [1080], configurations ["resolution_mode"] }`, `audio { customizable_slots: null, supported_actions: null }`, `battery_status: null`, and `co_detection_listener / smoke / glass_break / tamper / flood / freeze / contact: null` |
| `GET /v1/devices/{id}/location` | **200** — `{ country: "US", state: "CA" }` (coarse only) |
| `GET /v1/devices/{id}/configurations` | **200** — `motion_detection { enabled: "on", motion_zones: [1 zone with vertices] }`, `image_enhancements { color_night_vision: "off", hdr: "off", ir_led_night_vision: "off", auto_zoom_track: "off", privacy_zones: [] }`, `audio { volume: 11, customizable_slots: null }` |
| `GET /v1/history/devices/{id}/events` | **200** — 46 events, all `event_type: "on_demand"`, `cv_detections: []` |
| Motion / Package / Vehicle simulation | **PASS** (2026-09-21, see `docs/LIVE_EVENT_EXPERIENCE.md`): each button creates a ~20 s `on_demand` live-view history entry; Matan's snapshot + Nova classify it as motion / delivery / vehicle |

## 4. Playground capabilities not supported / not verified

Each item carries exactly one of the spec's classifications.

| Item | Observation | Classification |
| --- | --- | --- |
| Subscriptions (`GET /v1/accounts/me/subscriptions`) | **422** `Unable to process subscription request for this user` | Documented by Ring but not exposed by Playground |
| App-integration status (`/v1/accounts/me/app-integrations`) | GET → **403**; documented as POST/PATCH/DELETE for account linking, not for a Playground token | Documented by Ring but not exposed by Playground |
| Device lifecycle (`device_added/removed/online/offline`, `app_integration_*`, `subscription_*`) | Documented only as **webhook event types**; no Playground trigger exists | Documented by Ring but not exposed by Playground |
| Chime controls (`POST …/media/audio/playback`) | Documented; the Playground device reports `audio.supported_actions: null`, `customizable_slots: null` → no testable chime | Documented by Ring but not exposed by Playground |
| Device controls (siren, lights, lock, recording, PTZ) | No control endpoints exist; FAQ: capability values "are read-only. They do not indicate active control functionality" | Not documented by Ring |
| Family / household / shared users | No resource anywhere in the API reference or FAQ | Not documented by Ring |
| Battery / signal strength | `battery_status: null` on the Playground device; no signal field returned | Documented by Ring but not exposed by Playground (shown as "— Unavailable") |
| Sensor capabilities (CO, smoke, glass break, tamper, flood, freeze, contact) | All `null` on the Playground device | Documented by Ring but not exposed by Playground (shown as "— Unavailable") |
| `component_id` multi-camera modules (Elite) | Not attempted | Not tested |
| Webhooks | Out of scope for this milestone by spec | Not tested |

## 5. Capability matrix

| Capability | Ring API | Playground verified | Matan status |
| --- | --- | --- | --- |
| Account profile (`users/me`) | Supported | PASS | **Implemented** (Ring account card) |
| Device discovery | Supported | PASS | Existing |
| Device status | Supported | PASS | Existing + snooze/state normalized |
| Device capabilities | Supported (read-only) | PASS | **Implemented** — ✓ / — Unavailable matrix |
| Device location | Supported, coarse | PASS (`US / CA`) | **Implemented** — "Region" |
| Device configuration | Supported (read-only) | PASS | **Implemented** — configuration summary |
| Event History | Supported | PASS | Existing |
| Motion simulation | Playground | PASS | Existing |
| Package simulation | Playground | PASS | Existing |
| Vehicle simulation | Playground | PASS | Existing |
| Event → device context for Nova | — | PASS (context built from connected-device record) | **Implemented** |
| Subscriptions | Supported | NOT SUPPORTED (422) | Future / unavailable in Playground |
| Lifecycle events | Webhooks only | NOT SUPPORTED | Future / unavailable in Playground |
| Family/household members | Not documented | NOT SUPPORTED | Do not implement as Ring — "Coming in a future integration" |
| Camera/doorbell controls | Read-only capability fields | NOT SUPPORTED | Future — "🔒 Future Ring capability" |
| Chime controls | Documented | NOT EXPOSED (audio null) | Future feature |

## 6. Implementation details

- **Types** (`lib/ring/types.ts`): `RingAccount { accountId, firstName?, lastName?, emailMasked?, fetchedAt }`; `RingSessionInfo.account`; `RingDiscoveredDevice.status` gains `snoozeActive`, `state`; `capabilities` gains `ratio`, `supportedResolutions`, `configurable { video, motion, imageEnhancements }`, `sensors {…}`, `audioSlots`, `audioActions`; `configuration` gains `motionZonesCount`, `privacyZonesCount`, `imageEnhancements`, `audioVolume`; `ConnectedRingDevice.configuration`.
- **Normalization** (`lib/ring/normalize.ts`): `normalizeAccount()` (email masked, raw address never stored), extended `normalizeDevice()` — `undefined` when a resource wasn't returned, `false`/`null` when Ring reported null; nothing inferred. Kind detection unchanged (image-path product hint is labelled a hint).
- **Session** (`lib/ring/session.ts`): `createRingSession(token, devices, account)`; `sessionInfo()` exposes `account`; `syncConnected()` refreshes configuration and region; connected-device records persist `configuration` (DynamoDB `DEVICE#`, no token).
- **Discover route**: fetches `users/me` best-effort after discovery (`ring_account { ok }` log); a `users/me` failure never blocks devices.
- **Device context for Nova** (`lib/matan/analysis.ts` → `deviceContextFor`): `{ name, ringName, type, online, capabilities, region, motionDetectionEnabled, motionZones }` from the connected-device record, added as `context.device`. The Decision Engine is untouched.
- **UI** (`components/devices/ring-intelligence.tsx`): `RingCapabilityMatrix` (✓ Yes / — Unavailable / ? Unknown, with "read-only … do not indicate control functionality" footnote), `RingConfigurationSummary`, `RingRegion`, `RingAccountCard`, `RingFutureFeaturesCard`. Wired into the Ring devices view (detail drawer + sidebar). The invented "Firmware" row was removed. Real-Mode Care & Family copy now states the Ring API/Playground provides no household mapping.
- **Pure helpers** (`lib/ring/capabilities.ts`): `capabilityRows`, `configurationRows`, `regionLabel`, `futureFeatures()` — the chime classification flips to "Documented and exposed but not yet implemented" automatically if a device ever reports chime audio.
- **Script** `scripts/ring-inspect.mjs` (`pnpm ring:inspect [--raw]`): read-only inspection for verification; token from `RING_PLAYGROUND_TOKEN` env only.

## 7. Security

Ring token unchanged (server memory session; not in DynamoDB/S3/localStorage/logs; the inspect script never prints it). Account email is masked before it leaves `normalizeAccount()`. Cognito identity from the verified JWT; user partitions unchanged; S3 private; no new `NEXT_PUBLIC_*`. Future-feature cards are `aria-disabled` and have no handlers.

## 8. Tests

`tests/ring-account-device.test.ts` (6, fixtures mirror the captured Playground shapes and are labelled as such): account normalization + masking; device normalization (status, capabilities incl. null sensors/audio/battery, coarse location, configuration); offline + missing resources handled without inference; capability matrix yes/unavailable/unknown; foreign resource types never become devices; future-feature classification incl. the chime flip. Full suite **42/42**, `tsc` ✓, `pnpm build` ✓.

## 9. Real Playground acceptance results (2026-09-21)

| Step | Result |
| --- | --- |
| Connect Real Mode with Playground token | PASS |
| Discover the Playground device | PASS (1 device) |
| Query device | PASS |
| Query status | PASS (online, reported_at) |
| Query capabilities | PASS (video 1080p AVC 16:9; motion; snapshot; color night vision; privacy zones; audio/battery/sensors null) |
| Query location | PASS (US / CA) |
| Query configurations | PASS (motion on, 1 zone, 0 privacy zones, enhancements off, volume 11) |
| Trigger Motion / Package / Vehicle | PASS (see `docs/LIVE_EVENT_EXPERIENCE.md`) |
| Data comes from Ring | PASS — all values above are API responses; Demo Mode is separate |
| Matan uses the real device context | PASS — `context.device` populated from the connected-device record for every Ring event analysis |

## 10. Future features (shown in the UI, never faked)

Device controls · Chime controls · Family/Household · Device lifecycle events · Ring subscription status — each with headline, explanation and its classification from §4. Chime controls would become implementable via `POST /v1/devices/{id}/media/audio/playback` once a device exposes chime audio; lifecycle via webhooks (`/api/ring/webhook`, HMAC-SHA256, `request_id` idempotency) in a later milestone.

## 11. Known limitations

- The Playground exposes exactly one synthetic device; multi-device and non-camera kinds (chime, sensors) are untested.
- Account details are fetched at connect time and live only in the session (not persisted); they disappear when the session expires.
- Device status is polled (existing 60 s refresh), not pushed.
- Coarse region is shown as reported (country / state); no map or address by design.

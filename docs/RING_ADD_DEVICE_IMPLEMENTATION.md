# MATAN AI — Ring Add Device Integration: Implementation Report

**Status:** Implemented and verified (September 2026)
**Scope:** Add Device → Ring Playground token → server-side Device Discovery → select/configure → persist → Devices page → token-expiry/reconnect UX → **plus** the first slice of the next milestone: real WebRTC (WHEP) Live View for connected Ring devices.

---

## 1. Summary

The mocked "Add Device" modal was replaced with a **real Ring Developer Playground integration**:

```
MATAN AI (browser)
   ↓  Paste temporary Ring Playground token (masked input, sent once over HTTPS)
POST /api/ring/discover  (Next.js server)
   ↓  Authorization: Bearer <token>   (token never reaches the browser again)
GET https://api.amazonvision.com/v1/devices?include=status,capabilities,location,configurations
   ↓  JSON:API response
Normalize → safe device metadata → browser
   ↓  User selects devices, sets Matan name / location / AI / favorite
POST /api/ring/devices   (server builds records from ITS OWN discovery result)
   ↓
Devices page shows real connected Ring devices  →  Live View streams them via WebRTC/WHEP
```

Key guarantees (all verified, see §9):

- The Playground token is **never** in `.env`, source, mock data, `localStorage`, URLs, logs, or API responses.
- The browser **never** calls `api.amazonvision.com` directly — every Ring call is server-to-server.
- No fake Ring devices are ever shown on the real Ring path. Demo devices are a separate, clearly labelled opt-in mode.
- Ring API fields are never fabricated ("Firmware: Not available").

---

## 2. Architecture

### 2.1 Token & session model (spec §17 Option A)

| Concern | Implementation |
|---|---|
| Where the raw token lives | **Server memory only** (`globalThis.__matanRing.sessions`, keyed by a random `crypto.randomUUID()` session id). Lost on server restart — by design for the hackathon. |
| What the browser holds | An **HttpOnly, SameSite=Lax** cookie `matan_ring_session` containing only the session id (`Secure` in production). JavaScript cannot read it. |
| Token lifetime | Playground tokens live 30 minutes. The server decodes the JWT `exp` claim (no verification, countdown only) and falls back to `now + 30 min` if the token isn't a JWT. |
| Expiry states | `valid` → `expiring` (< 5 min) → `expired`; `invalid` when Ring rejects the token mid-session (401). |
| What is returned to the browser | `{ status, expiresAt, connectedAt, lastValidatedAt, discoveredCount }` — never the token. |
| Connected devices | Stored separately (`globalThis.__matanRing.connected`), survive token expiry, never contain the token. |

### 2.2 Ring API layer — `lib/ring/`

| File | Purpose |
|---|---|
| `constants.ts` | `RING_API_BASE_URL` (`https://api.amazonvision.com`), Playground URL, docs URL, 30-min lifetime, 5-min warning threshold, `include=` list, 15 s request timeout, cookie name. |
| `types.ts` | Raw JSON:API shapes (`JsonApiDocument`, `JsonApiResource`, …) and the normalized types `RingDiscoveredDevice`, `ConnectedRingDevice`, `RingSessionInfo`, `TokenStatus`, `RingErrorCode`, `RingHistoryEvent`. |
| `errors.ts` | `RingApiError` + `fromResponse(status, body, retryAfter)` mapping Ring HTTP errors to normalized codes with user-facing copy (spec §23). `Retry-After` is parsed and forwarded. |
| `normalize.ts` | `normalizeDevices(doc)` — indexes `included` resources by `type:id`, resolves each device's `status / capabilities / location / configurations` relationships, derives kind, capability flags, battery/signal, motion & privacy zones. `capabilityLabels()` produces the UI chips. `normalizeHistory()` for event history. |
| `client.ts` | **Server-only** (`import "server-only"`). `ringFetch()` adds the Bearer header, `cache: "no-store"`, timeout, sanitized logging. Exposes `discoverRingDevices`, `getRingDevice`, `getRingDeviceStatus`, `getRingDeviceCapabilities`, `getRingDeviceLocation`, `getRingDeviceConfigurations`, `getRingDeviceEvents`, `getRingUser`, `startWhepSession`, `stopWhepSession`. |
| `session.ts` | Server-only session + connected-device store (§2.1). `createRingSession`, `getRingSession`, `sessionInfo`, `usableToken`, `markValidated`, `markInvalid`, `destroyRingSession`, `listConnected`, `upsertConnected`, `updateConnected`, `removeConnected`, `syncConnected`, `toConnected`. |
| `http.ts` | `ringError(e)` → uniform `{ error: { code, title, message, retryAfterSeconds } }` response; `readBody()`. |

### 2.3 Real Ring response shape (what the normalizer was built against)

Verified from a **real response recorded from the Playground** (community `ring-sandbox` fixture, 2026-09-15) and Ring's official sample app (`AmazonAppDev/ring-api-helloworld`):

- `data[]` → `type: "devices"`, `attributes: { name, image_url }` (no `device_kind`/model — kind is **derived** from capabilities, name and Ring's product-image path, and labelled as such).
- `included[]` types are `device-status`, `device-capabilities`, `locations`, `device-configurations` (the docs summary says `status`/`capabilities`; the normalizer accepts both).
- Status: `online`, `reported_at`, optional `battery_status.percentage`, `signal_strength.value`.
- Capabilities: `video.{codecs,max_resolution}`, `motion_detection`, `image_enhancements.configurations` (`snapshot`, `privacy_zones`, `color_night_vision`), `audio.supported_actions`, `battery_status`.
- Configurations: `motion_detection.{enabled,motion_zones[]}`, `image_enhancements.privacy_zones[]`.
- Errors: `{ errors: [{ status, title, detail }] }`.

The Playground exposes exactly **one synthetic device** ("Playground Device", a Doorbell Pro). Discovery returning `count: 1` is correct.

### 2.4 API routes — `app/api/ring/`

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, never echo or log the token.

| Route | Method | Purpose |
|---|---|---|
| `/api/ring/discover` | `POST { token }` | Validates (non-empty, trimmed, ≤ 8192 chars, no whitespace), calls Ring Device Discovery, creates the server session + cookie, returns `{ devices, count, session }`. |
| `/api/ring/session` | `GET` | Current session state (never the token) + cached discovery. |
| | `DELETE` | Forget the token ("Disconnect"). Connected devices are kept. |
| `/api/ring/devices` | `GET` | `{ connected, session }` — does **not** call Ring (fast). |
| | `POST { devices:[{ringDeviceId, displayName?, locationLabel?, aiEnabled?, favorite?}] }` | Saves selections. Device facts come from the **server's** cached discovery result, so nothing can be fabricated client-side. |
| `/api/ring/devices/[id]` | `GET / PATCH / DELETE` | Read / update local metadata only / remove from Matan (does not touch the Ring account). |
| `/api/ring/devices/[id]/status` | `GET` | Live status from Ring (`/v1/devices/{id}/status`). |
| `/api/ring/devices/[id]/events` | `GET` | Event history (`/v1/history/devices/{id}/events`), first 20. |
| `/api/ring/devices/[id]/stream` | `POST { sdpOffer }` | WHEP live view: forwards the browser's SDP offer to `/v1/devices/{id}/media/streaming/whep/sessions`, returns `{ sdpAnswer, sessionUrl }`. |
| | `DELETE { sessionUrl }` | Ends the WHEP session. Only Ring session URLs are accepted (no open proxy). |
| `/api/ring/refresh` | `POST` | Re-runs discovery with the session token, syncs status of connected devices. On 401 marks the session `invalid`. |

Error codes returned to the UI: `RING_TOKEN_MISSING`, `RING_TOKEN_INVALID`, `RING_TOKEN_EXPIRED`, `RING_FORBIDDEN`, `RING_NOT_FOUND`, `RING_RATE_LIMITED` (+ `Retry-After`), `RING_UNAVAILABLE`, `RING_BAD_REQUEST`, `RING_NETWORK`, `RING_NO_SESSION`, `RING_UNKNOWN`.

### 2.5 Browser client — `lib/api/ring.ts`

`ringApi.discover / session / disconnect / devices / save / update / remove / refresh / status / events / startStream / stopStream` and `ringErrorFrom(e)` to read the normalized error payload. The token is passed to `discover()` once and is not retained.

---

## 3. UI — `components/devices/`

| Component | What it does |
|---|---|
| `add-ring-device-modal.tsx` | 4-step wizard **1 Connect · 2 Discover · 3 Select · 4 Finish** with an accessible step indicator (`aria-current="step"`, screen-reader labels). Handles first connection, adding more devices to an existing session ("Use the current Playground session instead"), and reconnect after expiry. Prevents duplicate requests. |
| `ring-token-input.tsx` | Masked token field (`type=password`) with show/hide eye toggle, helper copy from the spec, `autocomplete="off"`, password-manager ignore hints, `aria-invalid`/`role="alert"` errors. Value lives only in component state until POSTed once. |
| `ring-device-discovery.tsx` | Loading state ("Discovering your Ring devices… Connecting securely to Ring / Reading device information" with the Matan logo loader), per-code error states with **Try Again / Open Ring Playground / Back**, and the "No Ring devices found" empty state. |
| `ring-device-card.tsx` | Selectable discovered-device card: Ring product image (fallback "Preview unavailable"), name, model hint, online/offline/unknown badge, region, capability chips (only when known). Ring IDs are never displayed. |
| `ring-device-selector.tsx` | "N devices found · M selected", **Select all / Clear**, search (when > 3 devices), staggered fade-in of cards. |
| Configure step (in modal) | Per selected device: Ring name (read-only), **Matan AI name**, **Location**, **Enable Matan AI analysis**, **Favorite**. |
| Finish step (in modal) | "✓ Ring connected — Matan AI found N Ring devices and connected M", animated list, **View Devices / Done**. |
| `ring-connection-status.tsx` | Session card: Not connected / Connected (live `mm:ss` countdown + progress bar) / **Expiring** (< 5 min warning) / **Expired / Invalid** (🔒 "Ring Playground session expired" + **Reconnect Ring**). Actions: Refresh, Add devices, Disconnect session. |
| `ring-connected-device-card.tsx` | Card for a connected device (grid + list views): status, Ring badge, product image, model hint, location label, capability chips, "Synced … / Ring reported …", **Live View** (enabled when the session is valid and the device reports video), **Events**, menu. |
| `ring-devices-view.tsx` | The Ring mode of the Devices page: empty state "Connect your Ring devices", filters (All / Doorbells / Cameras / Chimes / Offline), sort, grid/list, Device Summary, Device Types, Need Help; detail drawer (only API-known facts, "Not available" fallbacks, Live view / Refresh status / Event history / Edit / Remove); Ring event-history drawer; edit modal. |
| `device-source-switch.tsx` | Segmented **Ring devices (n) / Demo devices** switch (spec §24). |
| `use-ring-session.ts` | `useRingCountdown(session)` — ticks every second, derives `valid / expiring / expired / invalid`. |
| `use-ring-live-stream.ts` | WebRTC/WHEP hook: `RTCPeerConnection` (recvonly audio+video, same m-line order as Ring's sample app), ICE gathering (≤ 3 s), offer → backend → answer, connection-state handling, cleanup and session DELETE on stop/unmount. |
| `ring-live-player.tsx` | Live View hero for Ring devices: poster (Ring product image) → Start → connecting (logo loader) → **LIVE** with timer → Stop/ended; mute, fullscreen; friendly error state; expired-session state with Reconnect. |
| `ring-live-side-panel.tsx` | Replaces the mock AI panel on Live View for Ring devices: device facts, capability chips, "Simulate an event" shortcuts (Package / Vehicle / Motion → Playground), recent Ring events, links to Playground and device details. |

### 3.1 Devices page behaviour — `components/pages/DevicesPage.tsx`

- **Source of truth = Ring.** If any Ring devices are connected, the page opens in Ring mode. Otherwise it shows the Ring empty state with **Add Ring Device** and a secondary **Browse demo devices**.
- **Demo mode** (`components/pages/DemoDevicesView.tsx`, the former mock page) is an explicit opt-in remembered in `localStorage` (`matan.devices.source` — a UI preference, not a secret). It is labelled "Demo data" and its primary **Add Ring Device** button opens the real Ring flow; adding a *demo* device is a separate, clearly named action.
- Deep links: `/devices/<connectedId>` opens the Ring detail drawer; `/devices/<demoId>` opens demo mode.
- A failed or expired Ring connection **never** falls back to demo devices.

### 3.2 Live View — `components/pages/LivePage.tsx`

- Connected Ring devices (with video) appear **first** in the Camera Selector with a `ring` badge; the header shows "N Ring · x/y demo online".
- Selecting a Ring device (`/live?camera=ring:<id>`) swaps the mock frame for `RingLivePlayer` and the AI card for `RingLiveSidePanel`.
- Actuation controls (siren / lights / lock / snapshot / record) are disabled for Ring devices — those endpoints are not verified yet.
- Reconnect from Live View opens the same Add Ring Device modal.

---

## 4. Ring API surface used

| Ring endpoint | Used by |
|---|---|
| `GET /v1/devices?include=status,capabilities,location,configurations` | Discover, Refresh |
| `GET /v1/devices/{id}` | client (built for later) |
| `GET /v1/devices/{id}/status` | Refresh status |
| `GET /v1/devices/{id}/capabilities` · `/location` · `/configurations` | client (built for later) |
| `GET /v1/history/devices/{id}/events` | Event history drawer, Live side panel |
| `GET /v1/users/me` | client (built for later) |
| `POST /v1/devices/{id}/media/streaming/whep/sessions` (`Content-Type: application/sdp`) | Live View start |
| `DELETE <Location URL>` | Live View stop |

All calls: `Authorization: Bearer <token>`, `cache: "no-store"`, 15 s timeout.

---

## 5. Data model

```ts
// Normalized discovery result (server → browser)
RingDiscoveredDevice {
  id, name, type: "doorbell"|"camera"|"chime"|"device", manufacturer: "Ring",
  model?, imageUrl?,
  status: { online: boolean|null, label: "Online"|"Offline"|"Unknown", reportedAt?, batteryPercentage?, signalStrength? },
  location?: { country?, state? },
  capabilities: { video?, motionDetection?, snapshot?, privacyZones?, nightVision?, audio?, battery?, maxResolution?, codecs? },
  configuration?: { motionEnabled?, hasMotionZones?, hasPrivacyZones? },
  source: "ring-playground"
}

// Persisted connected device (never contains the token)
ConnectedRingDevice {
  id, ringDeviceId, ringName, displayName, deviceType, model?, imageUrl?, locationLabel?,
  status: "online"|"offline"|"unknown", statusReportedAt?, capabilities: string[], details, region?,
  source: "ring-playground", connectedAt, lastSyncedAt, aiEnabled, favorite
}
```

---

## 6. Security checklist (spec §3, §9, §17, §28, §29)

- [x] Browser never calls Ring directly; all Ring requests are server-to-server.
- [x] Token sent once, in a POST body over HTTPS — never in a URL/query string.
- [x] Token stored only in server memory; browser gets an HttpOnly cookie with a random session id.
- [x] Token never returned in any API response.
- [x] No `console.log(token)` / headers / bodies — logs are structured events only (`ring_discovery`, `ring_request_error`, `ring_whep_started`, …).
- [x] No `RING_TOKEN` / `NEXT_PUBLIC_RING_*` env vars; no `.env` files created.
- [x] No `localStorage` / `sessionStorage` for the token.
- [x] `DELETE` of WHEP sessions only accepts URLs under `https://api.amazonvision.com/v1/devices/…/media/streaming/whep/sessions/` (no open proxy).
- [x] Input limits: token ≤ 8192 chars, SDP offer ≤ 64 KB and must start with `v=0`, ≤ 50 devices per save, names/locations ≤ 60 chars.
- [x] Ring internal IDs (`ava1.ring.device.…`) are never shown to users.

---

## 7. Testing hook (test-only)

`RING_API_BASE_URL` (server-only env var, default `https://api.amazonvision.com`) may be pointed at a local emulator **for automated tests only**. It is not a token, not `NEXT_PUBLIC_`, and not used in production. Example used during verification:

```bash
RING_API_BASE_URL=http://localhost:4010 pnpm start -p 3210
```

with a small Node emulator serving the recorded `devices.json` fixture (plus a second offline device to exercise multi-select/offline states).

---

## 8. Files added / changed

```
lib/ring/{constants,types,errors,normalize,client,session,http}.ts
lib/api/ring.ts
lib/api/client.ts                          (ApiError now carries the JSON payload)
app/api/ring/discover/route.ts
app/api/ring/session/route.ts
app/api/ring/devices/route.ts
app/api/ring/devices/[id]/route.ts
app/api/ring/devices/[id]/status/route.ts
app/api/ring/devices/[id]/events/route.ts
app/api/ring/devices/[id]/stream/route.ts
app/api/ring/refresh/route.ts
components/devices/*                       (13 files, see §3)
components/pages/DevicesPage.tsx           (container: Ring vs Demo source)
components/pages/DemoDevicesView.tsx       (former mock page, now explicit demo mode)
components/pages/LivePage.tsx              (Ring cameras + WebRTC player)
next.config.ts                             (allow Ring product images: app-content.ring.com)
package.json                               (+ server-only)
```

---

## 9. Verification performed

| Check | Result |
|---|---|
| `tsc --noEmit`, `next build` | Clean |
| Normalizer vs. **real recorded Playground response** | Doorbell Pro · Online · 1080p AVC · chips: Video 1080p, Motion, Snapshot, Night vision, Privacy zones ✔ |
| Bogus token → **real** `api.amazonvision.com` | HTTP 401 → `RING_TOKEN_INVALID` → "Unable to connect" screen ✔ |
| Empty token / no session / save without session | 400 `RING_TOKEN_MISSING` · 401 `RING_NO_SESSION` ✔ |
| Full success path (browser-driven, emulator) | Connect → Discover → Select → Configure → Save → Devices page → persists after reload → detail drawer → event history → Refresh ✔ |
| Live View plumbing (browser-driven, emulator) | Card **Live View** → `/live?camera=ring:…` → Start → SDP offer reaches backend → Ring (emulated) returns 201 + answer → applied. Final media negotiation can only complete against the real Ring endpoint (emulator has no WebRTC). |
| Token-leak sweep | Token strings absent from dev logs; no browser storage; no env vars ✔ |
| Real Playground run (by the product owner) | `ring_discovery success count: 1` (the Playground's single synthetic device); refresh round-trips 5–12 s ✔ |

---

## 10. How to demo

1. Open **https://developer.amazon.com/ring/console/playground** → generate a token (valid 30 min) → copy it.
2. Matan → **Devices → Add Ring Device** → paste the token → **Validate & Discover Devices**.
3. Select the Playground Device → **Configure** (e.g. name "Front Door Camera", location "Front Entrance") → **Save**.
4. The Devices page now shows the real device with a live token countdown.
5. In the Playground, under **3. Simulate live view event**, click **Package / Vehicle / Motion**.
6. Matan → device card → **Live View** → **▶ Start Ring live view** to stream the simulated clip via WebRTC.
7. After ~30 min the session card turns red → **Reconnect Ring** with a new token. Connected devices stay listed.

---

## 11. Acceptance criteria (spec §41)

| Area | Status |
|---|---|
| A. Empty state — no fake devices without a connection; CTA visible | ✔ |
| B. Token — masked, show/hide, never logged / stored / `NEXT_PUBLIC_` | ✔ |
| C. Backend — no browser→Ring calls; runtime Bearer; `no-store` | ✔ |
| D. Discovery — valid token → devices; friendly errors; empty state; no Ring IDs shown | ✔ |
| E. Selection — single/multi/select-all/clear; local name & location | ✔ |
| F. Persistence — devices on the Devices page; `source: "ring-playground"`; no token in records | ✔ |
| G. Expiration — visible countdown/expired state; reconnect; no silent fallback to fake devices | ✔ |
| H. UX — loading/error/success states; keyboard-accessible modal; Matan design | ✔ |

## 12. Not implemented (intentionally, per spec §2)

Production OAuth/Appstore account linking, refresh tokens, physical provisioning, device control actions (siren/lights/lock) for Ring devices, and automatic token refresh. Live View is implemented as the first slice of the next milestone; AI analysis of live Ring streams and webhook event ingestion come next.

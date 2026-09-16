# MATAN AI — Ring Simulator Add Device Integration Specification

## Purpose

Implement the **Add Device** flow in the existing MATAN AI Next.js application.

For the hackathon prototype, MATAN AI will connect to the **Ring Developer Playground / Ring API simulation environment** rather than requiring a physical Ring device or a full production Appstore OAuth integration.

The most important rule is:

> **Do not hard-code a Ring Playground token in `.env`, source code, mock data, local storage, or Git.**

The Ring Developer Playground generates a temporary OAuth token that is valid for **30 minutes**. Ring introduced the Playground specifically to test Ring device, media, and account APIs without first creating a full Appstore application, completing account linking, or having an active Ring subscription.

Official reference: https://developer.amazon.com/docs/ring/release-notes.html

---

# 1. What the Add Device flow should actually mean

Do **not** ask the user for a Ring device ID as the first step.

The Ring API is authenticated with a Bearer access token. Once authenticated, the device discovery endpoint can return the Ring devices accessible to that token.

Primary API:

```text
GET https://api.amazonvision.com/v1/devices
```

Optional related resources:

```text
GET https://api.amazonvision.com/v1/devices?include=status,capabilities,location,configurations
```

The Ring API documentation describes Device Discovery as the entry point for retrieving devices accessible to the authenticated application/user. Device records can be related to status, capabilities, location, and configurations.

Official reference: https://developer.amazon.com/docs/ring/api-documentation.html

Therefore the UX should be:

```text
Add Device
   ↓
Connect Ring Simulator
   ↓
Paste temporary Playground token
   ↓
Validate token
   ↓
Discover Ring devices
   ↓
Show discovered devices
   ↓
User selects device(s)
   ↓
Optional local name/location
   ↓
Save selected device(s)
   ↓
Refresh Devices page
```

This is more correct than:

```text
Add Device
→ Device Name
→ Type
→ Location
```

because those fields do not authenticate the Ring account or discover a real Ring device.

---

# 2. Scope for the hackathon prototype

## In scope

Implement:

- Ring Playground token input
- Token visibility toggle
- Token validation
- Device discovery
- Device list from Ring API
- Device selection
- Device details
- Optional local display name
- Optional local location label
- Save selected device(s)
- Remove selected device(s)
- Refresh connection
- Connection status
- Token-expiry countdown/status
- Token-expired state
- API error handling
- Loading/skeleton states
- Empty state
- Reconnect flow
- Real Ring API calls through the backend
- Keep mock data for unrelated pages only

## Out of scope for this phase

Do not implement yet:

- Ring production OAuth Appstore account linking
- Physical device provisioning
- Ring account password collection
- Long-term production token management
- Automatic refresh-token implementation for the Playground token
- Fake/generated Ring device records on the real Ring connection path
- Automatic device control actions unless the exact endpoint/capability is verified
- Automatic refresh of a 30-minute Playground token

---

# 3. Critical security rule

Ring's current documentation states that requests to the Amazon Vision API and Ring OAuth server must be performed **server-to-server** from the Partner App Backend. Browser-initiated requests to Ring endpoints can be blocked by CORS.

Correct:

```text
Browser
   │
   │ token over HTTPS
   ▼
MATAN AI Next.js backend
   │
   │ Authorization: Bearer <token>
   ▼
https://api.amazonvision.com
```

Incorrect:

```text
Browser
   │
   └── fetch("https://api.amazonvision.com/v1/devices")
```

Use:

```text
Browser
   │
   └── POST /api/ring/discover
             │
             ▼
        Next.js server
             │
             ▼
       Ring API
```

Official reference: https://developer.amazon.com/docs/ring/api-documentation.html

---

# 4. What information the user enters

The Add Device modal should NOT ask for unnecessary information before discovery.

## Required

### Ring Playground Access Token

Label:

> Ring Playground Access Token

Helper text:

> Generate a temporary token from the Ring Developer Playground, then paste it here.

Secondary helper:

> The Playground token expires after 30 minutes. Do not share or commit it.

Field:

```text
[ eyJhbGciOi...                                      ] [Show/Hide]
```

Buttons:

```text
Cancel
Discover Ring Devices
```

## Optional after discovery

Once devices are returned, allow the user to configure each selected device:

- Matan display name
- Location label
- Favorite device
- Enable AI analysis

Example:

```text
Device name
[ Front Door Camera ]

Location
[ Front Entrance ]

☑ Favorite
☑ Enable Matan AI analysis
```

The Ring API's device `name` is the original Ring-assigned/user-assigned name. Store the Matan display name separately. Ring's UX guide recommends displaying the user's assigned Ring device name, not raw internal device IDs.

Official reference: https://developer.amazon.com/docs/ring/ux-design-guide.html

---

# 5. Recommended Add Device UX

## Step 1 — Empty state

When no real Ring devices are connected:

```text
Connect your Ring devices

Matan AI uses Ring events and media to understand
what is happening around your home or business.

[ + Add Ring Device ]
```

Use the existing MATAN AI visual design.

Do not display fake Ring cameras in this area when the user chooses the real Ring connection path.

---

# 6. Add Device modal

## Header

```text
Add a Ring device
Connect Matan AI to your Ring Playground simulation.
```

### Step indicator

```text
1 Connect   2 Discover   3 Select   4 Finish
```

---

# 7. Connect step

Card:

```text
Ring Developer Playground

Generate a temporary access token in the Ring Developer Playground.

Token lifetime
30 minutes

[ Open Ring Playground ↗ ]

Ring Playground Access Token
[ •••••••••••••••••••••••••••• ] [eye]

[ Validate & Discover Devices ]
```

Below the field:

```text
🔒 Your token is sent only to the MATAN AI backend
for the Ring API request.

Do not commit this token to source control.
```

Use the official Amazon/Ring developer destination in the project docs for the external link.

---

# 8. Token input behavior

## Initial state

Placeholder:

> Paste your temporary Ring Playground token

Button disabled until non-empty.

## Show/hide

Use an eye icon.

Default:

```text
••••••••••••••••
```

Visible:

```text
eyJhbGciOi...
```

## Trim whitespace

Before sending:

```ts
const token = rawToken.trim();
```

Do not modify the token otherwise.

---

# 9. Validate token

When the user clicks:

> Validate & Discover Devices

call:

```text
POST /api/ring/discover
```

Request:

```json
{
  "token": "<playground_token>"
}
```

Never put the token in a URL/query string.

Never send it to analytics.

Never log it.

Never put it into browser persistent storage.

---

# 10. Backend endpoint

Create:

```text
app/api/ring/discover/route.ts
```

or the equivalent route location used by the existing Next.js application.

Server behavior:

1. Read the JSON body.
2. Validate that a token exists.
3. Trim whitespace.
4. Call Ring API server-side.
5. Normalize the Ring response.
6. Return safe device metadata.
7. Never return the token.
8. Never log the token.
9. Map Ring API errors into clear MATAN AI errors.

Example server-side request:

```ts
const response = await fetch(
  "https://api.amazonvision.com/v1/devices?include=status,capabilities,location,configurations",
  {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  }
);
```

---

# 11. Backend response normalization

Do not expose raw Ring JSON:API structures directly to UI components.

Normalize them into an application type.

Recommended TypeScript type:

```ts
type RingDiscoveredDevice = {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  status: {
    online: boolean;
    label: "Online" | "Offline" | "Unknown";
  };
  location?: {
    country?: string;
    state?: string;
  };
  capabilities?: {
    video?: boolean;
    motionDetection?: boolean;
    snapshot?: boolean;
  };
  configuration?: {
    hasMotionZones?: boolean;
    hasPrivacyZones?: boolean;
  };
  source: "ring-playground";
};
```

Use the internal Ring device ID only in the backend/data layer.

UI should show:

```text
Front Door Camera
Ring Stick Up Cam
Online
Front Entrance
```

not:

```text
ava1.ring.device.NME52IQRABJ...
```

The Ring UX guide explicitly says not to display raw internal identifiers to customers.

---

# 12. Discovery results screen

After successful discovery:

```text
Ring devices found

We found 4 devices available to Matan AI.

[Search devices...]

☑ Front Door
   Ring Video Doorbell
   Online
   Front Entrance

☐ Backyard
   Ring Outdoor Cam
   Online
   Backyard

☐ Driveway
   Ring Outdoor Cam
   Online
   Driveway

☐ Living Room
   Ring Indoor Cam
   Offline
   Living Room
```

Top right:

```text
4 devices found
```

Bottom:

```text
[ Back ]                  [ Add Selected Devices ]
```

---

# 13. Device cards

Each card should include:

### Thumbnail

Use a real Ring snapshot only when the current API response provides an appropriate media resource and the feature is intentionally implemented.

Do not block device discovery if no image is available.

Fallback:

```text
Camera icon
Preview unavailable
```

### Information

```text
Front Door
Ring Video Doorbell
Online
Front Entrance
```

### Capability chips

Examples:

```text
Video
Motion
Snapshot
```

Only display a capability when it is known from the API.

---

# 14. Device selection

The user can:

- select one device
- select multiple devices
- select all
- deselect all

Header:

```text
4 devices found
2 selected
```

Controls:

```text
Select all
Clear
```

---

# 15. Step 3 — Configure selected devices

For every selected device:

```text
Ring device
Front Door

Ring name
Front Door

Matan AI name
[ Front Door Camera ]

Location
[ Front Entrance ]

AI analysis
[ ON ]

Favorite
[ OFF ]
```

The original Ring name remains unchanged.

The Matan display name and location are local application metadata.

---

# 16. Local data model

Create a connected-device record independent from the rest of the UI mock dataset.

Recommended type:

```ts
type ConnectedRingDevice = {
  id: string;
  ringDeviceId: string;
  ringName: string;
  displayName: string;
  deviceType: string;
  model?: string;
  locationLabel?: string;
  status: "online" | "offline" | "unknown";
  capabilities: string[];
  source: "ring-playground";
  connectedAt: string;
  lastSyncedAt: string;
  aiEnabled: boolean;
  favorite: boolean;
};
```

Important:

> **Do not store the raw Playground token inside this device object.**

---

# 17. Token storage strategy

For this hackathon simulation flow, prefer one of these approaches.

## Option A — Server-side in-memory/session state

Store the temporary token server-side, associated with a temporary demo session.

Pros:

- raw token does not remain in browser state
- simple for a controlled hackathon demo

Cons:

- lost on server restart
- not production architecture

## Option B — Secure server-side session

If the existing project has user sessions, keep the token in secure server-side session state.

Use:

- HTTP-only session cookie
- server-side encrypted session storage
- no JavaScript access to the raw token after submission

## Do NOT use

- localStorage
- sessionStorage for the raw token
- URL query parameters
- Redux persisted storage
- `NEXT_PUBLIC_RING_TOKEN`
- a hard-coded token
- a token committed to GitHub

For the hackathon demo, re-entering a newly generated Playground token after expiry is acceptable and clearer than pretending the token is permanent.

---

# 18. Token/session expiration UX

The Playground token is temporary.

Create a token-state model:

```ts
type TokenStatus =
  | "missing"
  | "validating"
  | "valid"
  | "expiring"
  | "expired"
  | "invalid";
```

Display a status area such as:

```text
Ring Playground session

Token expires in 24:37
```

Under five minutes:

```text
⚠ Token expires soon

Generate a new Ring Playground token to continue.
```

When expired:

```text
🔒 Ring Playground session expired

Your temporary token has expired.

[ Reconnect Ring ]
```

Do not silently switch back to fake Ring data after expiration.

---

# 19. Successful connection

After the user saves selected devices:

```text
✓ Ring connected

Matan AI found 4 Ring devices.

Connected:
• Front Door
• Backyard
• Driveway
• Living Room

[ View Devices ]
```

Update the Devices page immediately.

---

# 20. Devices page after connection

Show something like:

```text
Devices

4 Ring devices connected
● 3 Online
● 1 Offline

[ Add Ring Device ]
[ Refresh ]
```

Each real connected device can expose:

```text
[Live View]
[Events]
[...]
```

Only enable functions that are actually supported for that device/capability.

---

# 21. Refresh devices

Create a server route such as:

```text
GET /api/ring/devices
```

or a POST refresh route if that better matches existing architecture.

Use the active server-side Playground token/session.

If the token is expired, return a normalized application error such as:

```json
{
  "code": "RING_TOKEN_EXPIRED",
  "message": "The Ring Playground token has expired. Generate a new token."
}
```

Do not return raw Ring errors to the UI.

---

# 22. Remove device

When the user removes a device:

```text
Remove Front Door?

This removes the device from Matan AI.
It does not remove the Ring device from your Ring account.

[ Cancel ]
[ Remove Device ]
```

For the current prototype, remove it from Matan AI's connected-device store.

Do not imply that this deletes the Ring device/account unless a verified Ring endpoint is actually used.

---

# 23. Error states

## Invalid or expired token

```text
Unable to connect

The Ring Playground token is invalid or expired.

Generate a new token in the Playground and try again.

[ Try Again ]
```

## Forbidden

```text
Access denied

The token does not have permission to access these Ring resources.
```

## Rate limited

```text
Ring API rate limit reached

Please wait a moment before trying again.
```

Respect the `Retry-After` header when the API provides it.

## Service unavailable

```text
Ring service temporarily unavailable

Please try again shortly.
```

## No devices

```text
No Ring devices found

The token is valid, but no accessible devices were returned.

Check the Ring Playground session and try again.
```

Ring documents common HTTP errors including 401, 403, 404, 429, 500, and 503.

---

# 24. Mock data rule

The rest of the application can continue to use mock data for pages such as:

- Home
- AI Insights
- AI Assistant
- Business
- Care & Family
- Security Modes
- Analytics

But:

## Add Device MUST NOT use mock devices on the real Ring connection path.

The real flow must call the backend Ring API.

If a local demo fallback is useful, expose it as an explicit option:

```text
Connect Ring
-----------------------
Real Ring Playground API

Demo Mode
-----------------------
Use local sample data
```

Never silently replace a failed Ring connection with fake data.

---

# 25. Ring API layer

Create a clean abstraction:

```text
lib/
  ring/
    client.ts
    types.ts
    normalize.ts
    errors.ts
    constants.ts
```

Suggested functions:

```ts
discoverRingDevices(token: string)
getRingDevice(token: string, deviceId: string)
getRingDeviceStatus(token: string, deviceId: string)
getRingDeviceCapabilities(token: string, deviceId: string)
getRingDeviceLocation(token: string, deviceId: string)
getRingDeviceConfigurations(token: string, deviceId: string)
getRingDeviceEvents(token: string, deviceId: string)
```

For this milestone, only `discoverRingDevices()` is required.

Build the remaining functions behind the same abstraction for later pages.

---

# 26. Suggested API routes

```text
POST   /api/ring/discover
GET    /api/ring/devices
POST   /api/ring/refresh
DELETE /api/ring/devices/:id
GET    /api/ring/devices/:id/status
GET    /api/ring/devices/:id/capabilities
GET    /api/ring/devices/:id/events
```

Never put the token in the URL.

---

# 27. Request lifecycle

```text
User enters token
      │
      ▼
Client validates non-empty
      │
      ▼
POST /api/ring/discover
      │
      ▼
Next.js server receives token
      │
      ▼
Server calls Amazon Vision API
      │
      ▼
GET /v1/devices
      │
      ▼
Ring returns JSON:API data
      │
      ▼
Server normalizes response
      │
      ▼
Client receives safe device metadata
      │
      ▼
User selects devices
      │
      ▼
Matan AI saves local device metadata
```

---

# 28. No token logging

Never write:

```ts
console.log(token);
console.log(request.headers);
console.log(body);
```

Use sanitized logs:

```ts
console.log({
  event: "ring_discovery",
  success: true,
});
```

For failures:

```ts
console.error({
  event: "ring_discovery_failed",
  status: response.status,
});
```

Never log:

- access token
- Authorization header
- client secret
- refresh token
- HMAC signing key

---

# 29. Environment variables

## Do NOT create a Playground token environment variable

Do not create:

```env
RING_TOKEN=
NEXT_PUBLIC_RING_TOKEN=
```

The token is intentionally entered at runtime for the hackathon simulation.

Environment variables are appropriate later for the production Ring Appstore integration, such as:

```env
RING_CLIENT_ID=
RING_CLIENT_SECRET=
RING_HMAC_SIGNING_KEY=
RING_TOKEN_EXCHANGE_URL=
RING_WEBHOOK_URL=
```

Keep confidential values server-only.

Official configuration reference:
https://developer.amazon.com/docs/ring/configure.html

---

# 30. Ring API base URL

Create one server-side constant:

```ts
const RING_API_BASE_URL = "https://api.amazonvision.com";
```

Then build URLs from it.

Do not duplicate the base URL throughout the application.

Official reference:
https://developer.amazon.com/docs/ring/api-documentation.html

---

# 31. Cache behavior

For Ring device requests:

```ts
fetch(url, {
  cache: "no-store",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

Avoid caching user-specific Ring responses in the Next.js layer.

---

# 32. Loading state

While discovery runs:

```text
Discovering your Ring devices...

[spinner]

Connecting securely to Ring
Reading device information
```

Disable the submit button.

Prevent duplicate requests.

---

# 33. Success state animation

After discovery succeeds:

```text
✓ Connected
```

Then animate device cards into view.

Use subtle transitions only (roughly 150–250ms). Maintain the existing MATAN AI visual language.

---

# 34. Accessibility

The Add Device experience should include:

- keyboard-navigable modal
- visible focus styles
- labels for every form control
- accessible show/hide token control
- `aria-live` announcements for success/error
- no color-only status communication
- strong contrast
- Escape closes the modal
- focus trap while the modal is open
- screen-reader-friendly step indicators

Ring's UX design guidance references WCAG 2.2 Level AA.

Official reference:
https://developer.amazon.com/docs/ring/ux-design-guide.html

---

# 35. Recommended UI copy

### Connect screen

**Connect your Ring**

> Use a temporary Ring Developer Playground token to connect Matan AI to simulated Ring devices.

### Token helper

> Playground tokens are temporary and expire after 30 minutes.

### Security helper

> Your token is used only to communicate with Ring through the Matan AI backend.

### Discovery

**Discover devices**

> Find the Ring devices available to this Playground session.

### Success

**Ring connected**

> Matan AI found your available Ring devices.

### Expiration

**Ring Playground session expired**

> Generate a new token in the Ring Developer Playground to reconnect.

---

# 36. Playground developer workflow

For the demo operator:

1. Open the Ring Developer Playground.
2. Generate a temporary OAuth token.
3. Copy the token.
4. Open Matan AI.
5. Click **Add Ring Device**.
6. Paste the token.
7. Click **Discover Ring Devices**.
8. Matan AI backend calls `GET /v1/devices`.
9. Display the returned devices.
10. Select device(s).
11. Optionally set Matan display names/locations.
12. Save them.
13. The Devices page uses the connected Ring records.

The Playground currently provides an interactive API explorer with live JSON responses and cURL examples, plus live-view simulation for Package, Vehicle, and Motion event types.

Official reference:
https://developer.amazon.com/docs/ring/release-notes.html

---

# 37. Device discovery is separate from live-view simulation

Do not mix these concepts:

```text
Device Discovery
```

and:

```text
Live View Event Simulation
```

The Playground supports live-view simulation for Package, Vehicle, and Motion events, including a WebRTC/WHEP workflow.

For this milestone:

> **Only implement Add Device → Token → Device Discovery.**

Live view and event handling are later milestones.

---

# 38. Connected-device source-of-truth rule

Once real Ring devices are connected:

```text
REAL RING DATA
    ↓
connected Ring devices
    ↓
Matan AI local metadata
    ↓
UI
```

Do not silently do:

```text
Mock device array
    ↓
UI
```

for connected Ring devices.

---

# 39. Do not fabricate unavailable fields

When the Ring API does not return a value, display an honest fallback:

```text
Firmware
Not available
```

instead of inventing a firmware version.

Likewise, do not fabricate Wi-Fi strength, battery percentage, status, capabilities, or images.

Mock data can continue to enrich unrelated prototype screens, but Ring-connected device facts must come from the Ring API.

---

# 40. Recommended file structure

```text
matan-ai/
├── app/
│   ├── api/
│   │   └── ring/
│   │       ├── discover/
│   │       │   └── route.ts
│   │       ├── devices/
│   │       │   └── route.ts
│   │       └── refresh/
│   │           └── route.ts
│   │
│   ├── devices/
│   │   └── page.tsx
│   │
│   └── ...
│
├── components/
│   ├── devices/
│   │   ├── add-ring-device-modal.tsx
│   │   ├── ring-token-input.tsx
│   │   ├── ring-device-discovery.tsx
│   │   ├── ring-device-card.tsx
│   │   ├── ring-device-selector.tsx
│   │   └── ring-connection-status.tsx
│   │
│   └── ...
│
├── lib/
│   └── ring/
│       ├── client.ts
│       ├── types.ts
│       ├── normalize.ts
│       ├── errors.ts
│       └── constants.ts
│
└── ...
```

---

# 41. Acceptance criteria

The Add Device feature is complete only when all of the following work.

## A. Empty state

- [ ] Devices page shows no fake Ring devices when no Ring connection exists.
- [ ] Add Ring Device CTA is visible.

## B. Token

- [ ] User can paste a Playground token.
- [ ] Token is masked by default.
- [ ] Show/hide works.
- [ ] Token is never printed to console.
- [ ] Token is never stored in localStorage.
- [ ] Token is never exposed as `NEXT_PUBLIC_*`.

## C. Backend

- [ ] Browser does not call Ring directly.
- [ ] Next.js backend calls Ring API server-side.
- [ ] Authorization header uses the runtime token.
- [ ] Ring fetches use `cache: "no-store"`.

## D. Discovery

- [ ] Valid token returns Ring devices.
- [ ] Invalid/expired token produces a friendly error.
- [ ] Empty result produces a correct empty state.
- [ ] Ring IDs are not shown to the user.

## E. Selection

- [ ] User can select one device.
- [ ] User can select multiple devices.
- [ ] User can select/deselect all.
- [ ] User can set local display name.
- [ ] User can set local location.

## F. Persistence

- [ ] Saved devices appear on the Devices page.
- [ ] Device source is `ring-playground`.
- [ ] Raw token is not part of device records.

## G. Expiration

- [ ] Token/session expiration state is visible.
- [ ] User can reconnect with a newly generated Playground token.
- [ ] App does not silently revert to fake Ring devices.

## H. UX

- [ ] Loading state exists.
- [ ] Error state exists.
- [ ] Success state exists.
- [ ] Modal is keyboard accessible.
- [ ] UI matches MATAN AI visual design.

---

# 42. Important distinction: Playground vs production

The manual-token workflow is intentionally for the hackathon's Ring Playground simulation path.

It is NOT the final production Ring Appstore architecture.

For production, Ring documents OAuth 2.0 account linking and secure token management with partner credentials and backend endpoints. Ring's production lifecycle includes account authorization, token exchange, device discovery, and webhook event delivery.

Production architecture will eventually look like:

```text
Ring user authorization
        ↓
OAuth 2.0 account linking
        ↓
Token exchange
        ↓
Access + refresh tokens
        ↓
Device discovery
        ↓
Webhooks
```

Current hackathon architecture:

```text
Ring Developer Playground
        ↓
Temporary 30-minute token
        ↓
Matan AI backend
        ↓
Device Discovery API
        ↓
Devices page
```

Keep these architectures separate in code so the frontend does not need to be redesigned later.

Official references:

- https://developer.amazon.com/docs/ring/develop.html
- https://developer.amazon.com/docs/ring/api-documentation.html

---

# 43. Recommended implementation order

Implement in exactly this order:

## Phase 1

Create the Ring client:

```text
lib/ring/client.ts
```

## Phase 2

Create:

```text
POST /api/ring/discover
```

## Phase 3

Replace the Add Device mock modal with the real Playground token input.

## Phase 4

Display real discovered devices.

## Phase 5

Add multi-select and local metadata.

## Phase 6

Persist connected devices.

## Phase 7

Update the Devices page to read real connected Ring devices.

## Phase 8

Implement token-expiry/reconnect UX.

## Phase 9

Test end-to-end using the Ring Developer Playground.

## Phase 10

Only after this works, implement additional API-backed pages:

```text
Status
Capabilities
Locations
Configurations
Event History
Live View
```

---

# 44. Final UI objective

The Add Device experience should feel like this:

```text
┌─────────────────────────────────────────────┐
│ +  Add a Ring device                    ×  │
│                                             │
│ Connect Matan AI to your Ring Playground   │
│                                             │
│ 1 Connect   2 Discover   3 Select   4 Done │
│                                             │
│ Ring Developer Playground                   │
│ Generate a temporary token in the Ring      │
│ Developer Playground.                       │
│                                             │
│ [ Open Ring Playground ↗ ]                  │
│                                             │
│ Ring Playground Access Token                 │
│ ┌─────────────────────────────────────────┐ │
│ │ •••••••••••••••••••••••••••••••••       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ⏱ Token expires after 30 minutes            │
│ 🔒 Used through Matan AI backend            │
│                                             │
│               [Cancel] [Discover Devices]  │
└─────────────────────────────────────────────┘
```

After discovery:

```text
┌─────────────────────────────────────────────┐
│ Ring devices found                     ×   │
│                                             │
│ 4 devices found                2 selected  │
│                                             │
│ ☑ Front Door                                │
│   Ring Video Doorbell                       │
│   ● Online                                  │
│                                             │
│ ☑ Backyard                                  │
│   Ring Stick Up Cam                         │
│   ● Online                                  │
│                                             │
│ ☐ Driveway                                  │
│   Ring Outdoor Cam                          │
│   ● Online                                  │
│                                             │
│ ☐ Living Room                               │
│   Ring Indoor Cam                           │
│   ● Offline                                 │
│                                             │
│ [Back]                 [Add Selected]       │
└─────────────────────────────────────────────┘
```

Then:

```text
✓ Ring connected

Front Door Camera
Front Entrance
Online

Backyard Camera
Backyard
Online

[View Devices]
```

---

# 45. Final instruction to the coding agent

Build the feature as a **real Ring Developer Playground integration**, not a visual simulation.

The existing MATAN AI UI is already designed. Do not redesign unrelated pages.

Focus only on replacing the mocked Add Device behavior with:

```text
MATAN AI
   ↓
Add Ring Device
   ↓
Temporary Ring Playground Token
   ↓
Next.js server-side API route
   ↓
GET https://api.amazonvision.com/v1/devices
   ↓
Normalize Ring response
   ↓
Display real devices
   ↓
Select devices
   ↓
Save connected-device metadata
   ↓
Show real connected devices in Devices page
```

Do not create a Ring token in `.env`.

Do not hard-code a token.

Do not expose the token in client-side logs.

Do not call Ring API directly from browser JavaScript.

Do not use mock devices after a real Ring connection succeeds.

Do not fabricate Ring API fields.

Keep all existing MATAN AI styling and UX.

The result must be production-quality TypeScript/Next.js code, optimized for the **Ring Developer Playground simulation workflow used for the hackathon**.

# MATAN AI — Demo Mode & Real Mode UI/UX Specification

## Goal

Create one polished MATAN AI application with two clearly separated experiences:

- **Demo Mode** — all device/event/insight data is mock data.
- **Real Mode** — Ring Developer Playground / Simulator data is used through the existing real Ring integration.

The same UI, navigation, design system, account, theme system, and routes are shared. Only the data source and Ring connection state change.

The existing Ring implementation already supports the Playground token flow, server-side discovery, device selection/configuration, persistence, 30-minute session expiry/reconnect, and the first WHEP Live View slice. Do not rebuild those parts. This work is the product-level mode UX around them.

---

## 1. Product principle

The user must always understand three things:

1. **Which mode am I in?**
2. **Where is this data coming from?**
3. **What happens when my Ring Playground session expires?**

Use these exact source labels:

### Demo
`DEMO MODE · MOCK DATA`

### Real
`REAL MODE · RING SIMULATOR`

### Expired
`REAL MODE · SESSION EXPIRED`

Never label the simulator simply as “Live” or imply that a physical Ring device is connected.

Core product message:

> **Ring sees the event. Matan understands what matters.**

---

# 2. First-run mode selection

After login, if the user has never selected a mode, show a premium full-screen experience chooser before the main dashboard.

### Header

```text
MATAN AI
Your intelligent eye at home.
```

### Headline

```text
How would you like to explore Matan AI?
```

### Supporting copy

```text
Explore the complete experience with sample data,
or connect the Ring Developer Playground to test the real integration.
```

### Card 1 — Demo Mode

```text
✨ Demo Mode
Explore the full Matan AI experience

Use realistic sample devices, events, insights,
automations and reports.

MOCK DATA

[ Enter Demo ]

No Ring setup required
Instant access
```

### Card 2 — Real Mode

```text
◉ Real Mode
Connect Ring Simulator

Use a temporary Ring Developer Playground token
to discover and test simulated Ring devices.

RING SIMULATOR

[ Connect Ring ]

No physical Ring device required
Playground session: 30 minutes
```

### Theme control

Top-right:

```text
☾ Dark   ☀ Light   ◐ System
```

Default to the saved user preference.

---

# 3. Persistent global mode switch

Do not hide mode selection inside Settings. It is a primary product control.

Place it in the global header next to the MATAN AI identity/navigation.

Desktop:

```text
[ ✨ Demo Mode ] [ ◉ Real Mode ]
```

Mobile:

```text
[ D ] [ R ]
```

The active mode must have a filled surface and strong contrast. The inactive mode is still obviously clickable.

### Switching Demo → Real

```text
Click Real Mode
        ↓
Check Ring session
        ↓
Valid?
 ├─ YES → enter Real Mode
 └─ NO  → open Connect Ring flow
```

### Switching Real → Demo

Immediately switch to Demo without disconnecting the Ring session. Saved Ring devices remain available for the next Real session.

Preserve the current route when possible:

```text
/events → switch mode → /events
/live   → switch mode → /live
/devices → switch mode → /devices
```

---

# 4. Global source banner

Every major page should expose a lightweight source banner near the page heading.

## Demo banner

```text
┌────────────────────────────────────────────────────┐
│ ✨ DEMO MODE · MOCK DATA                           │
│ You're exploring Matan AI with simulated data.    │
│ Want to test the Ring integration?                 │
│ [ Switch to Real Mode → ]                          │
└────────────────────────────────────────────────────┘
```

Compact form:

```text
✨ Demo Mode · Mock data    [ Test Ring Simulator → ]
```

Use a soft purple/blue surface and do not make it visually louder than the page's main content.

## Real banner

```text
┌────────────────────────────────────────────────────┐
│ ◉ REAL MODE · RING SIMULATOR                      │
│ Connected to the Ring Developer Playground.       │
│ Session expires in 24:18                           │
│ [ Refresh ] [ Reconnect ]                          │
└────────────────────────────────────────────────────┘
```

Compact form:

```text
◉ Real Mode · Ring Simulator   Session 24:18
```

---

# 5. Real-session expiry UX

The Matan account does NOT expire when the Ring Playground token expires.

Separate these states:

```text
Matan Account → persistent
Ring Playground Session → temporary (~30 minutes)
```

When the token/session expires:

```text
🔒 Ring Simulator session expired
Generate a new Playground token to reconnect.
[ Reconnect Ring ]
```

The app remains usable.

Preserve:
- user account
- saved Matan settings
- automations
- Ring device metadata
- previous Matan event records

Disable only features that require an active Ring session.

Never silently switch to Demo Mode.

Never call an expired Ring connection “device offline”. Use:

`Connection expired`

---

# 6. Demo Mode rules

Demo Mode is a fully explorable product environment.

All data is synthetic and must be internally consistent across pages.

Recommended demo environment:

```text
4 simulated cameras
147 total events
58 people
31 packages
24 vehicles
18 animals
16 attention events
4 important events
```

The same logical dataset must drive:
- Home
- Events
- AI Insights
- AI Assistant
- Automations
- Security Modes
- Care & Family
- Business

Do not create unrelated random mock values on each page.

Every mock device/event card should carry a subtle `DEMO` indicator where confusion with real Ring data is possible.

---

# 7. Real Mode rules

Real Mode uses the existing Ring Playground integration.

Flow:

```text
Real Mode
   ↓
Connect Ring
   ↓
Paste temporary Playground token
   ↓
Server-side Ring discovery
   ↓
Select/configure device
   ↓
Connected Ring Simulator device
```

The browser must not call the Ring API directly. The existing implementation already follows the server-side boundary.

For Ring-backed fields, do not invent values.

If Ring does not provide something:

```text
Not available
```

If the session is expired:

```text
Session expired
```

---

# 8. Devices page

## Demo Mode

Heading:

```text
Demo Devices
```

Subtitle:

```text
Explore Matan AI using simulated devices.
```

Show mock cards with:

```text
DEMO
Front Door Camera
Simulated
```

CTA:

```text
[ Explore Demo Devices ]
[ Switch to Real Mode → ]
```

## Real Mode

Heading:

```text
Ring Devices
```

Subtitle:

```text
Devices discovered from the Ring Developer Playground.
```

Show:

```text
4 devices found
3 Online · 1 Offline

[ Add Ring Device ] [ Refresh ]
```

Use real device metadata from the existing Ring implementation.

Do not display raw Ring resource IDs.

---

# 9. Devices source switch

On the Devices page only, allow a quick source view toggle when useful:

```text
[ ◉ Ring Simulator ] [ Demo Devices ]
```

Or:

```text
Ring Devices (1)   Demo Devices
```

Default:
- Real Mode → Ring view
- Demo Mode → Demo view

A local preference may remember the view; never store the Ring token in browser storage.

---

# 10. Add Ring Device

Keep the already implemented four-step flow:

```text
1 Connect → 2 Discover → 3 Select → 4 Finish
```

First screen:

```text
Add a Ring device
Connect Matan AI to your Ring Playground.

Ring Playground Access Token
[ ••••••••••••••••••••••• ] [ Show ]

⏱ Temporary token · expires after 30 minutes
🔒 Used through the Matan AI backend

[ Open Ring Playground ↗ ]

[ Cancel ] [ Discover Ring Devices ]
```

Do not add a fake device in this flow.

Successful discovery shows actual Ring devices.

---

# 11. Home page

## Demo

Header:

```text
Good morning, Ajito 👋
Here's your Matan AI demo environment.
```

Hero status:

```text
✨ DEMO MODE
Everything is simulated.
```

## Real

Header:

```text
Good morning, Ajito 👋
Matan AI is connected to your Ring Simulator.
```

Hero status:

```text
◉ REAL MODE · RING SIMULATOR
```

Use the same visual layout but switch the data source.

---

# 12. Live View

## Demo

Use clearly marked simulated media:

```text
✨ DEMO CAMERA
Simulated live experience
```

Mock controls can remain active because this is a demo environment.

## Real

Use the existing WHEP implementation.

Header:

```text
◉ RING SIMULATOR
Front Door
LIVE
```

For endpoints/capabilities not yet verified, disable the control and explain why.

Expired session:

```text
Ring live view unavailable

Your Playground session has expired.

[ Reconnect Ring ]
```

---

# 13. Events page

## Demo

Use the consistent mock event dataset.

Examples:

```text
Person detected
Delivery detected
Vehicle detected
Unusual access
Animal detected
Doorbell pressed
```

Source badge:

`DEMO`

## Real

Use actual Ring event history where available.

Display the Ring source and Matan interpretation separately:

```text
SOURCE
Ring Simulator

EVENT
Person detected

DEVICE
Front Door

MATAN AI
Analyzing...
```

After the AI pipeline exists:

```text
MATAN AI ANALYSIS
Likely delivery
Confidence 86%
Priority Low

Reason:
Person + package + normal behavior

Action:
No immediate action required
```

Do not claim Nova has analyzed something until the Bedrock call has actually executed.

---

# 14. AI Insights

## Demo

Use the complete mock dataset:

```text
147 events
91% normal
7% attention
2% important
```

Label:

`DEMO DATA`

Charts should be interactive and internally consistent.

## Real

Use actual accumulated Matan/Ring data.

When insufficient real history exists:

```text
Building your insights

Matan AI needs more Ring events to create meaningful trends.

7 events currently analyzed
```

Do not fill real analytics with fake numbers.

---

# 15. AI Assistant

## Demo

Use the mock dataset as the assistant's knowledge source.

Badge:

`✨ Demo AI`

## Real

Use:
- connected Ring devices
- Ring event history
- Matan AI analysis
- user settings
- automation context

Badge:

`◉ Ring Simulator`

Recommended prompts:

```text
What happened today?
What happened while I was away?
Show unusual activity.
Which devices are online?
How many deliveries happened?
Why did I receive an alert?
```

---

# 16. Automations

Automations exist in both modes.

### Demo

```text
DEMO AUTOMATION
Runs on simulated events
```

### Real

```text
RING SIMULATOR AUTOMATION
Runs on Ring-derived events
```

Canonical structure:

```text
WHEN
Ring event

IF
condition/context

THEN
action
```

Example:

```text
WHEN Person detected
IF After 10 PM + Back Entrance
THEN Send Matan AI email alert
```

---

# 17. Security Modes

Modes are Matan-level policies and work in both environments:

```text
Home
Away
Night
Care
Business
Custom
```

Demo mode applies the rules to simulated events.
Real mode applies them to Ring-derived events.

Example:

```text
Night Mode
+
person detected
+
back entrance
+
repeated activity
=
higher priority
```

---

# 18. Care & Family

## Demo

Use synthetic family members/activity.

Badge:

`DEMO CARE DATA`

## Real

Only show real associations explicitly configured by the application.

Do not infer a person's identity from a generic Ring person detection.

Prefer:

`Person detected`

rather than falsely saying:

`Grandpa detected`

unless the application has a verified user mapping.

---

# 19. Business

## Demo

Show sample:
- locations
- team members
- access events
- delivery activity
- analytics

Badge:

`DEMO`

## Real

Use connected Ring device/event data plus Matan business rules.

Badge:

`RING SIMULATOR`

---

# 20. Settings

Add a first-class:

## Experience Mode

```text
Experience Mode

Choose how Matan AI should operate.

( ) Demo Mode
    Mock data for exploring the product.

(●) Real Mode
    Ring Developer Playground integration.
```

If Real is selected:

```text
Ring connection
◉ Connected
Expires in 24:18

[ Reconnect Ring ]
[ Disconnect Ring Session ]
```

Also make Theme global:

```text
Appearance

Theme
[ Dark ] [ Light ] [ System ]
```

---

# 21. Theme system

The same theme system must work in both modes.

## Dark

Deep navy/blue surfaces with:
- electric cyan/blue primary accent
- violet AI accent
- green success
- amber attention
- red important/danger

## Light

White/cool-gray surfaces with the same semantic accents.

Use semantic design tokens rather than hard-coded page colors.

Recommended font:

```text
Inter or Geist
```

Typography:
- 700–800 main headings
- 600 card headings
- 400–500 body
- tabular/monospaced numerals for countdowns

---

# 22. SourceBadge component

Create one reusable component:

```tsx
<SourceBadge source="demo" />
<SourceBadge source="ring" />
<SourceBadge source="ring-expired" />
```

Output:

```text
✨ DEMO · MOCK DATA
◉ REAL · RING SIMULATOR
🔒 REAL · SESSION EXPIRED
```

Use it across pages instead of manually rebuilding source labels.

---

# 23. ExperienceBanner component

Create:

```tsx
<ExperienceBanner />
```

Variants:

```text
demo
ring
ring-expiring
ring-expired
```

Responsibilities:
- source explanation
- switch-to-real CTA
- session countdown
- reconnect CTA
- consistent visual treatment

---

# 24. ExperienceModeSwitch component

Create:

```tsx
<ExperienceModeSwitch />
```

Responsibilities:
- display active mode
- switch mode
- preserve route
- check Ring session before entering Real Mode
- open Add Ring Device/reconnect when needed
- announce mode changes for accessibility

---

# 25. Shared data-source architecture

The UI should not contain separate page implementations for Demo and Real.

Use one shared interface:

```ts
interface MatanDataSource {
  getDevices(): Promise<Device[]>;
  getEvents(): Promise<Event[]>;
  getInsights(): Promise<Insight[]>;
  getStatus(): Promise<SystemStatus>;
}
```

Implement:

```text
DemoDataSource
RingDataSource
```

Then:

```ts
const dataSource =
  mode === "demo"
    ? demoDataSource
    : ringDataSource;
```

This is the most important architectural rule for the new UI layer.

---

# 26. Mode/session state

```ts
type AppMode = "demo" | "ring";

type RingConnectionState =
  | "not_connected"
  | "connecting"
  | "connected"
  | "expiring"
  | "expired"
  | "invalid";
```

These states are independent.

Valid example:

```ts
{
  mode: "ring",
  ringConnection: "expired"
}
```

The user remains in the app but needs to reconnect for Ring-backed features.

---

# 27. Account vs Ring session

Never couple these states.

```text
Cognito / Matan Account
        ↓
Persistent

Ring Playground Session
        ↓
Temporary ~30 min
```

After expiry:

```text
Account                ACTIVE
Saved Matan settings   ACTIVE
Automations            SAVED
Device metadata        SAVED
Ring API access        EXPIRED
```

---

# 28. Demo/Real welcome copy

### Demo

> **You're in Demo Mode. All devices, events, charts and alerts are mock data.**

> Want to test the real Ring integration? Switch to Real Mode and connect your Ring Developer Playground session.

CTA:

`Switch to Real Mode →`

### Real

> **Real Mode uses the Ring Developer Playground simulator. No physical Ring device is required.**

> Your temporary Playground token expires after approximately 30 minutes.

CTA:

`Manage Ring Connection`

---

# 29. Judge experience

The judge should have two obvious paths.

## Fast exploration

```text
Login
 ↓
Demo Mode
 ↓
Immediately explore the full application
```

## Technical Ring validation

```text
Login
 ↓
Real Mode
 ↓
Connect Ring
 ↓
Open Playground
 ↓
Generate token
 ↓
Paste token
 ↓
Discover simulator device
 ↓
Use Matan AI Ring flow
```

The Ring path must never require physical Ring hardware.

---

# 30. Accessibility requirements

Mode selection and banners must support:
- keyboard navigation
- visible focus
- screen-reader labels
- `aria-current="true"` for selected mode
- `aria-live` for session/error updates
- no color-only status communication
- Escape to close modal
- focus trap inside modal
- accessible show/hide token control

---

# 31. Responsive behavior

Desktop:
```text
[ ✨ Demo Mode ] [ ◉ Real Mode ]
```

Tablet:
```text
[ Demo ▾ ]
```

Mobile:
```text
[ D ] [ R ]
```

Tapping the mobile selector opens:

```text
Choose mode

✨ Demo Mode
Mock data

◉ Real Mode
Ring Simulator
```

Do not hide mode selection behind several layers of Settings.

---

# 32. Loading and transition UX

Demo → Real:

```text
Switching to Real Mode…
Checking Ring Simulator connection
Loading connected devices
Refreshing Matan context
```

Real → Demo:

```text
Switching to Demo Mode…
Loading sample environment
Preparing demo events
```

Keep transitions subtle, approximately 150–250ms. Do not use excessive glowing animations.

---

# 33. Notifications and emails

Demo:

```text
✨ Demo notification
Sample delivery detected.
```

Real:

```text
◉ Ring Simulator
Matan AI analyzed a new event.
```

Any mock email preview must clearly show `DEMO`.

---

# 34. Do not make these mistakes

Never:

- silently mix Demo and Ring datasets
- silently fall back from Real to Demo
- show a simulated camera as a real Ring camera
- show fake Ring device capabilities in Real Mode
- call an expired Playground connection “offline”
- store the Ring token in localStorage/sessionStorage
- expose the Ring token in `NEXT_PUBLIC_*`
- put the Ring token in a URL
- display raw Ring internal IDs
- claim Nova analyzed an event before the real Bedrock call exists

---

# 35. Recommended component organization

```text
components/
  experience/
    experience-mode-switch.tsx
    experience-banner.tsx
    mode-selection.tsx
    source-badge.tsx
    mode-transition.tsx

  devices/
    ...existing Ring components...

lib/
  data/
    types.ts
    get-data-source.ts
  demo/
    data.ts
    devices.ts
    events.ts
    insights.ts
  ring/
    ...existing Ring integration...
```

Keep the current Ring API/client/session implementation intact.

---

# 36. Acceptance criteria

## Mode selection

- [ ] User can choose Demo or Real after login.
- [ ] Selection is saved as a preference.
- [ ] User can switch mode globally.
- [ ] Current route is preserved when possible.

## Demo

- [ ] All displayed data is mock.
- [ ] Demo source is clearly labeled.
- [ ] Mock data is consistent across pages.
- [ ] No Ring token is required.

## Real

- [ ] Real Mode uses existing Ring Playground integration.
- [ ] Add Ring Device opens the real token/discovery flow.
- [ ] Ring-backed devices use actual API data.
- [ ] No fake Ring device is silently inserted.

## Expiry

- [ ] Ring session countdown is visible.
- [ ] Expiring state appears before expiry.
- [ ] Expired state does not break the Matan account.
- [ ] Reconnect asks for a new Playground token.
- [ ] No silent fallback to Demo.

## Theme

- [ ] Dark mode works.
- [ ] Light mode works.
- [ ] System mode works if implemented.
- [ ] Theme is independent of Demo/Real mode.

## Accessibility

- [ ] Keyboard accessible.
- [ ] Screen-reader labels.
- [ ] Focus states.
- [ ] `aria-live` for connection changes.

---

# 37. Final product experience

The entire product should feel like:

```text
                         MATAN AI
                  Your intelligent eye at home.

        ┌────────────────┐    ┌────────────────────┐
        │ ✨ DEMO MODE   │    │ ◉ REAL MODE        │
        │                │    │                    │
        │ Mock data      │    │ Ring Simulator     │
        │ Explore freely │    │ Test real Ring API │
        │                │    │                    │
        │ [ Enter Demo ] │    │ [ Connect Ring ]   │
        └────────────────┘    └────────────────────┘

                   Ring sees.
                Matan understands.
```

The product should never feel like two different applications. It is one MATAN AI platform with two explicit data experiences.

---

# 38. Final implementation instruction

Implement **Demo Mode and Real Mode as first-class application architecture**.

Do not create two separate frontends.

Use:

```text
ONE MATAN AI UI
+
ONE authenticated user account
+
TWO data sources
+
GLOBAL MODE SWITCH
```

```text
Demo Mode
→ DemoDataSource
→ Mock API/data
→ Fully explorable experience
```

```text
Real Mode
→ RingDataSource
→ Existing server-side Ring Playground integration
→ Real simulator data
```

Always expose the current source clearly.

When the Ring Playground session expires, keep the user account and saved Matan configuration. Mark Ring access as expired and require a new temporary token to resume Ring-backed features.

Prioritize:
1. clarity
2. trust
3. fast judge onboarding
4. premium visual quality
5. consistent data behavior
6. accessibility
7. clean separation between mock and Ring data

The target user experience is:

**Demo = explore the product.**

**Real = prove the Ring integration.**

**Matan AI = understand what matters.**

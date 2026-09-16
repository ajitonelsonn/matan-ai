# MATAN AI — Demo Mode & Real Mode: Implementation Report

**Spec:** `MATAN_AI_DEMO_REAL_MODE_UI_UX_SPEC.md`
**Status:** Implemented (September 2026). Builds on the Ring Add Device integration (`docs/RING_ADD_DEVICE_IMPLEMENTATION.md`), which was left intact.

---

## 1. What changed, in one picture

```
                    ┌──────────────── ONE MATAN AI UI ────────────────┐
                    │  same routes · same shell · same design tokens  │
                    └───────────────────────┬─────────────────────────┘
                                            │ useDataSource()
                       ┌────────────────────┴────────────────────┐
                 mode: "demo"                               mode: "ring"
                       │                                          │
               DemoDataSource                              RingDataSource
               /api/dashboard                              /api/ring/overview
               /api/events                                 /api/ring/overview/events
               /api/insights                               /api/ring/overview/insights
               (in-memory mock store)                      (connected Ring devices + Ring event history)
```

- **Experience mode** (`demo | ring`) is a first-class, persisted product state — independent from the Matan account and from the Ring Playground session.
- **Theme** (`dark | light | system`) is global and independent from mode.
- Pages don't branch to pick an implementation; they call the data source they're given (spec §25).

---

## 2. Experience state — `components/experience/experience-provider.tsx`

```ts
type AppMode = "demo" | "ring";
type RingConnectionState = "not_connected" | "connecting" | "connected" | "expiring" | "expired" | "invalid";
```

| Concern | Implementation |
|---|---|
| Persistence | `localStorage["matan.experience.mode"]` + a non-sensitive `matan_mode` cookie. `mode === null` means "never chosen" → first-run chooser. |
| Ring connection state | Polls `/api/ring/devices` every 60 s (and on the global refresh), derives state from the session countdown (`useRingCountdown`). |
| Demo → Real | Checks the Ring session: `connected`/`expiring` → transition + switch; otherwise opens the **Connect Ring** modal and switches only after a successful connection. |
| Real → Demo | Immediate (after the short transition). The Ring session and saved devices are kept for the next Real session. |
| Route preservation | Switching never navigates — `/events` stays `/events`, etc. |
| Accessibility | `aria-live` region announces "Demo Mode active…" / "Real Mode active…". Switch uses `role="radiogroup"`, `aria-checked`, `aria-current="true"`. |
| Independence | `{ mode: "ring", ring.state: "expired" }` is a normal, fully usable state — the app never falls back to Demo silently. |

---

## 3. Components — `components/experience/`

| File | Purpose |
|---|---|
| `source-badge.tsx` | `<SourceBadge source="demo" \| "ring" \| "ring-expiring" \| "ring-expired" />` → `✨ DEMO · MOCK DATA`, `◉ REAL · RING SIMULATOR`, `🔒 REAL · SESSION EXPIRED`. Plus `<DemoMarker />` (tiny "DEMO" corner tag). The only place source labels are rendered. |
| `experience-banner.tsx` | `<ExperienceBanner compact>` — demo / ring / ring-expiring / ring-expired variants; compact form under every page heading (rendered by `Topbar`), full form on Home. Carries the countdown, Refresh, Reconnect and "Switch to Real Mode →". |
| `experience-mode-switch.tsx` | Global `[ ✨ Demo Mode ] [ ◉ Real Mode ]` in the desktop topbar; `[ D ] [ R ]` in the mobile header. Real chip carries a dot coloured by Ring state. |
| `mode-selection.tsx` | Full-screen first-run chooser (headline, two cards with the spec copy, theme control top-right, GSAP entrance). Real card reads "Enter Real Mode" when a session already exists, else "Connect Ring". |
| `mode-transition.tsx` | ~0.9 s overlay with the spec copy ("Checking Ring Simulator connection… / Loading sample environment…"). |
| `experience-modals.tsx` | Global Connect/Reconnect Ring modal (reuses `AddRingDeviceModal`); on success sets the pending mode. |
| `experience-settings-card.tsx` | Settings → **Experience Mode** radio (Demo/Real) + Ring connection block (status, countdown, **Reconnect Ring**, **Disconnect Ring Session**). |
| `theme-provider.tsx` · `theme-toggle.tsx` · `theme-script.ts` | Global theme with `<html data-theme>`; inline pre-hydration script prevents a flash; `☾ Dark ☀ Light ◐ System` control. |
| `real-mode-care.tsx` · `real-mode-business.tsx` | Real Mode views for Care & Family and Business (see §6). |

---

## 4. Theme system

- All surfaces were tokenized (`--matan-card-from/to`, `--matan-inset-bg`, `--matan-skeleton-*`, body glows, grid lines, scrollbar) and a full **light palette** was added under `:root[data-theme="light"]` in `app/globals.css` — same semantic accents (cyan/blue primary, violet AI, green/amber/red status) on white/cool-gray surfaces.
- `ThemeProvider` stores `matan.theme`, resolves `system` via `prefers-color-scheme`, and stamps `data-theme` + `color-scheme`. The root layout runs `themeInitScript` before paint.
- Controls: first-run chooser (top-right), sidebar Dark/Light toggle (now real), Settings → Appearance → Theme (Dark / Light / System; mirrored into the saved preference).

---

## 5. Shared data-source architecture — `lib/data/`

```ts
interface MatanDataSource {
  readonly mode: "demo" | "ring";
  getDashboard(): Promise<DashboardData>;
  getEvents(query): Promise<EventListResponse>;
  getEvent(id): Promise<RingEvent>;
  getInsights(range): Promise<InsightsData>;
}
export const demoDataSource, ringDataSource;
export function useDataSource(): MatanDataSource;   // picks by current mode
```

### Ring read model — `lib/ring/overview.ts` (server-only)

- `getRingEvents()` — fetches `/v1/history/devices/{id}/events` for every connected device (60 s cache), maps each Ring `history-events` record with `ringEventToMatan()` (`lib/ring/adapter.ts`): `motion` → "Motion detected", `ding` → "Doorbell pressed", `on_demand` → "Live view session"; `cv_detections` labels (person/package/vehicle) refine the type when Ring provides them; `start`/`end` epoch-ms → timestamp/duration.
- Every Ring-derived event carries `source: "ring"` and **`analysis: "pending"`** — the UI shows an **"Awaiting AI"** pill instead of a priority, because the Matan AI (Bedrock) pipeline has not run (spec §13, §34).
- `buildRingDashboard()` / `buildRingEventList()` / `buildRingInsights()` produce the same shapes the demo API produces, from Ring data only. Insights text never claims findings; recommendations are operational ("Trigger a simulation", "Keep the session alive").
- After token expiry the cached events remain available → previous Matan records stay visible; live refresh is disabled ("Connection expired", never "device offline").
- Routes: `GET /api/ring/overview`, `GET /api/ring/overview/events[?id=]`, `GET /api/ring/overview/insights?range=`.

`AppDataProvider` (shell data: greeting, sidebar badge, device summary) now reads through `getDataSource(mode)` and reloads when the mode changes, so the two sources never mix.

---

## 6. Page behaviour by mode

| Page | Demo | Real |
|---|---|---|
| **Home** | Full demo banner; "Here's your Matan AI demo environment."; mock hero + stats; `DEMO · MOCK DATA` badge on the status card | "Matan AI is connected to your Ring Simulator."; hero = **WebRTC Ring player** for the featured device (or "Connect Ring" card); status card "Ring Simulator connected" with tiles *Events today · Devices online · Awaiting AI · Session left*; latest Ring events with "Awaiting AI"; honest empty states |
| **Live View** | `✨ Demo camera` label on the hero, `DEMO` markers on demo tiles, mock controls active | Defaults to the first Ring device; `◉ RING SIMULATOR` badge, real WHEP stream, Ring side panel; actuation controls disabled with explanation; expired → "Reconnect Ring" |
| **Events** | Consistent mock dataset, `DEMO` badge | Ring event history; detail shows **SOURCE / EVENT / DEVICE / MATAN AI: Awaiting analysis** block; no clip download/edits; "No Ring events recorded yet" empty state |
| **AI Insights** | 147-event mock dataset, `DEMO DATA` | Built from Ring history; **"Building your insights — N events currently recorded"** state until ≥ 10 events; never filled with fake numbers |
| **AI Assistant** | `✨ Demo AI` badge; mock-dataset answers | `◉ Ring Simulator` badge; `lib/ring/assistant.ts` answers only from connected devices + Ring history ("Which devices are online?", deliveries, today's summary…) and states that analysis is pending; conversations are kept **per mode** |
| **Automations** | "Demo automations run on simulated events" | "Ring Simulator automations run on Ring-derived events" (same Matan-level rules) |
| **Security Modes** | Matan-level policies on simulated events | Same policies on Ring-derived events |
| **Care & Family** | Synthetic family, `DEMO` badge | `RealModeCare`: no synthetic members, **no identity inference** — only "Person detected" from Ring, plus Matan-level care features |
| **Business** | Sample locations/team/analytics, `DEMO` | `RealModeBusiness`: one "Ring Simulator · Playground" location from connected devices, owner-only team, Ring recent events, "Awaiting Matan AI analysis" insights |
| **Devices** | "Demo Devices — Explore Matan AI using simulated devices." with `DEMO` markers and "Simulated" on cards | "Ring Devices — Devices discovered from the Ring Developer Playground · N Online · M Offline/Connection expired". The on-page Ring/Demo source switch follows the global mode by default. |
| **Settings** | **Experience Mode** card (first) + global Theme control | Same, plus Ring connection block with countdown, Reconnect, Disconnect |

---

## 7. Expiry UX (spec §5, §27)

- Countdown visible in the banner, session card, Home tile, and Settings (`mm:ss`, tabular/mono).
- `< 5 min` → **expiring** (amber) with "Token expires soon".
- Expired/invalid → `🔒 REAL · SESSION EXPIRED`; **Reconnect Ring** everywhere; account, settings, automations, device metadata and previous Ring event records are kept; Ring-backed live features are disabled. The app never switches to Demo on its own.

---

## 8. Files added / changed

```
components/experience/  experience-provider · source-badge · experience-banner · experience-mode-switch ·
                        mode-selection · mode-transition · experience-modals · experience-settings-card ·
                        theme-provider · theme-toggle · theme-script · real-mode-care · real-mode-business
lib/data/               types.ts · get-data-source.ts
lib/ring/               overview.ts · adapter.ts · assistant.ts   (+ normalize.ts history shape, types.ts)
app/api/ring/overview/  route.ts · events/route.ts · insights/route.ts
app/api/assistant/      mode-aware (per-mode conversations, Ring answers)
app/globals.css         tokenized surfaces + light theme
app/layout.tsx          theme init script, data-theme default
components/layout/      Providers · Topbar (switch + banner) · MobileNav (compact switch) · Sidebar (theme toggle, source badge) · AppDataProvider (mode-aware)
components/pages/       Home · Events · Insights · Live · Assistant · Automations · SecurityModes · Care · Business · Devices · DemoDevicesView · Settings
components/matan/       RiskBadge (pending) · EventCard/Row/Line (pending + wrap) · EventDetail (Ring view) · DeviceCard (DEMO marker)
lib/types/index.ts      RingEvent.source / analysis / ringEventType
```

---

## 9. Verification

| Check | Result |
|---|---|
| `tsc --noEmit`, `next build` | Clean |
| First-run chooser (fresh browser) | Renders with theme control; **Enter Demo** → Demo home with full banner and switch ✔ |
| Light theme | Sidebar toggle → light palette across Home/Events; contrast holds for text, badges, charts ✔ |
| Demo → Real switch | Opens Connect Ring; after discovery/save the mode flips to Real without changing the route ✔ |
| Real Mode pages (emulator-backed) | Home (Ring hero, honest tiles, "Awaiting AI"), Events (SOURCE/EVENT/DEVICE/MATAN AI block), Insights ("Building your insights"), Care, Business, Settings (Experience Mode + connection) ✔ |
| Mobile (400 px) | Compact `[D][R]` switch fits; no horizontal overflow; full banner stacks vertically ✔ |
| Honesty rules (spec §34) | No mock data on the Ring path; no fabricated Ring fields; no "Nova analyzed" claims; expired ≠ offline; token never in browser storage/URL/env ✔ |

## 10. Acceptance criteria (spec §36)

- **Mode selection** — choose after "login" ✔ · saved preference ✔ · global switch ✔ · route preserved ✔
- **Demo** — all mock ✔ · labelled ✔ · consistent dataset ✔ · no token ✔
- **Real** — existing Ring integration ✔ · Add Ring Device = real flow ✔ · Ring data only ✔ · no fake device ✔
- **Expiry** — countdown ✔ · expiring state ✔ · account unaffected ✔ · reconnect asks for a new token ✔ · no silent fallback ✔
- **Theme** — dark ✔ · light ✔ · system ✔ · independent of mode ✔
- **Accessibility** — keyboard ✔ · SR labels ✔ · focus states ✔ · `aria-live` on mode/session changes ✔

## 11. Next milestones (not in this scope)

Matan AI (Bedrock/Nova) analysis of Ring events → replaces "Awaiting AI" with real priority/confidence; verified family mapping for Real-mode Care; webhook ingestion; Ring device controls once endpoints are verified.

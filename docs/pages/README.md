# MATAN AI — Real Mode page audit

One document per page, each with: what the page does in **Real Mode** (signed-in user, Ring Developer Playground, AWS), a Mermaid diagram of how it works, a table of every section/function with its data source and state (✅ real · 🔒 future integration), the changes made during the audit, and what was verified against the live Playground. Screenshots live in [`ss/`](ss/).

The rule applied on every page: **nothing is simulated in Real Mode.** A function is either backed by Ring, AWS or Matan's own per-user data, or it is labelled *Future integration* with the reason (usually a Ring Partner API / Playground limitation or something not built in this hackathon scope).

| Page | Doc | Real in Real Mode | Future integrations shown |
| --- | --- | --- | --- |
| Sign in / Sign up / Mode chooser | [auth.md](auth.md) | Cognito sign-up + verification, sign-in, Google, password reset, route guard, chooser | MFA, profile editing, other identity providers |
| Home | [home.md](home.md) | live stream, latest analyzed events, today's numbers, Matan assistant, real daily report email, notification inbox | weather, voice input |
| Live View | [live-view.md](live-view.md) | WebRTC/WHEP stream, Ring snapshot, frame screenshot, today's timeline, Matan AI toggle, read-only Ring config | siren / lights / lock / record, clip download-share from the player |
| Events | [events.md](events.md) | Ring history + Nova analysis + decision + notification outcome, filters, download stored media, share | editing / deleting Ring history |
| AI Insights | [ai-insights.md](ai-insights.md) | trends and charts from real events, custom range, Nova period summary, data-driven recommendations | — |
| AI Assistant | [ai-assistant.md](ai-assistant.md) | Nova answers grounded in the user's events/devices/rules, per-user chat history | attachments, voice, feedback storage, device control |
| Automations | [automations.md](automations.md) | Smart Rules with real match counts and activity log, create/edit/toggle | lights / siren / locks, auto-reply, Alexa / IFTTT |
| Security Modes | [security-modes.md](security-modes.md) | per-user persisted mode used by the Decision Engine, real effects per mode, activity log | schedules, per-mode toggles, Care/Business/Custom policies |
| Devices | [devices.md](devices.md) | Ring discovery, status (last-known when the token expired), capabilities, configuration, account, detail drawer with snapshot and Matan toggles | device controls, chime, household mapping, lifecycle webhooks, subscription |
| Care & Family | [care-family.md](care-family.md) | Care Context (quiet hours, sensitivity, notification prefs), care status from real decisions, person detections | family members / presence, call home, speaker messages, check-in routines |
| Business | [business.md](business.md) | 7-day business metrics, busiest hours, Nova summary, daily report email | multiple locations, team roles, POS / analytics, scheduled PDF reports |
| Settings | [settings.md](settings.md) | alerts (address, level, test), Care & Rules, auto-analysis, theme, export, account / Ring / Google status | inert preferences, push/SMS, retention, recognition, language/region, import, 2FA, plan |

## Cross-cutting fixes made during the audit
- **No demo data in Real Mode**: Live View stopped loading/selecting the sample cameras (it fell back to `cam-front`, so the timeline filtered on a demo id), the assistant stamps messages with the real clock, and `/api/ring/overview` returns a neutral profile instead of the demo persona. Verified by scanning all 13 Real Mode pages for demo fixture strings (devices, family names, `EVT-`, demo automations, `ajito@example.com`, `Pro Plan`) - all clean.
- **Links always stay inside the active experience** (`lib/experience/mode-routes.ts` + `ModeRouteGuard`): a detail URL that belongs to the other mode - after a switch, from an old link, a bookmark or a notification - is replaced with that section's list page. Real Mode owns `ring-…` events/devices and `rule-…` Smart Rules; Demo Mode owns the sample ids.
- **Never a dead end**: an id that no longer exists returns to its list page with a short explanation (events, devices, Smart Rules); `/events/<id>` now opens that exact event (the source-reset effect used to drop the deep link on hydration); `/automations?create=1` opens the rule editor in Real Mode; the 404 page offers the relevant section and goes there by itself.
- **Expired Ring token → status is "last known"**, never a live *Online* (Devices, Home tile, Security Modes counts).
- **Per-user state** where the demo store was being shared across users: assistant conversations (DynamoDB `CHAT#`), active security mode (`SETTINGS.security`).
- **Relative times** in Real Mode use the real clock instead of the demo clock.
- **Nova text generation** (`generateTextWithNova`) powers the Insights/Business summaries and the assistant; every call is grounded in the user's own data and cached where it makes sense.

## Responsive behaviour

Every page is checked at 375 px (phone), 768 px (tablet) and 1024 px, in both modes and signed
out, with no horizontal scrolling anywhere. The rule that keeps it that way: **page columns and
cards are grid/flex items, so they need `min-w-0`** (their default `min-width: auto` prevents
shrinking below content, and a single truncated line of text has a very wide min-content).
Card grids use `[&>*]:min-w-0`. On phones, stat rows become two columns, card headers wrap their
action badge, the Live View player uses a fixed height (an `aspect-video` box with a `min-height`
grows sideways instead of taller), and the assistant conversation scrolls inside the viewport so
the composer stays reachable.

## How the audit was run
Each page was opened in a signed-in Real Mode session with a Playwright-driven Chrome profile, every control was exercised against the real APIs (Ring Playground, Bedrock, SES/SMTP, DynamoDB, S3), the outcome was recorded in the page's *Verified* section, and the screenshots were taken from that session. Playground tokens expire after 30 minutes; several screenshots therefore show the *session expired* banner, which is itself part of what the audit verified.

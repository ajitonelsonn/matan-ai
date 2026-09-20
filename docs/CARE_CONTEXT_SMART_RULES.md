# Care Context & Smart Rules — Implementation Report

## Implementation Summary

Matan AI now interprets real Ring events through a **user-configurable care context** and a **deterministic smart-rule engine** layered on top of the existing pipeline. Nova Pro still only *interprets* (category, confidence, observations); the existing Decision Engine still sets the *risk*; the new rule engine turns risk + care context + rules into one of four actions — **IGNORE · MONITOR · NOTIFY · ESCALATE** — with an explanation the UI and the email show. Notifications are sent only for NOTIFY/ESCALATE through the existing SES/SMTP path with the existing one-email-per-event idempotency. While Care Context is on, the rule decision is authoritative for email; the older *Alert level* threshold (Settings → Notifications) applies only when Care Context is off.

```
Ring event → normalize → snapshot → Nova Pro → Decision Engine (risk) → Care Context → Smart Rules → RuleDecision
                                                                      └──────────── stored on the analysis (intelligence.careDecision)
                                                                                     → UI explanation · timeline · email (NOTIFY/ESCALATE only)
```

Nothing Ring-related was added or faked: care context, quiet hours, sensitivity and rules are Matan application configuration and are labelled as such in the UI.

## Data Model

Single table `MatanAI`, existing user partition.

| Item | Key | Shape |
| --- | --- | --- |
| Care context | `PK=USER#{sub}`, `SK=CARE_CONTEXT` | `{ type: "CARE_CONTEXT", context: CareContext }` |
| Rule | `PK=USER#{sub}`, `SK=RULE#{ruleId}` | `{ type: "RULE", ruleId, rule: MatanRule }` |

```ts
type CareContext = {
  enabled: boolean;
  timezone: string;                         // IANA, default "Asia/Dili"
  quietHours: { enabled: boolean; start: "HH:mm"; end: "HH:mm" }; // overnight allowed, default 22:00 → 06:00
  notificationPreferences: { email: boolean; lowConfidence: boolean; repeatedEvents: boolean };
  sensitivity: { motion: "low"|"medium"|"high"; person: …; package: …; vehicle: … };
  updatedAt: string;
};

type MatanRule = {
  id: string; name: string; enabled: boolean; priority: number;       // lower runs first among user rules
  conditions: { eventTypes?: ("motion"|"person"|"package"|"vehicle"|"doorbell"|"animal"|"unusual")[]; deviceIds?: string[];
                timeWindow?: { start; end }; minimumConfidence?: number /*0..1*/; riskLevels?: ("normal"|"low"|"medium"|"high")[];
                repeatedWithinMinutes?: number; minimumOccurrences?: number };
  action: { type: "IGNORE"|"MONITOR"|"NOTIFY"|"ESCALATE" };
  builtin?: "high-risk"|"low-confidence"|"quiet-hours"|"repeated"|"package"; // seeded rules: fixed slot in the order, not deletable
  createdAt: string; updatedAt: string;
};

type RuleDecision = { action; matchedRuleIds: string[]; reason: string; confidence?: number; evaluatedAt: string;
                      facts: { quietHoursActive: boolean; risk; eventType; repeatedCount?: number; careEnabled: boolean } };
```

Built-in rules exist virtually (defaults) until edited; an edit persists the full rule as an override under the same id. Custom rules are stored on create. `MatanEventIntelligence.careDecision` holds the `RuleDecision` — or `{ failed: true, error, evaluatedAt }` when evaluation itself failed — so the outcome persists with the analysis (`ANALYSIS#` item) and survives restarts.

Defaults seeded per user (all editable, toggleable):

| id | Rule | Condition → action | Slot in order |
| --- | --- | --- | --- |
| `rule-low-confidence` | Low Confidence | confidence < 55 % → MONITOR | 1 (safety) |
| `rule-high-risk` | High Risk Escalation | risk = high → ESCALATE | 2 |
| `rule-package` | Normal Package Event | event package, risk low/normal → NOTIFY | 3 (with user rules, priority 100) |
| `rule-repeated` | Repeated Activity | 3 motion/person/unusual events within 10 min → ESCALATE | 4 |
| `rule-quiet-hours` | Quiet Hours | quiet hours active, not escalated → MONITOR | 5 |

## APIs

All routes use the existing `userRoute()` wrapper: Cognito access token verified → `sub` → every read/write scoped to `USER#{sub}`; no user id is accepted from the request; bodies are validated and malformed input returns `400 { error: { code: CARE_INVALID | RULE_INVALID, message } }`.

| Route | Purpose |
| --- | --- |
| `GET /api/matan/care` | current care context (defaults when nothing stored) |
| `PUT /api/matan/care` | partial update; validates timezone (IANA via `Intl`), `HH:mm`, booleans, sensitivity enum |
| `GET /api/matan/rules` | effective rules: built-ins (with persisted overrides) + custom, custom sorted by priority |
| `POST /api/matan/rules` | create custom rule (id optional; reserved built-in ids rejected; 201) |
| `PATCH /api/matan/rules/:id` | edit / enable / disable; built-in identity preserved; 404 for another user's or unknown id |
| `DELETE /api/matan/rules/:id` | delete a custom rule; built-ins → `400 RULE_BUILTIN` ("disable instead"); unknown → 404 |

Client: `lib/api/care.ts`. Hydration of the caches happens with the other per-user data in `hydrateUserScope` (one `GetItem` + one `Query RULE#`).

## Rule Engine

`lib/matan/rules/evaluate.ts` — `evaluateMatanRules({ event, analysis, decision, careContext, rules, recentEvents, now })` is a **pure function**: no Ring, Bedrock, SES, DynamoDB or S3 calls; identical input → identical `RuleDecision` (tested).

Precedence, in order; an `ESCALATE` decided at any step is final and never suppressed later:

1. **Safety** — confidence below the Low Confidence rule's threshold (55 %, shared with the Decision Engine) → `MONITOR`, unless the user opted in (`notificationPreferences.lowConfidence`). Never applied to high risk (the engine already withholds high on low confidence).
2. **High-risk escalation** — risk `high` → `ESCALATE` ("…even during quiet hours").
3. **Explicit user rules** — custom rules and the package rule, lowest `priority` first, first match wins (conditions: event type, device, time window in the care timezone, minimum confidence, risk levels).
4. **Repeated-event rules** — any enabled rule with `repeatedWithinMinutes` + `minimumOccurrences` (built-in: 3 within 10 min). Counts **persisted real events** of the matching types in the window ending at the event, including the event itself; unanalyzed Ring `on_demand` live-view entries are not counted as detections. Disabled by `notificationPreferences.repeatedEvents = false`.
5. **Quiet hours** — active (in the user's timezone, overnight windows handled by minute arithmetic, not string comparison) and not escalated → `MONITOR`.
6. **Sensitivity / preferences** — per type: `high` raises to `NOTIFY`, `low` lowers `NOTIFY` to `MONITOR`; never touches `ESCALATE`, never overrides an explicit user rule.
7. **Default** — from the existing Decision Engine: `email`→ESCALATE, `notify`→NOTIFY, `review`→MONITOR, `none`→IGNORE (normal) / MONITOR (low).

Care context **off** → the default from step 7 with no rules matched (explained as such).

Event type comes from Nova's validated category when present (`delivery`→package, `unusual_activity`→unusual), else the normalized Ring type.

Nova receives, in addition to the device facts from the previous milestone, `careContext: { enabled, quietHoursActive, sensitivity }` — no personal data, never credentials. Nova cannot change the action: it only supplies category/confidence, which the deterministic steps above consume (tests: "Likely normal package delivery" still yields the user's package rule; low confidence still yields MONITOR).

## UI

- **Settings → Care & Rules** (`components/care/CareRulesPanel.tsx`): *Care Context* (enabled, timezone, quiet hours toggle + start/end), *Sensitivity* (motion/person/package/vehicle), *Notifications* (email, low confidence, repeated events), *Smart Rules* cards — action badge, human condition summary, Built-in badge, enable/disable toggle, **Create rule**, **Edit** (modal: name, action, order, event types, risk levels, time window, confidence, repetition), **Delete** with confirmation (custom rules only). Precedence note under the list.
- **Event → Matan AI panel**: new **Matan decision** block (`components/matan/CareDecisionBlock.tsx`) — action badge (🚨 ESCALATE / NOTIFY / MONITOR / IGNORE), confidence, quiet-hours / repeat facts, **Reason**, **Matched rules**; a distinct red block when rule evaluation failed. The Decision Engine section is now labelled *Risk assessment*.
- **Processing timeline**: `Ring event received → Snapshot captured → Nova Pro analysis → Care context → Rules evaluated → Matan decision → Notification`; older analyses without a care decision show the two new steps as *skipped*; a rule failure shows *failed* on "Rules evaluated" (notification step then stays pending — nothing pretends to have sent).
- Existing states `pending / capturing / analyzing / done / failed` unchanged; Live Event Experience unchanged.
- **Email**: subject "Matan AI Alert" for ESCALATE (otherwise "Update"); body gains "Matan decision: ACTION — reason".

## Security

Authentication and authorization reuse `userRoute()` (Cognito JWT → `sub`); all DynamoDB keys are derived server-side; cross-user PATCH/DELETE returns 404 (verified). Ring token untouched (memory session). No new environment variables, no `NEXT_PUBLIC_*` additions, no secrets in Nova context or emails. Validation rejects malformed timezones, `HH:mm`, enums, confidence outside 0..1, non-positive windows/occurrences, bad ids and reserved ids.

## Tests

- `tests/care-rules.test.ts` (11): quiet hours 21:59 ✗ / 22:00 ✓ / 23:59 ✓ / 00:00 ✓ / 05:59 ✓ / 06:00 ✗ in Asia/Dili incl. a UTC instant; high risk → ESCALATE during quiet hours; 0.54 → MONITOR, 0.55 → normal, opt-in; repeated 3/10 min → ESCALATE, 2 → no, live views excluded, preference off; quiet-hours suppression; package rule + user rule precedence + IGNORE rule; sensitivity up/down/never-escalate; care off → default; determinism; type mapping; validation matrix.
- `tests/notifications.test.ts` (+1): NOTIFY/ESCALATE send, MONITOR/IGNORE don't, failed evaluation never sends, alert level never overrides an active care decision (applies only when care is off), ESCALATE subject/body, one email per event.
- `tests/event-state.test.ts` updated for the 7-step timeline (skipped / failed rule steps).
- Integration (real DynamoDB, throwaway `USER#itest-…` partitions, cleaned up): defaults → save → invalid rejected → custom rule → built-in edited → built-in delete refused → **restart** (re-hydrate) keeps everything → **user B** sees defaults, cannot see/update/delete A's rule → cleanup. 15/15.
- `pnpm test` **54/54** · `tsc --noEmit` ✓ · `pnpm build` ✓.

## Real Ring Playground Verification

**Status: NOT YET PERFORMED for this milestone.** The pipeline path is the same one verified live on 2026-09-21 for the Live Event Experience (real Playground events → snapshot → Nova → decision → persistence → notification); the rule stage is inserted between decision and persistence and is covered by unit + integration tests. The acceptance run below is required before this milestone is declared complete and will be recorded here with real values (no fabrication):

| Field | Motion ×3 | Package | Vehicle |
| --- | --- | --- | --- |
| Test date | — | — | — |
| Ring event id(s) | — | — | — |
| Event type | — | — | — |
| Device id | — | — | — |
| Analysis (category / confidence / risk) | — | — | — |
| Matched rule(s) | expected `rule-repeated` | expected `rule-package` (or `rule-quiet-hours` at night) | expected sensitivity low → MONITOR |
| Final decision | — | — | — |
| Notification result | — | — | — |

Procedure: Settings → Notifications → Alert level **High** (the *All* testing level bypasses rules) → Real Mode → trigger Package, Vehicle, then Motion three times ~1 min apart → open each event → paste server log lines `matan_rules_evaluated`, `matan_ai_analysis`, `email_notification_*`.

## Limitations

- Repeated-event detection uses the persisted history available to the sync (Ring's history window + DynamoDB); it cannot see events Matan never received.
- Rule conditions are intentionally small (type, device, time window, confidence, risk, repetition); no boolean expression language.
- Care context and rules are per user, not per device group; `deviceIds` selects specific connected devices only.
- The explanation shows built-in rule names; custom rule names appear inside the reason text ("Rule "…" matched") rather than in the matched-rules list.
- Rule evaluation runs only when an analysis runs (existing `shouldAnalyze()` and cost guards unchanged); events that are never analyzed get no rule decision.

## Non-Goals (intentionally not implemented)

Ring family/household API, Ring device/siren/lock/camera control, Ring webhooks (real or fake), fake event generators, invented Ring APIs/subscription data/household members, LLM-triggered arbitrary actions, autonomous physical actions.

# MATAN AI — Amazon Bedrock + Nova Pro Event Analysis & Matan Decision: Implementation Report

**Spec:** `MATAN_AI_BEDROCK_NOVA_MATAN_DECISION_SPEC.md`
**Status:** Implemented and verified against the live Bedrock endpoint (September 2026).

---

## 1. The vertical slice

```
Ring Simulator event  (Real Mode history: motion | ding | on_demand + cv_detections)
        ↓
Matan event normalization            lib/ring/adapter.ts (existing)
        ↓
buildMatanContext()                  lib/matan/analysis.ts   – event + environment + ≤15 related recent events
        ↓
analyzeWithNova()                    lib/bedrock/nova.ts     – Bedrock Converse · amazon.nova-pro-v1:0
        ↓
validateAnalysis()                   lib/matan/schema.ts     – strict JSON schema, confidence 0..1, reject malformed
        ↓
decide()                             lib/matan/decision.ts   – deterministic rules → priority + action + reasons
        ↓
MatanIntelligenceStore.save()        lib/matan/store.ts      – in-memory (DynamoDB later, same interface)
        ↓
Event UI                             Awaiting AI → Analyzing… → Analyzed | AI analysis unavailable + Retry
```

Verified live: three spec scenarios produced the expected decisions from the real Nova Pro model (see §8).

---

## 2. Security & configuration

| Rule | Implementation |
|---|---|
| Credentials server-only | `lib/bedrock/client.ts` is `import "server-only"`; the `BedrockRuntimeClient` uses the default AWS provider chain (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` from the server `.env`). No `NEXT_PUBLIC_*` credential exists. |
| Region / model | `AWS_REGION ?? "us-east-1"`, `BEDROCK_MODEL_ID ?? "amazon.nova-pro-v1:0"` — read on the server only. |
| Browser never calls Bedrock | The browser calls `POST /api/matan/analyze`; the route invokes Bedrock server-side. |
| No Ring token to Bedrock | The context contains only event/environment fields; Ring tokens live in the Ring session store and are never read by the Matan pipeline. |
| `.env` safety | `.gitignore` now ignores `.env` and `.env.*` (previously only `.env*.local` was ignored). A committed `.env.example` documents the keys with empty values. Verified `.env` is untracked and absent from history. |
| Logging | Structured only: `{ event: "matan_ai_analysis", eventId, model, success, category, priority, latencyMs, tokens }` and `{ event: "matan_ai_bedrock_error", code, awsError }`. No credentials, tokens, prompts or raw payloads. Dev log swept: 0 matches for key/secret/Authorization patterns. |
| Errors | `lib/matan/errors.ts` maps AWS SDK errors to `MATAN_AI_CONFIGURATION_ERROR · ACCESS_DENIED · THROTTLED · TIMEOUT · INVALID_RESPONSE · UNAVAILABLE` (+ `EVENT_NOT_FOUND`, `BAD_REQUEST`). No stack traces reach the UI. |
| IAM | Needs only `bedrock:InvokeModel` (plus model access enabled for Nova Pro in the account/region). |

---

## 3. Files

```
lib/bedrock/client.ts     server-only BedrockRuntimeClient, region/model constants, isBedrockConfigured()
lib/bedrock/nova.ts       analyzeWithNova(): ConverseCommand (system prompt + JSON context [+ image or video]),
                          25 s timeout, text extraction, JSON extraction, schema validation, error mapping,
                          usage recording; injectable invoker for tests
lib/matan/prompts.ts      MATAN_SYSTEM_PROMPT (observation / inference / uncertainty, no identity claims,
                          no priority decisions, metadata is untrusted data) + category guidance + user prompt
lib/matan/schema.ts       MatanEventCategory / MatanPriority / MatanAction / MatanAIAnalysis / MatanDecision /
                          MatanEventIntelligence, validateAnalysis(), extractJson()
lib/matan/decision.ts     Decision Engine v1 (deterministic), LOW_CONFIDENCE = 0.55
lib/matan/analysis.ts     buildMatanContext(), relatedRecent(), shouldAnalyze(), analyzeEvent(), applyIntelligence()
lib/matan/store.ts        MatanIntelligenceStore interface + in-memory impl + in-flight guard
lib/matan/errors.ts       MatanAiError + AWS error mapping (incl. MATAN_AI_BUDGET_EXCEEDED, media rejection → BAD_REQUEST)
lib/matan/escalation.ts   shouldEscalateToVideo() – pure gate for the snapshot → clip escalation
lib/matan/budget.ts       monthly token budget guard + usage/cost snapshot
lib/ring/client.ts        getRingSnapshot() (303 pre-signed flow) · getRingClip() (200/206/416 semantics)
app/api/matan/media/[id]/route.ts   serves the analyzed snapshot (.jpg) / clip (.mp4) same-origin
lib/api/matan.ts          browser client (matanApi.analyze / get) + matanErrorFrom()
app/api/matan/analyze/route.ts   POST (analyze: snapshot pass → optional video escalation) · GET (stored intelligence)
components/matan/MatanAnalysisPanel.tsx  pending / analyzing / complete / failed UI
components/matan/EventDetail.tsx         Ring view uses the panel
lib/ring/overview.ts      overlays stored intelligence onto Ring events (analysis: pending → done)
lib/types/index.ts        RingEvent.intelligence
tests/matan-decision.test.ts   14 unit tests (decision rules, schema, escalation gate) — `pnpm test`
```

---

## 4. Endpoint — `POST /api/matan/analyze`

Request (either form):

```json
{ "eventId": "ring-…", "force": true }
```
```json
{
  "event": { "id": "evt_123", "type": "motion", "timestamp": "2026-09-17T02:17:00Z",
             "deviceName": "Front Door", "deviceType": "doorbell", "source": "ring",
             "detections": ["person", "package"] },
  "context": { "securityMode": "night", "recentEvents": [ { "type": "motion", "timestamp": "…", "deviceName": "Side Door" } ] },
  "force": true
}
```

- `eventId` resolves the event from the Real Mode Ring history and uses the real recent history + the current Matan security mode and quiet-hours setting.
- `force: false` applies `shouldAnalyze()` cost gating (package / vehicle / person / doorbell / motion / repeated / night-mode events qualify; live-view sessions and status events are skipped). Manual UI requests use `force: true`.
- Duplicate-click guard: a second request for an event already being analyzed returns `409 MATAN_AI_THROTTLED`.
- Media: the server obtains a **Ring snapshot** for the event window first and, when the escalation gate says so, the **Ring clip** (see Addendum). Option `media: "auto" | "snapshot" | "video"`. When Ring has no media the UI labels the result **context-only analysis** with the reason.

Response:

```json
{
  "success": true,
  "eventId": "…",
  "intelligence": {
    "analysis":  { "summary": "…", "category": "delivery", "confidence": 0.9, "observations": ["…"], "uncertainty": "…" },
    "decision":  { "priority": "low", "action": "none", "reasons": ["…"], "explanation": "Likely delivery at Front Door. No immediate action is required." },
    "analyzedAt": "…", "model": "amazon.nova-pro-v1:0",
    "mediaAnalyzed": true, "mediaSource": "ring-snapshot", "mediaNote": "Ring snapshot from the event window",
    "usage": { "inputTokens": 3081, "outputTokens": 120 }
  },
  "event": { "…the Ring event with analysis: done, priority, confidence, summary, imageUrl/videoUrl applied…" },
  "model": "amazon.nova-pro-v1:0",
  "escalation": { "attempted": false, "reason": "snapshot analysis sufficient", "applied": false },
  "budget": { "usedTokens": 3201, "budgetTokens": 5000000, "usedPct": 0.1, "estimatedUsd": 0.0028, "videoAllowed": true }
}
```

Errors: `{ "success": false, "error": { "code", "title", "message" } }` with matching HTTP status.

---

## 5. Nova ↔ Decision separation

Nova answers *what appears to be happening* (`summary`, `category`, `confidence`, `observations`, `uncertainty`). Any `priority` / `action` fields it emits are **dropped during validation** (unit-tested). The Decision Engine alone decides:

| Condition | Priority | Action |
|---|---|---|
| `delivery` | low | none |
| `person` / `motion` / `unusual_activity`, Home/Care/Business/Custom mode, no repeats | normal | none |
| person-like, **Night Mode or quiet hours**, single event | medium | review |
| person-like, **Night/quiet + ≥ 2 related recent events** (same/multiple entrances) | **high** | **review** |
| person-like, Away Mode | medium | notify |
| `doorbell` (night → medium/notify, else normal/none) · `vehicle` (night+repeat → medium/review) · `animal` (normal/none) · `unknown` (normal/review) | | |
| **confidence < 0.55** | never escalates; medium/high are lowered to normal (low for deliveries) with `review` and an explicit "confidence is low" reason |
| high + application email rule | — | email (SES itself is a later milestone) |

Every `reasons[]` entry is derived from actual inputs (confidence %, mode, related-event count, device spread). Explanations use neutral wording ("repeated activity", "intent cannot be determined") — never "intruder"/"thief".

Mapping to the existing 3-level UI priority: `high → important`, `medium → attention`, `normal/low → normal` (`low` shows the "Low risk" label).

---

## 6. UI

`MatanAnalysisPanel` (inside the Ring event detail):

- **pending** — "Awaiting AI" badge, explanation, **[ Analyze with Matan AI ]** (disabled while running; server-side guard too).
- **analyzing** — "Analyzing with Matan AI…" with the Matan logo loader and "Amazon Bedrock · Nova Pro → Matan Decision Engine".
- **complete** — "Analyzed" badge; headline (e.g. *Likely delivery*), summary, **Confidence 94% · PRIORITY LOW · No action required**, *Matan decision* block (explanation + reasons), Observations, Uncertainty, model + timestamp, **context-only analysis** marker, **Review Event** for high priority, Re-analyze.
- **failed** — "AI analysis unavailable" (or specific title), message, error code, **[ Retry ]**. The Ring event is left unchanged.

The Events list row updates in place (AWAITING AI → NORMAL / LOW RISK / ATTENTION / IMPORTANT) because the analyzed event is merged back through the existing `onChange` path and persisted in the store overlay.

**Demo Mode is untouched** — the panel only renders for `source: "ring"` events; demo events keep their deterministic mock analysis.

---

## 7. Tests — `pnpm test`

1. delivery → low / none (spec example) ✔
2. ordinary person, Home → normal / none ✔
3. repeated night activity across devices → high / review, evidence-based, no "intruder" wording ✔
4. high + email rule → email ✔
5. **Test 4** low confidence never escalates ✔
6. model `priority`/`action` ignored ✔
7. **Test 5** schema: percentages tolerated (`85` → 0.85), `1.7`/unknown category/missing summary/non-object rejected → `MatanSchemaError` → `MATAN_AI_INVALID_RESPONSE` ✔
8. `extractJson` handles code fences/prose, rejects garbage ✔

---

## 8. Live verification against Amazon Bedrock (us-east-1, `amazon.nova-pro-v1:0`)

| Input | Nova | Decision |
|---|---|---|
| Person + package + doorbell press, Home Mode | `delivery` · 0.90 · "A person with a package was detected at the front door, followed by a doorbell press." | **low / none** — "Likely delivery at Front Door. No immediate action is required." |
| Person at Back Entrance, **Night Mode**, 3 related events on 2 devices | `person` · 0.90 · "Person detected near the back entrance during quiet hours." | **high / review** — "Repeated activity during night monitoring across multiple monitored locations. Intent cannot be determined from the available evidence. Review recommended." |
| Person at Front Door, Home, 1 related event | `person` · 0.90 | **normal / none** |
| Plain motion, Home, no detections | `motion` · 0.90 · uncertainty: "cause cannot be determined without media" | **normal / none** |
| Browser flow (Events → Ring event → Analyze) | row badge AWAITING AI → NORMAL; detail shows Analyzed panel with context-only marker | ✔ |

Also verified: stored intelligence retrievable via `GET /api/matan/analyze?eventId=`; overlay persists across page loads; typical latency 3–8 s; no secrets in logs.

---

## 9. Acceptance criteria

- [x] `@aws-sdk/client-bedrock-runtime` installed · server-only client · `AWS_REGION` / `BEDROCK_MODEL_ID` read server-side
- [x] `/api/matan/analyze` invokes Nova Pro through Bedrock **Converse**
- [x] Structured output validated; malformed output → `MATAN_AI_INVALID_RESPONSE`
- [x] Decision Engine runs after Nova; model priority/action never authoritative
- [x] Event Detail manual **Analyze with Matan AI**; `Awaiting AI → Analyzing → Analyzed`; Retry/error states
- [x] Delivery · normal person/motion · night/repeated · low-confidence scenarios behave as specified
- [x] No AWS credentials in browser code · no Ring token to Bedrock · no secrets logged · `.env` ignored by git
- [x] No database (in-memory store behind `MatanIntelligenceStore`) · Demo Mode unchanged
- [x] `tsc --noEmit` and `next build` pass · 8/8 unit tests pass

## 10. Next

DynamoDB behind `MatanIntelligenceStore` → SES for `action: "email"` → automation execution → EventBridge → Assistant/Insights over analyzed history → Ring webhook ingestion → media (image/video) input to Nova when Ring clip access is available.

---

## Addendum — Ring media & video escalation (added after live Playground testing)

### Why Playground events all looked like "Live view session"
The Playground's Package / Vehicle / Motion buttons start a **live-view simulation**; Ring records it as an `on_demand` history event with no `cv_detections`. The simulated content exists only in the media. Two consequences were implemented:
- `on_demand` sessions without detections decide **normal / none** ("a live view session started by a user, not a detection").
- Matan now obtains **Ring media server-side** for the event window and gives it to Nova.

### Media pipeline
| Step | Endpoint / component |
|---|---|
| Snapshot (pass 1) | `POST /v1/devices/{id}/media/image/download` `{ type: "latest_in_range", start_timestamp, end_timestamp, image_options: { format: "jpeg" } }` → **303 → pre-signed URL**, followed without credentials (`lib/ring/client.ts › getRingSnapshot`) |
| Clip (pass 2, escalation) | `POST /v1/devices/{id}/media/video/download` `{ timestamp, duration ≤ 60000, video_options: { codec: "AVC", resolution: 640×360 } }` → 200/206 MP4 (416 = nothing recorded) (`getRingClip`) |
| Nova input | image block or `video: { format: "mp4", source: { bytes } }` via Converse (`lib/bedrock/nova.ts`) |
| Storage / playback | bytes kept in server memory (bounded); served same-origin at `/api/matan/media/<event>.jpg` / `.mp4`; shown as event thumbnail, snapshot, or `<video>` in the detail |
| Provenance in UI | "Ring snapshot analyzed" · "Ring clip analyzed · escalated from snapshot" · "context-only analysis" (+ reason on hover) |

### Escalation policy — `lib/matan/escalation.ts › shouldEscalateToVideo()`
Snapshot first; the clip (≈2–4× tokens) is used only when: no snapshot exists · snapshot category `unknown` · confidence < 0.55 · person-like activity in Night Mode / quiet hours · ≥ 2 related recent events · or the user clicks **Analyze full clip**. Blocked when the clip is < 2 s or the budget guard says no. Request option `media: "auto" | "snapshot" | "video"`.

### Cost controls — `lib/matan/budget.ts`
- Every Bedrock response's `usage` is recorded; the analyze response returns `usage`, `escalation` and `budget` (used %, estimated USD) and the panel shows them.
- `MATAN_AI_MONTHLY_TOKEN_BUDGET` (default 5,000,000 tokens ≈ $4): video disabled at 80 %, analyses refused with `MATAN_AI_BUDGET_EXCEEDED` at 100 %.
- Hard caps: clip ≤ 60 s, ≤ 20 MB; snapshot ≤ 6 MB.
- Measured: snapshot pass ≈ 2,800 input tokens (~$0.003); 10 s clip pass ≈ 3,950 input tokens (~$0.0035); AWS video accounting ≈ 288 tokens/s.

### What the Playground can and cannot provide (verified 17 Sep 2026 on the real API)
| Media | Playground synthetic doorbell | Why |
|---|---|---|
| Snapshot (`/media/image/download`, `latest_in_range`) | **Yes** – ~90 KB JPEGs returned via 303; Nova analyzed them (`mediaAnalyzed: true`, ~3,080 input tokens) | Ring can always serve the latest frame for a window |
| Clip (`/media/video/download`) | **No** – HTTP 400/416 | `on_demand` entries "mark a media request, not an event recording — they don't extend clip coverage". The Playground's Package / Vehicle / Motion buttons only start live-view sessions; no recording is created. |

Consequences:
- Video analysis activates automatically once real `motion` / `ding` recordings exist (physical Ring device on a subscription, or production webhooks `motion_detected` + `sub_type`). On the Playground the panel reports *"Video escalation attempted (no clip): … live-view sessions are not recordings"* and keeps the snapshot result.
- A clip request that Ring refuses (400/416) is treated as "no media" – the analysis still completes on the snapshot/context; Ring's `code/title/detail` are logged (`ring_clip_error`).
- The clip request body is the minimal documented `{ timestamp, duration }` (adding `video_options` produced HTTP 400 on the Playground).
- Every snapshot request Matan makes creates a new `on_demand` history entry on the device – expect the Events count to grow as you analyze.

### Live verification
- Real Playground: `ring_snapshot` succeeded (89 974 / 88 795 bytes) and Nova produced image-based analyses for `on_demand` sessions; auto mode declined video ("snapshot analysis sufficient"); forced video → Ring 400 → handled as no clip.
- Emulator + real Nova: snapshot of a warehouse photo → "warehouse with shelves and boxes" (`motion`, normal); 10 s test clip → "Video: a serene garden scene with a large tree… unrelated to a home entrance" (`unknown`, normal). Auto mode correctly declined video when the snapshot was sufficient.
- Media-rejection errors from Bedrock now map to `MATAN_AI_BAD_REQUEST` with a clear message.
- Tests: 14/14 (`pnpm test`) incl. escalation gate rules; `tsc` and `next build` clean.

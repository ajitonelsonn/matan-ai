# Developer feedback — friction log and feature requests

Everything below happened while building [MATAN AI](https://github.com/ajitonelsonn/matan-ai) against the **Ring Developer Playground / Partner API** and **AWS** during the Build, Ship, Shape: Amazon Developer Hackathon (September–October 2026).

It is written for the teams behind these products. Each friction entry gives the task, the steps, expected vs actual, a severity, the workaround we shipped, and a suggestion. Nothing here is hypothetical — every item cost us real time, and the workarounds are all in the repository.

---

## Friction log

Each entry: the task, the steps, expected vs actual, severity, the workaround we shipped, and a suggestion. All of these happened while building this submission; the production ones are documented in full in [`AWS_DEPLOYMENT.md`](AWS_DEPLOYMENT.md).

### F1 — Snapshot download 404s until a live view has been started · **Ring Partner API** · Severity: **High**

- **Task:** fetch the still frame for a Ring event so Nova can read it.
- **Steps:** valid Playground token → `GET /v1/devices` (200, device online) → `POST /v1/devices/{id}/media/image/download`.
- **Expected:** a 303 to a pre-signed image URL, since the device reports online and has history.
- **Actual:** 404 every time. No hint in the error document that a precondition was unmet; we assumed a bad device id, a token scope problem, then an outage, in that order.
- **Workaround:** start a WHEP live-view session on the device first — then the same call returns `200 image/jpeg`. We shipped a 15-minute fallback to the most recent stored frame and changed the UI copy to *"Start the Ring live view (or trigger a Playground simulation), then try again."*
- **Suggestion:** document the precondition on the endpoint, and return `409` with `"no recent media; start a session first"` instead of `404`.

### F2 — 30-minute token with no refresh path · **Ring Developer Playground** · Severity: **High**

- **Task:** keep a signed-in user's Ring connection alive across a session.
- **Steps:** paste a Playground token → use the app for half an hour.
- **Expected:** a refresh token, or at least a documented re-auth flow.
- **Actual:** the token simply expires; every Ring call starts failing and there is nothing to exchange for a new one.
- **Workaround:** a full session model — expiry countdown in the UI, a reconnect flow, and `statusStale` plumbed through every surface so an expired session shows *"Last known: Online · 4 hours ago"* in grey rather than a live green *Online*. Honest, but it is a lot of product built around a token lifetime.
- **Suggestion:** a refresh token, or a 24-hour developer token; and state the lifetime at the top of the authentication page.

### F3 — One synthetic device, no way to add another · **Ring Developer Playground** · Severity: **High**

- **Task:** test multi-device behaviour (per-device rules, a device list worth filtering, business multi-camera).
- **Steps:** look for a way to add a second device or pick a model in the Playground console.
- **Expected:** a few device fixtures, or a "create device" action.
- **Actual:** exactly one synthetic device, fixed model.
- **Workaround:** we wrote a local emulator and point `RING_API_BASE_URL` at it in automated tests (test-only override, never a `NEXT_PUBLIC_` variable), so multi-device logic is covered by tests even though it can't be demoed against the Playground.
- **Suggestion:** two or three device fixtures with different capability sets — it would unlock three of the five priority categories.

### F4 — Our own media requests come back as history events · **Ring Partner API** · Severity: **Medium**

- **Task:** analyse every new event in device history exactly once.
- **Steps:** take a snapshot / open live view → poll `GET /v1/history/devices/{id}/events`.
- **Expected:** history contains device-initiated events.
- **Actual:** history also contains `on_demand` entries created by *our own* media calls, so the pipeline analysed its own footprints and emailed the user about them.
- **Workaround:** skip `on_demand` entries shorter than 6 seconds that land immediately after a Matan media request; longer live-view sessions are treated as real events.
- **Suggestion:** mark API-initiated entries with an attribution field (`initiated_by: api`) so integrators can filter them deterministically instead of heuristically.

### F5 — Lifecycle webhooks documented but not simulable · **Ring Developer Playground** · Severity: **Medium**

- **Task:** react to device online/offline and new events without polling.
- **Steps:** read the webhook documentation → look for a Playground subscription or a test-delivery button.
- **Expected:** register a dev URL, fire a test event.
- **Actual:** no way to exercise webhooks from the Playground.
- **Workaround:** polling everywhere (30 s on the event list, 6 s while an analysis is in flight) plus explicit status refresh, and webhooks labelled *future integration* in the UI with the reason.
- **Suggestion:** a "send test webhook" button and a Playground subscription form; the production code path is otherwise untestable before certification.

### F6 — `AccessDenied` from SES names neither the identity nor the configuration set · **Amazon SES + IAM** · Severity: **High**

- **Task:** send the alert email from the Amplify compute role in production.
- **Steps:** policy granted `ses:SendEmail` + `SendRawEmail` on the verified identity ARN; send with a configuration set.
- **Expected:** success, or an error naming what was denied.
- **Actual:** `SES_ACCESS_DENIED` in CloudWatch, mail silently not delivered. Our policy *looked* right.
- **Workaround:** grant the actions on **both** the identity ARN and the configuration-set ARN. (Our IAM policy in [`SETUP.md`](SETUP.md) now shows both, so nobody else loses the hour.)
- **Suggestion:** include the denied resource ARN in the error message.

### F7 — Console environment variables don't reach the SSR runtime · **AWS Amplify Hosting** · Severity: **High**

- **Task:** serve S3-stored event media in production.
- **Steps:** set the bucket name and region in the Amplify console → deploy → open an event.
- **Expected:** the same behaviour as local, where the variables come from `.env`.
- **Actual:** media 404s in production, no error — the server code read `undefined` for the bucket. Everything else worked, so it looked like an S3 permissions problem for a while.
- **Workaround:** `amplify.yml` writes an allow-list of server variables into `.env.production` at build time; the bucket is read lazily; and a `runtime_config` log line now reports which integrations are configured on each instance (names and booleans only).
- **Suggestion:** make console variables reachable from SSR compute by default, or fail the build when a declared runtime variable is absent.

### F8 — Amplify Secrets are invisible to the build · **AWS Amplify Hosting** · Severity: **Medium**

- **Task:** supply the SMTP fallback password without putting it in plain configuration.
- **Steps:** store it as an Amplify **Secret** → reference it in the build → deploy.
- **Expected:** available like any other variable.
- **Actual:** `undefined` at build time, so the value never reached the runtime and notifications fell back to "not configured" (`smtpPassword: false` in our own diagnostics).
- **Workaround:** a plain environment variable, with the value rotated.
- **Suggestion:** document the difference prominently, and surface "this secret is not available to the build" in the console next to the secret.

### F9 — Background work after the response never runs · **Amplify SSR compute (Lambda)** · Severity: **High**

- **Task:** analyse a new event and email the user without making the request wait.
- **Steps:** return the HTTP response, then continue the Nova call and the email in a fire-and-forget promise — which works perfectly on a long-lived Node server.
- **Expected:** the work finishes shortly after the response.
- **Actual:** `TimeoutError` / `MATAN_AI_TIMEOUT` and half-finished analyses: the execution environment is frozen the moment the response is sent.
- **Workaround:** persist the queue in DynamoDB (`AUTO_STATE`), drive it with a browser-initiated `/api/matan/auto/step` that processes exactly one event per request, and `await` the email inside the request that sends it.
- **Suggestion:** a callout in the Next.js-on-Amplify docs, or a build-time warning: *"work started after the response will not complete."*

### F10 — "Invalid request" from Cognito managed login, with no detail · **Amazon Cognito** · Severity: **Medium**

- **Task:** make Google sign-in and sign-out work on the deployed domain (both worked locally).
- **Steps:** deploy → sign in with Google → sign out.
- **Expected:** success, or an error identifying the misconfiguration.
- **Actual:** a bare *"Invalid request"* page. The cause was unregistered callback/sign-out URLs for the production domain — and the sign-out URL has to match **including the trailing slash**.
- **Workaround:** register every exact callback and sign-out URL per environment; the exact strings are listed in [`AWS_DEPLOYMENT.md`](AWS_DEPLOYMENT.md).
- **Suggestion:** say which redirect URI was rejected (it is not sensitive — the client sent it).

### F11 — `GET /v1/accounts/me/subscriptions` answers 422 · **Ring Partner API** · Severity: **Low**

- **Task:** show the Ring plan on the account card.
- **Steps:** call the documented endpoint with a valid Playground token.
- **Expected:** subscription status.
- **Actual:** `422 Unable to process`, consistently.
- **Workaround:** the UI explains subscription status is unavailable, in [`lib/ring/capabilities.ts`](../lib/ring/capabilities.ts) alongside the other documented-but-unavailable capabilities.
- **Suggestion:** support it for Playground accounts or mark it unavailable in the reference.

### F12 — No schema guarantee for model JSON · **Amazon Bedrock / Nova Pro** · Severity: **Medium**

- **Task:** get a reliable structured reading (summary, category, confidence, observations, uncertainty) out of every snapshot.
- **Steps:** prompt for a JSON object through the Converse API.
- **Expected:** schema-valid JSON, or a way to declare the schema.
- **Actual:** usually valid, occasionally wrapped in prose or a code fence, occasionally missing a field.
- **Workaround:** a tolerant extract-and-validate layer ([`lib/matan/schema.ts`](../lib/matan/schema.ts)) that pulls the first JSON object out of the text, validates every field and repairs or rejects the rest, plus a visible "low confidence" path so a bad read never silently becomes a decision.
- **Suggestion:** a `response_format`/strict-schema option on Converse for Nova models.

---

---

## Feature requests

| # | Request | Why it matters | Urgency |
| - | ------- | -------------- | ------- |
| 1 | **Ring: refreshable or longer-lived Playground tokens** (refresh token, or 24 h for dev) | The 30-minute hard expiry with no refresh shapes the architecture of every Playground-based app and makes any demo longer than half an hour a reconnect exercise | **Critical** |
| 2 | **Ring: webhook/event simulator in the Playground** — inject a motion, package, vehicle or doorbell event on demand, and deliver lifecycle webhooks to a dev URL | Event-driven is the natural shape for this domain; without it every integration polls, and nobody can test the webhook path that production will use | **Critical** |
| 3 | **Ring: more than one Playground device, with model/capability variety** | Access control, business systems and multi-camera home automation — three of the five priority categories — cannot be built or demoed against a single synthetic device | **Important** |
| 4 | **Ring: document the snapshot precondition and `on_demand` history semantics** | `media/image/download` 404s until a live view starts, and our own media calls appear in history; both are surprises that cost hours and are one paragraph each to fix | **Important** |
| 5 | **Ring: device write APIs for partners** — siren, lights, recording on demand, or a documented statement that they will not exist | Half of "IoT home automation" is actuation; today every integrator independently discovers that only reads are available | **Important** |
| 6 | **Ring: fix or un-document `GET /v1/accounts/me/subscriptions`** (422 on Playground accounts) | Feature gating depends on plan level; a documented endpoint that always fails sends people looking for their own bug | Nice-to-have |
| 7 | **Bedrock: guaranteed structured output on Converse** (response schema / strict tool output) for Nova | Every production use of a vision model as a *component* needs schema-valid JSON; today each team writes its own validate-and-repair layer | **Important** |
| 8 | **Amplify: runtime vs build environment-variable parity** — make console variables reachable from SSR compute, or fail the build loudly when a declared runtime variable is missing | This caused two of our production incidents, and both failed silently | **Critical** |
| 9 | **Amplify: warn when a Next.js app does work after the response** | Fire-and-forget code that works locally silently never runs on frozen compute — a build-time lint or a docs callout would catch it | **Important** |
| 10 | **SES: name the denied resource in `AccessDenied`** (identity vs configuration set) | One missing ARN in a policy, an error that names neither, and production mail stops | **Important** |
| 11 | **Cognito: name the unregistered redirect URI** instead of a bare "Invalid request" | Exact-match URL rules (down to the trailing slash) with an opaque error is the single most common Cognito onboarding wall | **Important** |

---

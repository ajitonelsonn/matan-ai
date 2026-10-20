# Devpost submission sheet

Every field the **Build, Ship, Shape: Amazon Developer Hackathon** form asks for, answered and ready to paste. Requirements are from the [official rules](https://amazonappdev2026.devpost.com/); the track context and the AWS write-up live in [`HACKATHON.md`](HACKATHON.md).

**Deadline:** Oct 24, 2026 @ 4:00am GMT+9 · **Primary track:** Ring · **Mini challenges:** AWS Builder, Open Source

---

## Checklist

| # | Requirement | State |
| - | ----------- | ----- |
| 1 | Text description — what it does and how it works | ✅ [below](#1-project-description) |
| 2 | Public GitHub repo with all source, assets and run instructions | ✅ <https://github.com/ajitonelsonn/matan-ai> + [`SETUP.md`](SETUP.md) |
| 3 | Open-source licence file (or private repo + 5 Amazon reviewers) | ✅ [MIT](../LICENSE) — repo is public, so no collaborator invites needed |
| 4 | Ring: the repo **calls** Ring APIs in code, not just in the README | ✅ [below](#2-where-the-ring-api-is-actually-called) |
| 5 | Ring: demo shows the project working through a simulator or a real device | ⬜ **record the video** — [shot list](#4-demo-video-under-3-minutes) |
| 6 | Demo video under 3 minutes, public, English, YouTube or Vimeo | ⬜ **you** |
| 7 | Product feedback on every tool / API / SDK used (AWS included) | ✅ [below](#5-product-feedback-required) |
| 8 | Which track(s) and mini challenge(s) | ✅ Ring · AWS Builder · Open Source |
| 9 | AWS Builder extra fields | ✅ [HACKATHON.md](HACKATHON.md#aws-builder-mini-challenge--which-aws-services-and-how) |
| 10 | Open Source extra fields (contribution URL, repo URL, username, description) | ⚠️ [read this first](#3-open-source-mini-challenge) |
| 11 | If the project existed before the hackathon, say what changed | ✅ [below](#7-did-the-project-exist-before-the-hackathon) |
| 12 | _Optional_ feature requests with urgency | ✅ [below](#8-feature-requests-optional) |
| 13 | _Optional_ friction log — **up to 10% judging bonus** | ✅ [below](#9-friction-log-optional-up-to-10-judging-bonus) |

Three things are still on you: **record the video**, **decide the Open Source answer**, and **paste these answers into the form**.

---

## 1. Project description

> _Paste into "what it does and how it works"._

**MATAN AI — Ring events, understood and decided.**

A Ring camera tells you *something moved*. MATAN AI tells you *what happened, what it means, and whether you need to know*. "Matan" is Tetun for *eye* — this is the eye that watches the front door so a family in Dili, a grandparent living alone, or a small shop owner doesn't have to read every motion alert.

**What it does.** You connect your Ring account, and from then on every event the device records is read, scored and decided:

1. **Ring event arrives** — Matan polls device history and keeps each event's real Ring type (`motion`, `package`, `vehicle`, `on_demand`), device, duration and timeline.
2. **Evidence is pulled** — the snapshot for that moment (escalating to the video clip when a still isn't enough), fetched server-side and stored in a private per-user S3 prefix.
3. **Amazon Nova Pro reads the frame** — through Bedrock's Converse API, with a compact JSON context (device, time, recent history). Nova returns a validated structured reading: what it sees, category, confidence, observations, and *what it is unsure about*.
4. **A deterministic Decision Engine scores it** — risk and priority from the model's reading plus the event's own facts; the model never decides alone.
5. **Your Smart Rules apply, in a fixed precedence** — low confidence → high risk → your own rules → repeated activity → quiet hours → per-category sensitivity → default. The ids of the rules that matched are stored on the event.
6. **Only then is an email sent** — via Amazon SES, carrying the analyzed frame, the decision and the reason. `Ignore` and `Monitor` decisions stay silent.

Everything is explainable after the fact: open any event and you see the frame Nova looked at, its summary and confidence, the decision, the rules that matched, the token usage, and the seven-step processing timeline. Live View streams the camera over WebRTC (WHEP) with the Ring token never leaving the server. An assistant answers questions about *your* history, grounded strictly in your own events and rules — it cannot invent an event. AI Insights and the Business view summarise a period; Care & Family holds the household context the rules reason about; Security Modes switch sensitivity wholesale.

**How it's built.** Next.js 16 (App Router, React 19, TypeScript) on AWS Amplify Hosting SSR compute. Amazon Cognito for identity (email + Google), Bedrock/Nova Pro for the reading, DynamoDB single-table for events, analyses, decisions and rules, a private S3 bucket for media, SES for mail, CloudWatch for structured logs. Every API route verifies the Cognito access token server-side and derives the owner key from it, so a request can only read its own partition. The Ring token lives only in an AES-256-GCM sealed HttpOnly cookie — never in the browser, never in a database, never in a log.

**Honest about limits.** Ring exposes no device-control endpoints to partners, no chime audio, no household mapping, no lifecycle webhooks in the Playground and a 422 on subscription status. Matan labels each of those *future integration* in the UI with the reason, instead of faking a working button. There is a Demo Mode for exploring the product with no Ring account, and it is clearly marked — in Real Mode, nothing on screen is sample data.

**Try it.** `https://main.d3q4rxuohabv2i.amplifyapp.com` · docs at `/docs` · deploy your own with [`SETUP.md`](SETUP.md).

---

## 2. Where the Ring API is actually called

The rules say the repo must call the track technology in code. It does — eleven endpoints, all server-side, all in [`lib/ring/client.ts`](../lib/ring/client.ts) with the base URL in [`lib/ring/constants.ts`](../lib/ring/constants.ts):

| Ring endpoint | Used for |
| ------------- | -------- |
| `GET /v1/devices?include=status,capabilities,location,configurations` | device discovery |
| `GET /v1/devices/{id}` | single-device refresh |
| `GET /v1/devices/{id}/status` | live status poll |
| `GET /v1/devices/{id}/capabilities` | capability matrix |
| `GET /v1/devices/{id}/location` | coarse region |
| `GET /v1/devices/{id}/configurations` | read-only configuration |
| `GET /v1/history/devices/{id}/events` | event history |
| `GET /v1/users/me` | Ring account card (email masked) |
| `POST /v1/devices/{id}/media/image/download` | snapshot for analysis |
| `POST /v1/devices/{id}/media/video/download` | clip for full analysis |
| `POST /v1/devices/{id}/media/streaming/whep/sessions` + `DELETE` | WebRTC live view, start and teardown |

Entry points: [`app/api/ring/`](../app/api/ring/) (session, devices, events, media, live view) → [`lib/ring/`](../lib/ring/) (client, normalize, adapter, session) → [`lib/matan/pipeline.ts`](../lib/matan/pipeline.ts).

---

## 3. Open Source mini challenge

**Read this before you fill the form.** The rule is: *"Ship a **new, additional** open-source project (include an open-source license) **or** a contribution (a branch, a fork, or a pull request) to a public repository during the hackathon window, **alongside** your primary-track submission."*

The MATAN AI repo **is** the primary-track submission. Using the same URL for both fields is defensible — it is a new repository, created in the hackathon window, MIT-licensed — but "additional … alongside" reads as *something beyond the main project*. A judge could score it either way, and the fix is small.

**Recommended (safe) answer** — do one of these before submitting, then use it as the contribution URL:

- **A.** Extract the Ring Playground client into its own small MIT repo (e.g. `ring-playground-client`): the eleven typed endpoint calls, the JSON:API normaliser, the error taxonomy and the 30-minute-token handling, with tests and a README. It is genuinely reusable by every other Ring entrant, and it is already written — it only has to be lifted out of `lib/ring/`.
- **B.** Open a PR to a public Ring repo — the obvious target is [`ring-api-helloworld`](https://github.com/) (the canonical starter listed in the hackathon resources): add the snapshot-needs-a-live-session note, the WHEP start/stop pair, or TypeScript types for the JSON:API documents. PRs don't need to be merged.

**Then paste:**

- **Contribution URL:** _<the repo or PR from A or B>_
- **Project repository URL:** <https://github.com/ajitonelsonn/matan-ai>
- **GitHub username:** `ajitonelsonn`
- **Short description (what you did, how it works, why it matters):** the ready-to-paste paragraphs in [HACKATHON.md](HACKATHON.md#open-source-mini-challenge), with the first sentence changed to name the extracted library or the PR.

If you decide to submit MATAN AI itself as the open-source entry, say so explicitly in the description — *"a new MIT-licensed open-source project created during the hackathon window, published so anyone can deploy their own instance"* — and lean on [`SETUP.md`](SETUP.md) as the evidence that it is genuinely reusable by others.

---

## 4. Demo video (under 3 minutes)

Judges aren't required to watch past 3:00, and the Ring rule is explicit: **the video must show the project working through a simulator or a real device.** Lead with the Ring data.

| Time | Shot | Say |
| ---- | ---- | --- |
| 0:00–0:15 | Ring Playground token pasted → device appears with real capabilities | "A Ring camera tells you something moved. Matan tells you what it means." |
| 0:15–0:35 | **Live View streaming** from the Ring device (WHEP), snapshot taken | "Live view over WebRTC — the Ring token never leaves the server." |
| 0:35–1:15 | Trigger a Playground simulation → event lands in Events → status lines move to *AI analysis complete* → *Notification sent* | "Every event is read by Amazon Nova Pro on Bedrock." |
| 1:15–1:55 | Open the event: the analyzed frame, Nova's summary + confidence + uncertainty, the **decision**, the **rules that matched**, the 7-step timeline | "The decision is explainable: what the model saw, which rule matched, why you were told." |
| 1:55–2:20 | The alert email with the frame and the reason | "Only `Notify` and `Escalate` reach you. Quiet hours and repeats stay silent." |
| 2:20–2:40 | Automations: pause Quiet Hours, see real 7-day match counts; Assistant answers a question about the real history | "Your rules, your data — the assistant can't invent an event." |
| 2:40–3:00 | Architecture diagram + `/docs` + "deploy your own", MIT | "Open source, documented, deployable by anyone." |

Rules reminders: public, English, YouTube or Vimeo, no third-party trademarks or unlicensed music/footage. Don't show a Playground token, an email address or an AWS account id on screen — blur the token field and use a masked account.

---

## 5. Product feedback (required)

> _One required field. Paste the whole section; it covers every tool, API and SDK used, including the AWS services (which the form asks for right here)._

### Ring Partner API + Developer Playground — *would build with it again: yes*

**Used for:** device discovery with capabilities/configuration/location, event history, snapshot and clip download, WHEP live view, account lookup. Eleven endpoints, all server-side.

**Worked well.** The JSON:API shape is consistent, so one normaliser handled every resource. `include=status,capabilities,location,configurations` meant one round trip for a full device picture — that is a genuinely good API decision. Capabilities arriving as structured read-only facts let us build an honest capability matrix instead of guessing by model name. WHEP was the surprise: a plain SDP POST returning an SDP answer, with a `Location` header for teardown, is far less work than a bespoke signalling protocol, and it let us keep the token entirely on the server. Error documents carried enough detail to build a real error taxonomy, and `Retry-After` was respected on rate limits.

**Needs work.** The Playground is where the friction is. The 30-minute token with no refresh path dominated our design: a demo that outlives half an hour needs a reconnect flow, and we had to build sealed-cookie session handling and "last known" status everywhere because a lapsed token means status can no longer be verified. The Playground gives exactly one synthetic device and no way to add a second, so multi-device behaviour (the whole point of "access control" and "business systems" use cases) could only be tested against a local emulator we wrote ourselves. `POST media/image/download` 404s until a live view has been started on the device — correct behaviour, probably, but undocumented and it cost us an afternoon. Lifecycle webhooks are documented but not simulable, so every integration ends up polling. `GET /v1/accounts/me/subscriptions` is documented and answers 422. And our own media requests appear back in device history as `on_demand` events, which means any pipeline that analyses history has to learn to ignore its own footprints.

**Onboarding.** Good: a free Ring account to a first successful `GET /v1/devices` took under an hour, and the docs are organised by task. The gap is between "hello world" and "real app" — token lifetime, snapshot preconditions, history semantics and what is deliberately *not* exposed (device control, two-way audio, household) are the things a real integration needs on day one, and they are the hardest to find.

### Amazon Bedrock — Amazon Nova Pro (`amazon.nova-pro-v1:0`, Converse API) — *again: yes*

**Used for:** reading every Ring snapshot (and clip, on demand) into a structured JSON judgement; writing the period summaries on AI Insights and Business; answering assistant questions grounded in the user's own data.

**Worked well.** Nova Pro's vision quality on doorbell frames was better than we expected at this price — it reliably distinguishes a parcel on the step from a person at the door, and, crucially, it says what it is *unsure* about, which is what made a confidence-based rule ("low confidence → always notify") possible. The Converse API is a clean abstraction: one call shape for image and video, usage tokens in the response, and no model-specific plumbing, so a model swap is one environment variable. Video input on the same API meant "analyze the full clip" was a small change rather than a second integration.

**Needs work.** Structured output is the main gap: we prompt for JSON and then validate and repair it ourselves, because there is no response-schema guarantee on this path — a `response_format`/tool-schema contract would delete a whole module. Token accounting for images is opaque enough that building a budget guard was guesswork at first. The error surface could be kinder: a throttle, an oversized payload and a model-access problem are all easy to confuse from the client side. And regional model availability still needs checking per account before you design around a model.

### Amazon Cognito (managed login + `aws-jwt-verify`) — *again: yes, with reservations*

**Used for:** email/password and Google sign-in; server-side access-token verification on every API route; the `sub` as the ownership key for all stored data.

**Worked well.** `aws-jwt-verify` is excellent — JWKS caching and verification in a few lines, and it made "verify on the server, trust nothing from the client" the easy path. Hosted managed login plus a Google identity provider gave us real federated sign-in with no UI work.

**Needs work.** The callback/sign-out URL matching is exact, including the trailing slash, and the failure mode is a bare *"Invalid request"* page with nothing in it to debug — we lost real time to a missing `/`. A message naming the mismatched redirect URI (or even just "redirect_uri not registered") would have made it a thirty-second fix. Federated email-vs-username behaviour also deserves a prominent note: we ended up deriving a stable username from a hash of the email to keep identities consistent across providers.

### Amazon DynamoDB — *again: yes*

**Used for:** one table, `PK = USER#{sub}` + typed `SK` prefixes (`EVENT#`, `ANALYSIS#`, `MEDIA#`, `NOTIFICATION#`, `RULE#`, `CARE#`, `AUTO_STATE`…), holding everything the app remembers.

**Worked well.** Single-table design is a natural fit for per-user data: because every query is scoped to the caller's partition and we never Scan, tenant isolation is a property of the access pattern, not of application code we have to get right. The AWS SDK v3 document client is pleasant, and it survived moving to a stateless runtime without a thought — when Lambda froze our background work, DynamoDB became the scheduler state and everything kept working.

**Needs work.** Mostly a docs issue: the single-table patterns that make this work are community knowledge, not the first thing the official guides teach. A first-party "one table for a multi-tenant app" walkthrough would save a lot of people a lot of rework.

### Amazon S3 — *again: yes*

**Used for:** a private bucket (Block Public Access, SSE-S3) holding analyzed snapshots and clips under `users/{sub}/events/{eventId}/…`, streamed back through an authenticated route.

**Worked well.** Nothing to report, which is the compliment — Block Public Access plus SSE-S3 plus a prefix-scoped IAM policy gave us private media with no surprises, and streaming objects through our own authorising route was simpler than managing pre-signed URL lifetimes.

**Needs work.** Prefix-scoped policies are still easy to get subtly wrong by hand; a policy generator for "this role may only touch `users/${aws:PrincipalTag/sub}/*`" would help people avoid reaching for `AmazonS3FullAccess`.

### Amazon SES — *again: yes*

**Used for:** the alert email (analyzed frame, decision, reason) and the daily report, from a verified domain with DKIM and a configuration set.

**Worked well.** Domain verification and DKIM were straightforward, and the configuration set gave us delivery visibility that made debugging production mail possible at all. Raw-email sending with an inline image attachment worked first try.

**Needs work.** One sharp edge cost us a production outage: sending *with* a configuration set requires `ses:SendEmail` on **both** the identity ARN and the configuration-set ARN, and when the second is missing the error is a flat `AccessDenied` that names neither. Naming the resource that was denied would have turned an hour into a minute. Sandbox-mode restrictions are reasonable but need to be louder in the console for someone wiring up notifications for the first time.

### AWS Amplify Hosting (Next.js SSR compute) — *again: yes, now that we know the rules*

**Used for:** building and running the whole app, with an IAM compute role for Bedrock, DynamoDB, S3 and SES — no long-lived AWS keys anywhere.

**Worked well.** Git-push-to-deploy with SSR support and a compute role is the right default for this kind of app; getting from repo to a working production URL took one afternoon. Build logs are clear and the role-based model meant we never created an access key.

**Needs work.** Two things surprised us hard, and both are environment-variable semantics. First, variables set in the Amplify console are available to the **build**, not automatically to the **SSR runtime** — our S3 media silently 404'd in production while working locally, and the fix was to copy an allow-list into the server bundle at build time. Second, Amplify **Secrets** are not visible to the build at all, so a secret we stored "properly" arrived as `undefined` and mail stopped. Either behaviour is defensible; neither is obvious, and the failure mode in both cases is a feature that silently does nothing. Third, the SSR compute is stateless and frozen after the response — any fire-and-forget work after `return` simply never runs. That is standard Lambda behaviour, but a Next.js app that works on a long-lived server will break in exactly this way on deploy, and it deserves a warning in the Next.js-on-Amplify docs. A clear "runtime vs build variables" table and a "your background work will not run" note would prevent most of what we hit.

### Amazon CloudWatch — *again: yes*

**Used for:** structured JSON logs for sync, analysis, notification and a `runtime_config` line reporting which integrations are actually configured on each instance (names and booleans only, never secrets).

**Worked well.** Structured logs plus Logs Insights is what let us diagnose every production problem above from the outside. The `runtime_config` pattern — log what *is* configured, never the values — is now our default for anything deployed.

**Needs work.** Getting from an Amplify SSR request to its log group is more clicks than it should be, and correlating a user-visible failure with the right invocation needs a request id you have to plumb yourself.

### Amazon Devices Builder Tools (MCP server / Agent Skills)

Not used. We built with an AI coding assistant throughout, but against the Ring REST docs directly rather than the MCP server. Our note, as feedback: the single most valuable thing that tooling could have given us is not scaffolding, it is *ground truth about what the API refuses to do* — token lifetime, snapshot preconditions, which endpoints are read-only, what is not exposed to partners. We spent more time discovering those than writing code.

---

## 6. What we'd do differently

Design for the token lifetime on day one instead of retrofitting a session model around it; write the local emulator before the integration rather than after the Playground's single device became a wall; and assume the production runtime is stateless from the first commit — three of our four production incidents came from code that was correct on a long-lived server.

---

## 7. Did the project exist before the hackathon?

**No.** MATAN AI was created during the hackathon window: first commit **2026-09-16**, 73 commits to 2026-10-20, all in the submitted repository. Nothing was carried in from an earlier project; the Next.js UI, the Ring integration, the Nova pipeline, the Decision Engine and Smart Rules, the AWS provisioning scripts, the documentation and the architecture diagrams were all written inside the window. Public commit history: <https://github.com/ajitonelsonn/matan-ai/commits/main>.

---

## 8. Feature requests (optional)

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

## 9. Friction log (optional, up to 10% judging bonus)

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

## Before you hit submit

1. **Record and publish the video** (public, English, under 3:00, shows the Ring simulator or a real device) — [shot list above](#4-demo-video-under-3-minutes).
2. **Decide the Open Source answer** — [option A or B](#3-open-source-mini-challenge); A is roughly an hour of lifting `lib/ring/` into its own MIT repo.
3. **Check the repo is public and the MIT file is at the root** (it is, as of 2026-10-20). If you ever make it private, add `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar` as collaborators **at submission time** — invitations expire after 7 days.
4. **Rotate `RING_SESSION_SECRET`** and confirm no screenshot, log or diagram in the repo shows a token, an email address or an AWS account id.
5. **Paste:** description (§1), AWS write-up ([HACKATHON.md](HACKATHON.md#aws-builder-mini-challenge--which-aws-services-and-how)), Open Source fields (§3), product feedback (§5), pre-existing answer (§7), feature requests (§8), friction log (§9).

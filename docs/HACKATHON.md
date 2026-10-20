# Hackathon submission notes

**Build, Ship, Shape: Amazon Developer Hackathon** — primary track: **Ring**. Also submitted to the **AWS Builder Mini Challenge** and the **Open Source Mini Challenge**.

Repository: <https://github.com/ajitonelsonn/matan-ai> · License: [MIT](../LICENSE) · Live app: `https://main.d3q4rxuohabv2i.amplifyapp.com`

> **Filling in the form?** Every required and optional field — description, product feedback, feature requests and the friction log — is answered and ready to paste in [`SUBMISSION.md`](SUBMISSION.md).

---

## Ring track — what the project does with Ring

MATAN AI is built on the **Ring Developer Playground / Partner API**, not on mock data:

- **Device discovery** — `GET /v1/devices` with status, capabilities, configuration and location; the capability matrix and read-only configuration are shown exactly as Ring reports them.
- **Event history** — polled and merged with Matan's own records; every event keeps its Ring type (`motion`, `package`, `vehicle`, `on_demand`…), device and duration.
- **Media** — `POST /v1/devices/{id}/media/image/download` for snapshots and the clip endpoint for video, pulled server-side and stored privately.
- **Live view** — WebRTC through `POST /v1/devices/{id}/media/streaming/whep/sessions`: the SDP offer/answer is relayed by the server, then media flows directly between the browser and Ring's edge.
- **Account** — `GET /v1/users/me` for the Ring account card (email masked).

Ring's limits are surfaced, not hidden: device control (siren, lights, lock, recording), chime audio, household mapping, lifecycle webhooks and subscription status are each labelled _future integration_ in the UI with the reason.

## AWS Builder Mini Challenge — which AWS services and how

> _Ready to paste into the submission form._

**Amazon Bedrock (Amazon Nova Pro)** — the core intelligence. Every new Ring event is sent to Nova Pro through the Converse API with the snapshot (escalating to the video clip when a still is not enough) plus a compact JSON context. Nova returns a validated structured reading: summary, category, confidence, observations and uncertainty. The same model writes the period summaries on AI Insights and Business, and powers the assistant, which is grounded only in the signed-in user's own devices, events, decisions and rules. A monthly token budget and per-hour caps are enforced in the application.

**Amazon Cognito** — identity for the whole app: email + password and Google sign-in through the managed login. The browser holds the tokens via Amplify Auth; every API route verifies the access token server-side with `aws-jwt-verify` and derives the user's `sub`, which is the ownership key for all stored data.

**Amazon DynamoDB** — a single table (`PK = USER#{sub}`) holding events, Nova analyses, decisions, media metadata, Care Context, Smart Rules, security mode, assistant conversations, notification records and settings. Access is query-only (no Scan), so a request can only ever read its own partition.

**Amazon S3** — a private bucket (Block Public Access, SSE-S3) for the snapshots and clips Matan analysed, keyed `users/{sub}/events/{eventId}/…`. The browser never touches S3: media is served through an authenticated route that checks ownership and streams the object.

**Amazon SES** — branded alert emails (the analyzed frame, the decision and the reason) and the daily report, sent from a verified domain with DKIM and a configuration set, with an SMTP fallback while SES is in sandbox.

**AWS Amplify Hosting (Next.js SSR compute)** — builds and runs the app. The build copies an allow-list of server variables into the server bundle; the runtime uses an IAM **compute role** (Bedrock, DynamoDB, S3, SES) so there are no long-lived AWS keys anywhere. Because the compute is stateless and frozen after each response, the Ring session travels in an AES-256-GCM sealed HttpOnly cookie, scheduler state lives in DynamoDB, and each analysis — including the email — completes inside a single request.

**Amazon CloudWatch** — structured logs for sync, analysis, notification and a `runtime_config` line that reports which integrations are actually configured on each instance (names and booleans only, never secrets).

Architecture diagrams: [`docs/architecture/`](architecture/README.md). Deployment and the production issues we hit and fixed: [`docs/AWS_DEPLOYMENT.md`](AWS_DEPLOYMENT.md).

## Open Source Mini Challenge

- **Project repository URL:** <https://github.com/ajitonelsonn/matan-ai>
- **Contribution URL:** <https://github.com/ajitonelsonn/matan-ai> _(new open-source repository created during the hackathon window)_
- **GitHub username:** `ajitonelsonn`
- **License:** MIT

**What it is, how it works, why it matters** _(ready to paste)_

MATAN AI is a new open-source project: an AI home-awareness dashboard for Ring devices. It takes each Ring event, has Amazon Nova Pro read the camera evidence, scores it with a deterministic Decision Engine, applies the user's own Smart Rules (quiet hours, sensitivity, repeat detection), and only emails the person when the decision warrants it — with the analyzed frame and the reason. It runs entirely on AWS (Cognito, Bedrock, DynamoDB, S3, SES, Amplify Hosting) and on the Ring API.

Anyone can run their own instance: the repository includes provisioning scripts for the Cognito pool, DynamoDB table and private S3 bucket, a documented `.env.example`, an IAM policy with least privilege, deployment notes for Amplify, and a Demo Mode that works before any Ring or AI service is configured. The documentation is part of the repo and is also browsable in the app at `/docs`.

It matters because camera alerts today are noise: a motion notification cannot tell a parcel from a stranger, and people stop reading them. Making the _decision_ explainable — what the model saw, which rule matched, why an email was or wasn't sent — is the difference between an alert stream and something a family, a grandparent or a small shop owner can actually trust. Built in Dili, Timor-Leste, for _Safer Homes, Stronger Communities_.

## Honest scope

What is **real** in Real Mode: Ring discovery, history, media and live view; Nova Pro analysis; the Decision Engine and Smart Rules; per-user storage; email alerts and the daily report; the grounded assistant; export.

What is **labelled future integration** (and why): Ring device control, chime audio, household/family mapping, lifecycle webhooks, subscription status (not available to partners or to the Playground); push/SMS channels, multi-user workspaces, schedules and third-party automations (not built in this scope). The full audit, page by page, is in [`docs/pages/README.md`](pages/README.md).

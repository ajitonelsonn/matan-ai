# MATAN AI — system architecture

![MATAN AI system architecture](matan-ai-architecture.png)

> Source: [`architecture.html`](architecture.html) · logos in [`logos/`](logos/) · the PNG is a 2× render of that page (see *Regenerating* below).

## The four lanes

| Lane | What runs there |
| --- | --- |
| **Client · Browser** | The Next.js 16 / React 19 app. Holds the Cognito session (Amplify Auth), plays the Ring WebRTC stream, fetches protected media with the access token, and drives one analysis step per request. |
| **AWS Amplify Hosting · Next.js SSR compute** | Every `/api/…` route handler. Verifies the Cognito token (`aws-jwt-verify`), keeps the Ring Playground token sealed in an HttpOnly cookie, syncs Ring events, and runs the Matan pipeline (Nova Pro → Decision Engine → Smart Rules) and the notifier. |
| **AWS managed services** | Cognito (identity), Bedrock/Nova Pro (analysis, summaries, assistant), DynamoDB (single table, everything keyed by the user's `sub`), S3 (private media), SES (alerts), CloudWatch (structured logs). Credentials come from the Amplify compute role — no long-lived keys. |
| **External** | The Ring Developer Playground (Partner API: devices, history, snapshot/clip, WHEP live view) and the user's mailbox. |

## Request flow

1. **Signed-in request** — the browser calls `/api/…` with `Authorization: Bearer <access token>`.
2. **Sign-in / tokens** — Amplify Auth talks to Cognito directly (email + password, or Google through the managed login).
3. **Devices & event history** — the server calls the Ring Partner API with the Playground token (never exposed to the browser).
4. **New events persisted** — Ring history is merged with stored events; new ones are marked pending analysis.
5. **Nova Pro reads the evidence** — snapshot first, escalating to the clip when it adds information.
6. **Analysis + decision stored** — Nova's structured result, the Decision Engine's priority/action and the Smart Rules outcome are written to DynamoDB.
7. **Snapshot / clip into S3** — media is stored under `users/{sub}/events/{eventId}/…` in a private bucket.
8. **Ring media pulled server-side** — the image/clip download happens on the server; the browser never holds a Ring token.
9. **Notify / Escalate → SES** — only decisions that warrant it produce an email (SMTP fallback while SES is in sandbox).
10. **Alert email delivered** — branded email with the analyzed frame, the decision and the reason.
11. **Media served with the token** — `/api/matan/media/:id` checks ownership, then streams the S3 object.
12. **Browser drives each analysis** — the sync only records pending work; the browser calls `/api/matan/auto/step`, which completes one analysis inside that request (serverless compute is frozen after a response).
13. **Live WebRTC** — SDP is exchanged through the server, then media flows directly between the browser and Ring's edge.

## Design rules the diagram encodes

- **Per-user by construction** — every stored item is keyed by the verified Cognito `sub`.
- **Nothing simulated in Real Mode** — a panel is backed by Ring, AWS or Matan's own stored data, or it is labelled a future integration.
- **Secrets stay server-side** — Ring token in a sealed cookie, AWS access through the compute role, S3 private with Block Public Access.
- **Built for serverless** — no fire-and-forget work: analysis and email complete inside the request that started them (see [`../AWS_DEPLOYMENT.md`](../AWS_DEPLOYMENT.md)).

## Regenerating

```bash
# any Chrome-based renderer works; this is what produced the committed PNG
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await (await b.newContext({ viewport: { width: 1720, height: 1180 }, deviceScaleFactor: 2 })).newPage();
  await p.goto("file://" + process.cwd() + "/docs/architecture/architecture.html", { waitUntil: "networkidle" });
  await p.locator("#canvas").screenshot({ path: "docs/architecture/matan-ai-architecture.png" });
  await b.close();
})();'
```

## Asset credits

| Asset | Source | Terms |
| --- | --- | --- |
| Amazon Cognito, DynamoDB, S3, SES, Lambda, CloudWatch, Amplify icons | AWS Architecture Icons (via `icon.icepanel.io`) | © Amazon Web Services — used to identify AWS services |
| Amazon Bedrock icon | [awslabs/aws-icons-for-plantuml](https://github.com/awslabs/aws-icons-for-plantuml) | Apache-2.0 repository, AWS trademark |
| Ring, Next.js, React, TypeScript, Tailwind CSS, Node.js, Gmail, WebRTC | [Simple Icons](https://simpleicons.org) (`cdn.simpleicons.org`) | CC0 1.0 — brand marks remain the property of their owners |

Logos are used only to identify the technologies in this diagram; no endorsement is implied.

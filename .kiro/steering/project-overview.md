# MATAN AI — Project Overview

## What is MATAN AI?

**MATAN AI** is an intelligent home and business security awareness platform that sits on top of Ring cameras and devices. It transforms raw motion/event data from Ring into contextualized, actionable intelligence using AI.

> **Ring sees the event. Matan understands the situation, decides what deserves attention, and helps the user act.**

## Core Concept

MATAN AI is NOT a Ring replacement — it's a decision layer built on the Ring Partner API that:
- Connects to Ring devices via the Ring Developer Playground API
- Analyzes events using Amazon Bedrock (Nova Pro vision model)
- Applies user-configurable care context and smart rules
- Makes deterministic, explainable decisions about what matters
- Emails only what the decision warrants, with the reason and the matched rule attached

**Positioning — keep this accurate.** Ring's own products already classify people, packages and vehicles (Smart Alerts), write AI Video Descriptions, search footage in natural language, merge related alerts and, since CES 2026, flag unusual activity. Never write that Ring "only detects motion" or sends "motion spam". What Matan adds is a layer a *developer* can build and a *user* can audit: the Partner API hands you a device, a history entry and a camera frame, and Matan turns that into a decision driven by rules the user authored, with the matched rule stored on the event — authored and auditable rather than inferred, running in the user's own AWS account.

## Tech Stack

### Framework & Runtime
- **Next.js 16** (App Router) with TypeScript
- React 19
- Tailwind CSS 4
- Node.js runtime

### AWS Services
- **Amazon Bedrock** (Nova Pro v1) — Vision AI for event analysis
- **Amazon Cognito** — User authentication (email/password + Google OAuth)
- **DynamoDB** — Primary data store for users, devices, events, analyses, rules
- **S3** — Media storage for event snapshots/videos
- **Amazon SES** — Transactional email notifications

### Third-Party Integrations
- **Ring Developer Playground** — Real Ring API integration for devices and events

## Architecture Flow

```
Ring Developer Playground
        │
        │ Events, devices, snapshots
        ▼
Next.js API Routes (authenticated)
        │
        ├── Event normalization
        ├── Snapshot / media retrieval → S3
        ├── Amazon Bedrock Nova Pro → Vision analysis
        ├── User Care Context (DynamoDB)
        ├── Smart Rules evaluation (deterministic)
        ├── Decision Engine → IGNORE | MONITOR | NOTIFY | ESCALATE
        ├── DynamoDB persistence
        └── Amazon SES notifications
        │
        ▼
React UI Dashboard
```

## Key Features Implemented

### 1. Authentication & User Management
- Cognito-based authentication with JWT verification
- Google OAuth integration
- Server-side session management
- Secure user isolation (all data scoped to Cognito `sub`)

### 2. Ring Integration
- Real Ring Developer Playground / Partner API connection
- Connected with a Playground access token the user pastes — **not** OAuth account linking (`/v1/accounts/me/app-integrations` is not available to a Playground token)
- Device discovery with status, capabilities, location and configuration
- Event history retrieval
- Snapshot and clip download, server-side (a snapshot needs a recent live-view session on the device)
- WebRTC (WHEP) live view, SDP relayed by the server
- Ring token sealed (AES-256-GCM) in an HttpOnly cookie, 30-minute Playground lifetime with a reconnect flow

### 3. AI-Powered Event Analysis
- Amazon Bedrock Nova Pro vision model (Converse API)
- Analyzes the Ring snapshot for the event window, escalating to the clip when a still is not enough (the Playground serves snapshots only — live-view simulations are not recordings)
- Reads each frame for:
  - Subject/object detection (person, package, vehicle, animal)
  - Contextual scene understanding
  - Risk assessment
  - Confidence scoring
- Token budget management to control costs

### 4. Care Context & Smart Rules
- User-configurable care preferences:
  - Quiet hours (timezone-aware)
  - Notification preferences
  - Detection sensitivity levels
  - Repeated event thresholds
- Deterministic rule engine with priority-based evaluation
- Built-in safety rules (high-risk always escalates)
- Explainable decisions (shows which rules matched)

### 5. Intelligent Decision Engine
- Deterministic action classification:
  - **IGNORE** — Not relevant
  - **MONITOR** — Track but don't notify
  - **NOTIFY** — Send standard notification
  - **ESCALATE** — High-priority alert
- Rule-based decision making (NOT LLM-controlled)
- Context-aware priority assessment

### 6. Notification System
- Amazon SES for transactional emails
- SMTP fallback support
- Idempotent delivery (no duplicate notifications)
- User-controlled notification preferences
- Respects quiet hours with high-risk override

### 7. UI/UX Dashboard
Premium dark-mode interface with:
- **Home** — At-a-glance status and recent intelligence
- **Live View** — WebRTC (WHEP) stream, real Ring snapshot, frame screenshot, today's timeline (device controls: future integration)
- **Events** — Event history with Matan's analysis, decision and notification outcome on every entry
- **AI Insights** — Trends, charts and a Nova-written period summary over the user's own events
- **AI Assistant** — Natural language queries answered by Nova, grounded only in the user's own data
- **Automations** — Smart Rules with real 7-day match counts and an activity log (device actions: future integration)
- **Security Modes** — Per-user monitoring profile read by the Decision Engine
- **Devices** — Ring discovery, capabilities and read-only configuration
- **Care & Family** — Care Context: quiet hours, sensitivity, care status (family members / presence: future integration, the Ring Partner API exposes no household mapping)
- **Business** — Single-location business view: 7-day metrics, busiest hours, daily report email (multiple locations and team roles: future integration)
- **Settings** — Configuration and preferences

> Every claim in this list is audited page by page in [`docs/pages/README.md`](../../docs/pages/README.md), with each function marked real or future integration. If this list and that audit ever disagree, the audit is right.

## Project Structure

```
matan-ai/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (authenticated)
│   │   ├── assistant/            # AI assistant chat
│   │   ├── automations/          # Automation rules CRUD
│   │   ├── business/             # Business features
│   │   ├── dashboard/            # Home dashboard data
│   │   ├── devices/              # Ring device management
│   │   ├── events/               # Event history
│   │   ├── family/               # Care & family features
│   │   ├── insights/             # Analytics
│   │   ├── matan/                # Core Matan AI logic
│   │   │   ├── analyze/          # Event analysis
│   │   │   ├── care/             # Care context
│   │   │   ├── rules/            # Smart rules CRUD
│   │   │   ├── notifications/    # Notification management
│   │   │   └── ...
│   │   └── ring/                 # Ring API integration
│   ├── (auth routes)             # Login, signup pages
│   └── (dashboard routes)        # UI pages
├── components/
│   ├── layout/                   # App shell, sidebar, topbar
│   ├── matan/                    # Domain-specific components
│   └── ui/                       # Reusable UI primitives
├── lib/
│   ├── auth/                     # Cognito JWT verification
│   ├── aws/                      # AWS SDK clients
│   ├── db/                       # DynamoDB helpers
│   ├── matan/                    # Core Matan logic
│   │   ├── analyze/              # Analysis pipeline
│   │   ├── decision/             # Decision engine
│   │   ├── rules/                # Rule evaluation
│   │   └── notifications/        # Notification system
│   ├── ring/                     # Ring API client
│   └── types/                    # TypeScript types
├── scripts/                      # Admin/setup scripts
├── tests/                        # Unit tests
└── docs/                         # Implementation documentation
```

## Security Model

### Authentication & Authorization
- All API routes require valid Cognito JWT
- User identity extracted from JWT `sub` claim
- All DynamoDB operations scoped to `USER#{sub}`
- No user ID accepted from client (always from JWT)

### Secret Management
- Ring tokens sealed in HttpOnly cookies (AES-256-GCM)
- AWS credentials server-side only (never exposed to browser)
- No tokens in localStorage/sessionStorage
- Environment variables for sensitive config
- `.env` excluded from git

### Data Isolation
- User A cannot access User B's:
  - Devices
  - Events
  - Analyses
  - Rules
  - Care context
  - Media

### API Security
- Server-side Ring session management
- Protected S3 media URLs (time-limited signed URLs)
- Input validation on all routes
- CORS protection

## Data Model (DynamoDB)

Single table design with composite keys:

```
PK                    SK                      Purpose
────────────────────────────────────────────────────────────────
USER#{sub}            PROFILE                 User profile
USER#{sub}            RING_ACCOUNT            Ring connection
USER#{sub}            DEVICE#{deviceId}       Ring device
USER#{sub}            EVENT#{eventId}         Ring event
USER#{sub}            ANALYSIS#{analysisId}   AI analysis
USER#{sub}            CARE_CONTEXT            Care preferences
USER#{sub}            RULE#{ruleId}           Smart rule
USER#{sub}            NOTIFICATION#{notifId}  Notification log
```

## Environment Variables

See `.env.example` for complete list. Key variables:

### AWS Services
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — Server-side credentials
- `AWS_REGION` — AWS region (default: us-east-1)
- `BEDROCK_MODEL_ID` — Amazon Bedrock model (default: amazon.nova-pro-v1:0)
- `DYNAMODB_TABLE_NAME` — DynamoDB table name
- `S3_MEDIA_BUCKET` — S3 bucket for media storage

### Amazon Cognito
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID` — User pool ID
- `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` — App client ID
- `NEXT_PUBLIC_COGNITO_DOMAIN` — Managed login domain

### Ring Integration
- `RING_SESSION_SECRET` — Session sealing key (32+ random chars)

### Notifications
- `SES_FROM_EMAIL` — Verified sender email
- `APP_BASE_URL` — Base URL for email links

## Development Commands

```bash
# Development
pnpm dev                    # Start dev server

# Build
pnpm build                  # Production build
pnpm start                  # Start production server

# Type checking & tests
pnpm typecheck              # TypeScript validation
pnpm test                   # Run test suite
pnpm lint                   # ESLint

# AWS Provisioning
pnpm cognito:provision      # Create Cognito user pool
pnpm cognito:inspect        # Inspect Cognito config
pnpm s3:provision           # Create S3 media bucket
pnpm s3:check               # Verify S3 setup
pnpm dynamodb:check         # Verify DynamoDB setup
pnpm ses:check              # Verify SES setup
pnpm email:check            # Test email delivery

# Ring
pnpm ring:inspect           # Inspect Ring connection
```

## Important Implementation Rules

### 1. Never Fake Ring Functionality
- All Ring data must come from real Ring API
- Do not create fake Ring events in production
- Do not claim unsupported Ring capabilities
- Test fixtures only for unit tests

### 2. Nova is Analysis, Not Control
- Amazon Bedrock provides interpretation
- Decision Engine makes final action decision
- LLM cannot directly trigger actions
- All actions are deterministic and rule-based

### 3. Preserve Security
- Ring tokens stay server-side
- AWS credentials stay server-side
- All user data scoped to Cognito sub
- Input validation on all routes
- HttpOnly cookies for Ring sessions

### 4. Data Consistency
- Same event should have same meaning everywhere
- Device names/IDs must match across pages
- Family members must be consistent
- Use shared TypeScript types

### 5. Cost Management
- Nova analysis only when needed
- Token budget monitoring
- Notification idempotency (no duplicates)
- Video analysis disabled at 80% budget
- All analysis stops at 100% budget

## Timor-Leste Context

The project has special consideration for Timor-Leste:
- Timezone: Asia/Dili
- Identity panel showing "Safer Homes / Stronger Communities / Timor-Leste"
- User profile: Ajito Nelson, Administrator, Dili, Timor-Leste
- Multi-language support planned

## Design System

### Visual Identity
- **Dark mode only** (for current phase)
- Deep navy base (#031326)
- Electric blue/cyan primary (#12a8ff, #12e6ff)
- Emerald success (#16df9b)
- Amber warning (#ffc34a)
- Red danger (#ff4d5e)
- Purple accent (#9a71ff)

### Typography
- Font: Inter
- Generous line height
- Clear hierarchy (40px titles → 12px labels)

### Interaction
- Subtle 150–250ms transitions
- Hover/focus/active states on all buttons
- Visible focus rings (accessibility)
- Reduced motion support

## Current Status

✅ **Completed**
- Full authentication system (Cognito + Google OAuth)
- Real Ring API integration
- Amazon Bedrock Nova Pro analysis
- DynamoDB data layer
- S3 media storage
- Amazon SES notifications
- Care context & smart rules
- Decision engine
- Complete UI dashboard (11 main routes)
- Responsive design
- User isolation
- Security model

🚧 **In Progress / Planned**
- Real-time event streaming
- Advanced automation workflows
- Mobile app
- Additional language support
- Business multi-location features
- Family member recognition
- Device control actions

## Documentation

The working specs (`MATAN_AI_*.md`) are local-only and git-ignored. What is in the repository is the implementation report for each milestone, which is what to read:

| Area | Document |
| --- | --- |
| AI analysis & Decision Engine | [`docs/BEDROCK_NOVA_IMPLEMENTATION.md`](../../docs/BEDROCK_NOVA_IMPLEMENTATION.md) |
| Care context & Smart Rules | [`docs/CARE_CONTEXT_SMART_RULES.md`](../../docs/CARE_CONTEXT_SMART_RULES.md) |
| Authentication | [`docs/COGNITO_AUTH_IMPLEMENTATION.md`](../../docs/COGNITO_AUTH_IMPLEMENTATION.md) |
| Ring integration | [`docs/RING_ADD_DEVICE_IMPLEMENTATION.md`](../../docs/RING_ADD_DEVICE_IMPLEMENTATION.md) · [`docs/RING_ACCOUNT_DEVICE_INTELLIGENCE.md`](../../docs/RING_ACCOUNT_DEVICE_INTELLIGENCE.md) |
| Database design | [`docs/DYNAMODB_IMPLEMENTATION.md`](../../docs/DYNAMODB_IMPLEMENTATION.md) |
| Media storage | [`docs/S3_MEDIA_IMPLEMENTATION.md`](../../docs/S3_MEDIA_IMPLEMENTATION.md) |
| Notifications | [`docs/SES_NOTIFICATIONS_IMPLEMENTATION.md`](../../docs/SES_NOTIFICATIONS_IMPLEMENTATION.md) |
| Deployment | [`docs/AWS_DEPLOYMENT.md`](../../docs/AWS_DEPLOYMENT.md) |
| Every page, audited | [`docs/pages/README.md`](../../docs/pages/README.md) |

## Target Deployment

- **Platform:** AWS Amplify Hosting with Next.js SSR compute (`amplify.yml`, `version: 1`), IAM compute role — no long-lived keys
- **Region:** us-east-1
- **Build:** default Next.js build; the build copies an allow-list of server variables into `.env.production`, because Amplify exposes console variables to the build only (see `docs/AWS_DEPLOYMENT.md`)
- **Domain:** the default `*.amplifyapp.com` domain over HTTPS

## Key Principles

1. **Intelligent, Not Noisy** — Reduce alert fatigue through smart filtering
2. **Trustworthy** — Explainable decisions, deterministic actions
3. **Secure** — Enterprise-grade authentication and data isolation
4. **Honest** — Never claim capabilities we don't have
5. **Premium** — Production-quality UI/UX that feels professional
6. **Cost-Conscious** — Token budgets, efficient API usage
7. **User-Controlled** — Users configure their own care context and rules

## Getting Help

- Check relevant spec files for detailed implementation guides
- Run diagnostic scripts (`pnpm <service>:check`)
- Inspect AWS resources via scripts (`pnpm <service>:inspect`)
- Review `docs/` folder for implementation reports
- Check `.env.example` for required environment variables

---

**Remember:** MATAN AI is a decision layer on top of Ring — it does not replace Ring, compete with Ring's own AI features, or fake capabilities the Partner API does not expose. It's an intelligent interpretation layer that respects what Ring provides and adds contextual understanding on top.

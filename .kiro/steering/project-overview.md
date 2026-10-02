# MATAN AI — Project Overview

## What is MATAN AI?

**MATAN AI** is an intelligent home and business security awareness platform that sits on top of Ring cameras and devices. It transforms raw motion/event data from Ring into contextualized, actionable intelligence using AI.

> **Ring sees the event. Matan understands the situation, decides what deserves attention, and helps the user act.**

## Core Concept

MATAN AI is NOT a Ring replacement — it's an intelligent interpretation layer that:
- Connects to Ring devices via the Ring Developer Playground API
- Analyzes events using Amazon Bedrock (Nova Pro vision model)
- Applies user-configurable care context and smart rules
- Makes deterministic decisions about what matters
- Sends intelligent notifications instead of motion spam

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
- Real Ring Developer Playground API connection
- OAuth-based Ring account linking
- Device discovery and management
- Event history retrieval
- Live snapshot capture
- Server-side Ring session with HttpOnly cookies

### 3. AI-Powered Event Analysis
- Amazon Bedrock Nova Pro vision model
- Analyzes event images/videos for:
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
- **Live View** — Real-time camera feeds with AI overlay
- **Events** — Intelligent event history (not just motion spam)
- **AI Insights** — Trends, patterns, and analytics
- **AI Assistant** — Natural language queries (powered by Nova)
- **Automations** — Event-driven workflows
- **Security Modes** — Context-aware monitoring profiles
- **Devices** — Ring device management
- **Care & Family** — Family-focused monitoring
- **Business** — Multi-location business security
- **Settings** — Configuration and preferences

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

Detailed specs available in project root:
- `MATAN_AI_UI_UX_BUILD_SPEC.md` — Complete UI/UX specification
- `MATAN_AI_CARE_CONTEXT_SMART_RULES.md` — Care context & rules implementation
- `MATAN_AI_COGNITO_AUTH_IMPLEMENTATION_SPEC.md` — Authentication system
- `MATAN_AI_BEDROCK_NOVA_MATAN_DECISION_SPEC.md` — AI analysis & decision engine
- `MATAN_AI_RING_ADD_DEVICE_INTEGRATION.md` — Ring integration
- `MATAN_AI_DYNAMODB_IMPLEMENTATION.md` — Database design
- `MATAN_AI_S3_MEDIA_IMPLEMENTATION.md` — Media storage
- `MATAN_AI_SES_NOTIFICATIONS_IMPLEMENTATION.md` — Notification system
- `MATAN_AI_AWS_DEPLOYMENT_CLAUDE_HANDOFF.md` — Deployment guide

## Target Deployment

- **Platform:** AWS Amplify Gen 2 (SSR compute)
- **Region:** us-east-1
- **Build:** Next.js standalone output
- **Environment:** Production environment variables via Amplify console
- **Domain:** Custom domain with HTTPS

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

**Remember:** MATAN AI makes Ring smarter — it doesn't replace Ring or fake Ring features. It's an intelligent interpretation layer that respects what Ring provides and adds contextual understanding on top.

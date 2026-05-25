# SCM Intelligent Issue Portal — Technical Architecture

## 1. System Overview

The SCM Intelligent Issue Portal is a full-stack web application that digitises and intelligently manages Supply Chain Management (SCM) process improvement requests. It replaces manual spreadsheet-based workflows with a structured, role-aware ticketing system backed by AI-assisted analysis and document generation.

**Deployment model:** Fully serverless — frontend and backend both hosted on Vercel. Zero server management, auto-scaling, global CDN delivery.

**Core capabilities:**
- Structured issue capture with priority scoring and SLA tracking
- Role-based access for four user personas
- AI-generated Business Requirements Documents (BRDs)
- AI-powered leadership analytics chat
- Nightly AI insights refresh via cron

---

## 2. Technology Stack at a Glance

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18, Tailwind CSS, shadcn/ui | Vercel CDN |
| Backend | Node.js Serverless Functions (ES Modules) | Vercel |
| Database | Oracle Autonomous Database (Always Free) | Oracle Cloud (ap-hyderabad-1) |
| AI | Google Gemini 2.0 Flash | Google AI API |
| Auth | JWT + bcryptjs (pure JS) | In-app |
| Package manager | npm | — |

---

## 3. Frontend Architecture

**Framework:** React 18 with React Router v6 for client-side navigation (Single Page Application).

**UI library:** Tailwind CSS for utility-first styling combined with shadcn/ui — a collection of accessible, composable components built on Radix UI primitives.

**State management:** React Context API for global auth state (`AuthContext`). Server state managed via `useEffect` + fetch hooks per page — no Redux or external state library.

**Role-based views:** The UI adapts entirely based on the logged-in user's role:

| Role | Access |
|---|---|
| System Admin | User management, full ticket access, admin console |
| CoE Lead | All tickets, BRD editor, AI insights dashboard, leadership chat |
| POC Owner | Assigned tickets, status updates, test evidence uploads |
| Submitter | Own ticket submissions, comments, notifications |

**Key UI modules:**
- **Ticket Board** — Kanban/list view with SLA status badges (On Track / At Risk / Breached)
- **BRD Editor** — AI-drafted Business Requirements Document with 6 editable sections and audit pane
- **Leadership Chat** — Conversational AI interface for ad-hoc SCM analytics
- **Insights Dashboard** — Nightly AI-generated trend cards with impact scoring
- **Admin Console** — User provisioning with temporary passwords and must-change-password enforcement
- **SetPasswordModal** — Non-dismissible overlay enforced on first login

**First-login security flow:** New users receive a temporary password from the System Admin. On first login, a non-dismissible modal forces a password change before any other action is permitted.

---

## 4. Backend — API Layer

**Runtime:** Node.js 18+ with ES Module syntax (`import`/`export`). All API files live under `api/` and are deployed as individual Vercel Serverless Functions.

**Function count:** 11 serverless functions — within Vercel Hobby plan's 12-function cap.

**API endpoints:**

| Endpoint | Purpose |
|---|---|
| `POST /api/users` | Login, create user, change password, activate/deactivate |
| `GET/POST /api/tickets` | List and create tickets |
| `GET/PATCH /api/tickets/[id]` | Fetch and update a single ticket |
| `GET/POST /api/audit` | Audit log read and write |
| `GET/POST /api/comments` | Ticket comments |
| `GET/PATCH /api/notifications` | User notifications with fan-out |
| `GET/POST /api/test-evidence` | Test evidence file metadata |
| `GET/POST /api/insights` | AI insights (cron + feedback) |
| `POST /api/ai/generate-brd` | AI BRD generation for a ticket |
| `GET/POST /api/ai/leadership-chat` | Multi-turn AI analytics chat |
| `GET /api/health` | Health check + DB connectivity status |

**Authentication:** `requireUser(req)` helper extracts actor identity from request headers (name, id, role). Password hashing uses `bcryptjs` — a pure JavaScript bcrypt implementation with no native binary dependencies, compatible with Vercel's serverless environment.

**Shared libraries (`api/_lib/`):**

- `oracle.js` — Oracle DB adapter (connection, query, execute, insertMany, row normalisation)
- `http.js` — CORS handling, JSON response helper, body reader, auth extractor
- `mappers.js` — Converts Oracle rows ↔ frontend ticket shape
- `metrics.js` — Pure JS aggregations (module performance, POC performance, forecasting, comparisons)
- `priority.js` — Composite priority scoring algorithm (people affected, hours lost, cost savings, frequency, compliance risk)

---

## 5. Database — Oracle Autonomous Database

**Service:** Oracle Autonomous Transaction Processing (ATP), Always Free tier on Oracle Cloud Infrastructure, region: `ap-hyderabad-1`.

**Driver:** `oracledb` 6.x in **Thin Mode** — a pure JavaScript Oracle driver that requires no Oracle Instant Client installation. This is the key enabler for Vercel serverless compatibility; no native binaries are needed.

**Connection security:** Mutual TLS (mTLS) using the Oracle wallet (`ewallet.pem`). Because Vercel environment variables have a 4 KB per-variable limit, the base64-encoded PEM is split across three variables (`ORACLE_WALLET_PEM_1/2/3`) and reassembled at runtime. The wallet is written to `/tmp/oracle-wallet/` on first serverless invocation.

**Schema — 10 tables:**

| Table | Purpose |
|---|---|
| `app_users` | Users with hashed passwords, roles, active/inactive, must-change-password flag |
| `tickets` | Core issue records with all impact, SLA, and priority fields |
| `audit_log` | Immutable change log — every field change, AI event, and status transition |
| `brds` | Business Requirements Documents linked to tickets |
| `comments` | Ticket discussion threads |
| `notifications` | Fan-out notifications per user |
| `test_evidence` | Test evidence file metadata linked to tickets |
| `insights` | AI-generated nightly trend cards with superseded flag |
| `insight_feedback` | User thumbs up/down feedback on insights |
| `chat_sessions` / `chat_messages` | Leadership AI chat history with tool trace |

**Oracle SQL dialect notes:**
- Booleans stored as `NUMBER(1)` with `CHECK (col IN (0,1))`
- Arrays and JSON objects stored as `CLOB`, parsed/serialised in the adapter layer
- Timestamps use `TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP`
- `FETCH FIRST n ROWS ONLY` instead of PostgreSQL's `LIMIT`
- Idempotent DDL via PL/SQL `BEGIN EXECUTE IMMEDIATE ... EXCEPTION WHEN OTHERS THEN ...` blocks

---

## 6. AI & Automation Layer

**Provider:** Google Gemini 2.0 Flash — chosen for its 1,500 free requests/day quota, large context window, and native tool-use support.

**BRD Generator (`POST /api/ai/generate-brd`):**
- Loads the ticket from Oracle (server-authoritative, not client-supplied)
- Sends a structured system prompt + ticket data to Gemini
- Normalises the 6 BRD sections (Background, Objective, Scope, Functional Requirements, Acceptance Criteria, Risks & Dependencies)
- Handles key aliasing and value flattening from LLM output variations
- Writes an audit log entry recording provider, model, and timestamp
- Returns sections + metadata to the BRD editor

**Leadership Chat (`POST /api/ai/leadership-chat`):**
- Multi-turn conversational interface with full session history stored in Oracle
- Agentic tool-use loop (up to 4 iterations per turn)
- Available tools the AI can call:

| Tool | Description |
|---|---|
| `query_tickets` | Filter tickets by module, function, priority, status, compliance, date |
| `aggregate` | Group and aggregate by any dimension with count/sum/avg metrics |
| `top_tickets` | Rank tickets by composite score, cost savings, days open, or people affected |
| `module_performance` | Breach rates, savings, avg days open per SCM module |
| `poc_performance` | Workload and SLA metrics per POC owner |
| `compare_periods` | Period-over-period comparison of any metric |
| `submission_forecast` | Exponential smoothing forecast for next N weeks |

**Insights Cron (`GET /api/insights?cron=1`):**
- Scheduled nightly via `vercel.json` cron configuration
- Fetches full metrics bundle (module performance, POC performance, forecast)
- Prompts Gemini to generate up to 10 insight cards (category, title, body, impact score, recommended action)
- Supersedes previous insight run before inserting new cards
- Secured with `CRON_SECRET` bearer token

**Audit trail:** Every AI generation event is logged in `audit_log` with `action = 'AI BRD draft generated'`, `after_val = 'gemini:gemini-2.0-flash'`.

---

## 7. Security Architecture

| Control | Implementation |
|---|---|
| Password storage | bcrypt (cost factor 10) via `bcryptjs` |
| First-login enforcement | `must_change_password NUMBER(1)` flag; non-dismissible UI modal |
| User lifecycle | Admins can activate/deactivate; deactivated users cannot log in |
| Database transport | mTLS (mutual TLS) with Oracle wallet |
| Wallet storage | Base64 PEM split across 3 Vercel env vars; written to `/tmp` at runtime |
| API secrets | All keys in Vercel environment variables (never in source code) |
| Cron protection | `CRON_SECRET` bearer token required on cron endpoint |
| CORS | `handleOptions()` helper sets appropriate headers per request |

---

## 8. Infrastructure & DevOps

**Hosting:** Vercel (Hobby plan)
- Frontend: Static React build served from global CDN
- Backend: 11 serverless functions, 30s max duration configured for AI routes
- Cron: Nightly insights refresh via `vercel.json` schedule

**Database:** Oracle Cloud Always Free
- No cost for the database tier
- Managed backups, patching, and high availability handled by Oracle
- Region: `ap-hyderabad-1` (India)

**CI/CD:** Git-based deploy — push to branch triggers Vercel preview deploy; merge to main triggers production deploy.

**Environment variables required:**

| Variable | Purpose |
|---|---|
| `ORACLE_USER` | DB username (typically `ADMIN`) |
| `ORACLE_PASSWORD` | DB admin password |
| `ORACLE_CONNECT_STRING` | Full TNS connection string |
| `ORACLE_WALLET_PEM_1/2/3` | mTLS wallet PEM split in 3 parts |
| `ORACLE_WALLET_PASSWORD` | Wallet decryption password |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GEMINI_PRIMARY_MODEL` | Model name (default: `gemini-2.0-flash`) |
| `CRON_SECRET` | Bearer token for nightly cron job |
| `AI_PROVIDER_TIMEOUT_MS` | Per-request AI timeout (default: 8000ms) |

---

## 9. Key Design Decisions

**Why Vercel serverless?**
Zero infrastructure management. The app has bursty, low-volume traffic — serverless is cost-optimal. Vercel's Hobby plan covers the entire deployment at no cost.

**Why Oracle ADB Always Free?**
Persistent, production-grade relational database at zero cost. Oracle's Always Free tier never expires and includes managed backups and TLS security. The `oracledb` Thin Mode driver makes it compatible with serverless without any native dependencies.

**Why Gemini over other LLMs?**
1,500 free requests/day with no credit card required. Gemini 2.0 Flash has native tool-use (function calling) support needed for the agentic chat loop, and a large enough context window for full ticket data + BRD generation.

**Why bcryptjs (pure JS)?**
Vercel serverless functions cannot execute native binary modules. `bcryptjs` is a pure JavaScript bcrypt implementation that produces the same `$2a$` hash format as PostgreSQL's `pgcrypto`, ensuring compatibility.

**Why split the wallet PEM?**
Vercel limits each environment variable value to 4,096 characters. The `ewallet.pem` base64-encoded is ~9,464 characters. Splitting into three variables and concatenating at runtime is the only way to pass the full wallet without a secrets manager.

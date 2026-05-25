# SCM Intelligent Issue Portal — Application Flow & Gemini Cost Forecast

---

## 1. Application Flow Diagrams

### 1.1 Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React Frontend
    participant API as /api/users
    participant DB as Oracle ADB

    User->>UI: Enter email + password
    UI->>API: POST /api/users { action: login }
    API->>DB: SELECT * FROM app_users WHERE email = ?
    DB-->>API: User row (password_hash, must_change_password, is_active)
    API->>API: bcrypt.compare(password, hash)
    alt Invalid credentials
        API-->>UI: 401 Unauthorized
        UI-->>User: Show error message
    else is_active = 0
        API-->>UI: 403 Deactivated account
    else must_change_password = 1
        API-->>UI: 200 + mustChangePassword: true
        UI-->>User: Show SetPasswordModal (non-dismissible)
        User->>UI: Enter new password
        UI->>API: POST /api/users { action: change_password }
        API->>DB: UPDATE app_users SET password_hash, must_change_password = 0
        API-->>UI: 200 OK
        UI-->>User: Redirect to Dashboard
    else Normal login
        API-->>UI: 200 + user object
        UI-->>User: Redirect to Dashboard
    end
```

---

### 1.2 Ticket Creation Flow

```mermaid
sequenceDiagram
    actor Submitter
    participant UI as React Frontend
    participant API as /api/tickets (POST)
    participant Priority as priority.js
    participant DB as Oracle ADB

    Submitter->>UI: Fill ticket form and submit
    UI->>API: POST /api/tickets { module, title, description, impact... }

    API->>DB: SELECT id FROM tickets WHERE id LIKE 'SCM-MOD-%'
    DB-->>API: Existing ticket count (e.g. 3)
    API->>API: Generate ID → SCM-MOD-004

    API->>DB: SELECT * FROM tickets (all tickets for scoring)
    DB-->>API: Full ticket list

    API->>Priority: computeScoresAndTier(newTicket, allTickets)
    Priority-->>API: Priority tier (P0 / P1 / P2 / P3)

    API->>DB: INSERT INTO tickets (all fields including priority)
    API->>DB: INSERT INTO audit_log (action: 'Issue submitted')
    API->>DB: INSERT INTO audit_log (action: 'Auto-prioritisation')

    API->>DB: SELECT * FROM tickets WHERE id = 'SCM-MOD-004'
    DB-->>API: Newly created ticket row
    API-->>UI: 201 Created + ticket object
    UI-->>Submitter: Redirect to ticket detail page
```

---

### 1.3 BRD Generation Flow (AI)

```mermaid
sequenceDiagram
    actor CoE as CoE Lead
    participant UI as BRD Editor
    participant API as /api/ai/generate-brd
    participant DB as Oracle ADB
    participant Gemini as Google Gemini 2.0 Flash

    CoE->>UI: Click "Generate BRD"
    UI->>API: POST /api/ai/generate-brd { ticketId }

    API->>DB: SELECT * FROM tickets WHERE id = ticketId
    DB-->>API: Authoritative ticket row

    API->>API: Build system prompt + user prompt from ticket data
    API->>Gemini: Generate BRD (system + user prompt)
    Gemini-->>API: Raw JSON with 6 BRD sections

    API->>API: Normalise sections (key aliasing, flatten arrays/objects)
    API->>API: Validate all 6 sections have content

    API->>DB: INSERT INTO audit_log (AI BRD draft generated, provider, model)

    API-->>UI: 200 + { sections, meta: { provider, model, at } }
    UI-->>CoE: Populate BRD editor with 6 editable sections + audit pane
    CoE->>UI: Edit and save BRD
```

---

### 1.4 Leadership Chat Flow (AI with Tool Use)

```mermaid
sequenceDiagram
    actor Leader
    participant UI as Chat Panel
    participant API as /api/ai/leadership-chat
    participant DB as Oracle ADB
    participant Gemini as Google Gemini 2.0 Flash
    participant Tools as Tool Handlers

    Leader->>UI: Type a question (e.g. "Which module has most breaches?")
    UI->>API: POST /api/ai/leadership-chat { message, session_id? }

    alt New session
        API->>DB: INSERT INTO chat_sessions
    end
    API->>DB: INSERT INTO chat_messages (role: user)
    API->>DB: SELECT * FROM chat_messages WHERE session_id (load history)

    loop Up to 4 iterations
        API->>Gemini: Send [system + history + user message + tool schemas]
        Gemini-->>API: Response with tool_calls OR final text

        alt Tool calls requested
            API->>Tools: dispatch(tool_name, args)
            Tools->>DB: Execute query (tickets, aggregates, forecasts)
            DB-->>Tools: Results
            Tools-->>API: Tool result JSON
            API->>API: Append tool result to messages
        else Final text response
            API->>DB: INSERT INTO chat_messages (role: tool, tool trace)
            API->>DB: INSERT INTO chat_messages (role: assistant, content)
            API-->>UI: 200 + { reply, toolTrace, session_id }
            UI-->>Leader: Display AI response
        end
    end
```

---

### 1.5 Nightly Insights Cron Flow

```mermaid
sequenceDiagram
    participant Vercel as Vercel Cron Scheduler
    participant API as /api/insights?cron=1
    participant Metrics as metrics.js
    participant DB as Oracle ADB
    participant Gemini as Google Gemini 2.0 Flash

    Vercel->>API: GET /api/insights?cron=1 (nightly, Bearer CRON_SECRET)
    API->>API: Verify CRON_SECRET token

    API->>Metrics: insightsMetricBundle()
    Metrics->>DB: SELECT * FROM tickets (full table)
    DB-->>Metrics: All ticket rows
    Metrics-->>API: { grand totals, module performance, POC performance, forecast }

    API->>DB: SELECT * FROM insights WHERE superseded=0 (rejected patterns)
    DB-->>API: Previously rejected insight IDs

    API->>Gemini: Generate insights (metrics bundle + rejected list)
    Gemini-->>API: Up to 10 insight cards (title, body, category, impact_score, recommended_action)

    API->>DB: UPDATE insights SET superseded=1 WHERE superseded=0
    API->>DB: INSERT INTO insights (up to 10 new rows, generated_at = SYSTIMESTAMP)

    API-->>Vercel: 200 + { run_id, count, provider, model }
```

---

### 1.6 Full System Architecture Flow

```mermaid
graph TD
    User["👤 User (Browser)"]

    subgraph Vercel["Vercel Platform"]
        CDN["React SPA\n(Tailwind + shadcn/ui)"]
        subgraph API["Serverless Functions (11)"]
            AuthAPI["/api/users\nAuth & User Mgmt"]
            TicketAPI["/api/tickets\nTicket CRUD"]
            BRDAPI["/api/ai/generate-brd\nBRD Generation"]
            ChatAPI["/api/ai/leadership-chat\nAI Chat"]
            InsightsAPI["/api/insights\nAI Insights + Cron"]
            OtherAPI["/api/audit\n/api/comments\n/api/notifications\n/api/test-evidence"]
        end
        Cron["Vercel Cron\n(Nightly Schedule)"]
    end

    subgraph Oracle["Oracle Cloud (ap-hyderabad-1)"]
        ADB["Autonomous Database\n(Always Free ATP)\n10 Tables"]
    end

    subgraph Google["Google AI"]
        Gemini["Gemini 2.0 Flash\nBRD + Chat + Insights"]
    end

    User --> CDN
    CDN --> AuthAPI
    CDN --> TicketAPI
    CDN --> BRDAPI
    CDN --> ChatAPI
    CDN --> InsightsAPI
    CDN --> OtherAPI
    Cron --> InsightsAPI

    AuthAPI --> ADB
    TicketAPI --> ADB
    OtherAPI --> ADB
    BRDAPI --> ADB
    BRDAPI --> Gemini
    ChatAPI --> ADB
    ChatAPI --> Gemini
    InsightsAPI --> ADB
    InsightsAPI --> Gemini
```

---

## 2. Gemini API Cost Forecast

### 2.1 Gemini 2.0 Flash Pricing (as of 2025)

| Tier | Input tokens | Output tokens |
|---|---|---|
| **Free tier** | 1,500 requests/day, 15 req/min | 1,500 requests/day |
| **Paid (≤128K context)** | $0.075 per 1M tokens | $0.30 per 1M tokens |
| **Paid (>128K context)** | $0.15 per 1M tokens | $0.60 per 1M tokens |

> All SCM portal requests stay well within 128K context.

---

### 2.2 Token Estimate Per Feature

#### BRD Generation (per ticket)

| Component | Tokens |
|---|---|
| System prompt | ~450 |
| Ticket data (title, desc, impact, SLA) | ~400 |
| **Total input** | **~850** |
| 6 BRD sections output | ~1,000 |
| **Total output** | **~1,000** |
| **Total per call** | **~1,850 tokens** |

**Cost per BRD:** `(850 × $0.075 + 1,000 × $0.30) / 1,000,000 = $0.000364`

---

#### Leadership Chat (per conversation turn)

| Component | Tokens |
|---|---|
| System prompt | ~800 |
| Conversation history (avg 3 prior turns) | ~1,500 |
| User message | ~100 |
| Tool results (1–2 tool calls) | ~1,000 |
| **Total input** | **~3,400** |
| AI response | ~500 |
| **Total output** | **~500** |
| **Total per turn** | **~3,900 tokens** |

**Cost per chat turn:** `(3,400 × $0.075 + 500 × $0.30) / 1,000,000 = $0.000405`

---

#### Nightly Insights (per cron run)

| Component | Tokens |
|---|---|
| System prompt | ~600 |
| Metrics bundle (all tickets summarised) | ~4,000 |
| Rejected patterns context | ~300 |
| **Total input** | **~4,900** |
| 10 insight cards output | ~2,500 |
| **Total output** | **~2,500** |
| **Total per run** | **~7,400 tokens** |

**Cost per nightly run:** `(4,900 × $0.075 + 2,500 × $0.30) / 1,000,000 = $0.001118`

---

### 2.3 Monthly Cost Scenarios

#### Small Team (5–10 users, pilot phase)

| Activity | Volume/month | Cost |
|---|---|---|
| BRD generations | 20 BRDs | $0.007 |
| Leadership chat turns | 100 turns | $0.041 |
| Nightly insights | 30 runs | $0.034 |
| **Total** | | **$0.08/month** |

> Entirely within free tier (1,500 req/day). **Effective cost: $0.00**

---

#### Medium Team (20–50 users, active use)

| Activity | Volume/month | Cost |
|---|---|---|
| BRD generations | 150 BRDs | $0.055 |
| Leadership chat turns | 500 turns | $0.203 |
| Nightly insights | 30 runs | $0.034 |
| **Total** | | **$0.29/month** |

> Still well within free tier limits. **Effective cost: $0.00**

---

#### Large Team (100+ users, heavy use)

| Activity | Volume/month | Cost |
|---|---|---|
| BRD generations | 500 BRDs | $0.182 |
| Leadership chat turns | 3,000 turns | $1.215 |
| Nightly insights | 30 runs | $0.034 |
| **Total (paid tier)** | | **~$1.43/month** |

> Exceeds free tier only at high volume. Even then, under $2/month.

---

### 2.4 Free Tier Headroom

The Gemini free tier allows **1,500 requests/day**. Here's how many operations that covers:

| Feature | Requests used | Daily free allowance | Days to hit limit |
|---|---|---|---|
| BRD generation | 1 req/BRD | 1,500 | Need 1,500 BRDs/day |
| Chat turns | 1 req/turn | 1,500 | Need 1,500 turns/day |
| Nightly insights | 1 req/night | 1,500 | 1,499 remaining after cron |

**Conclusion:** The free tier comfortably covers any realistic usage for a single-organisation SCM portal. Paid costs only kick in at enterprise scale, and even then remain under $5/month.

---

### 2.5 Cost Optimisation Options (if needed at scale)

| Option | Saving |
|---|---|
| Cache BRD prompts for identical tickets | Eliminates repeat calls |
| Truncate chat history to last 5 turns | Reduces input tokens ~40% |
| Run insights every 3 days instead of nightly | Saves 20 req/month (negligible) |
| Use `gemini-2.0-flash-lite` for chat | ~50% cheaper, slightly lower quality |
| Batch multiple tool results in one turn | Fewer API calls per chat session |

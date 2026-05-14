# Airtel SCM Issue Intelligence & Workflow Management Portal — PRD

## Original problem statement
"Build only front end for now. You can ignore the AI developments for now. Just build the front end."

Source documents (BRD + process flow + framework + issue intelligence templates) uploaded by the user.

## Architecture (current)
- **Frontend only** — React (CRA) + react-router-dom + shadcn/ui + Tailwind + Recharts + lucide-react + sonner.
- **Auth**: mock, localStorage-based (`airtel_scm_auth_user`). 5 demo users covering all roles.
- **Data**: static mock data in `/app/frontend/src/data/mockData.js` (10 tickets, 5 notifications, 1 BRD with sections+versions, 5 POC tasks).
- **No backend yet** — backend / AI engine deferred per user request.
- Theme: Airtel red (`#E40000`) + white, fonts Manrope (display) + IBM Plex Sans (body).

## User personas / roles
- **Submitter** — logs issues, validates resolutions on their own tickets.
- **COE Admin** — triage, priority overrides, assignment, BRD review, SLA governance.
- **POC Owner** — works assigned tickets, drives the in-progress sub-workflow.
- **Leadership** — executive KPIs, savings, SLA compliance, trends.
- **System Admin** — taxonomy, workflows, users/roles, master settings.

## Core requirements (static — from BRD)
- Centralised single source of truth for all SCM issues.
- 14 named screens (Login, Home Dashboard, Issue Submission, Similar Issue Popup, Ticket Details, COE Workbench, POC Task View, BRD Editor, SLA Monitor, Validation Screen, Leadership Dashboard, Admin Console, Notification Center, Reports).
- Ticket lifecycle: Submitted → Triage → Assigned → In Progress → Pending Validation → Closed (with Reopen path).
- Priorities P0–P3, SLA states on-track / at-risk / breached.
- Ticket ID format `SCM-YYYY-MM-000001`.
- Categories: Process Gap, Bug, Compliance Risk, Automation Opportunity, Dashboard/Report, New Development.

## What's been implemented (2025-12-13)
- All 14 BRD screens with kebab-case `data-testid` attributes throughout.
- Mock auth (form + 5 one-click demo cards), header role-switcher, logout.
- Role-aware sidebar navigation.
- Home Dashboard: KPI cards, recent tickets, notifications, AI assist callout.
- Issue Submission: 4-step wizard (Basic Info → Impact → Details → Review) + Similar Issues dialog.
- Ticket Details: description, comments tab, audit trail tab, BRD tab, linked tickets sidebar.
- COE Workbench: triage queue table with priority/assign select dropdowns + filters.
- POC Task View: 4-column kanban with stage advancement.
- BRD Editor: editable section textareas, version history sidebar, approve / request changes.
- SLA Monitor: 4 stat cards + 4 filter tabs + progress bars per ticket.
- Validation Screen: accept / reject with feedback.
- Leadership Dashboard: 4 KPIs + bar / line / pie Recharts visualisations.
- Admin Console: 4 tabs (Taxonomy, Workflows, Users & Roles, System Settings).
- Notification Center: 5 alerts with type-colored icons + mark-all-read.
- Reports: 3 filters + search + Export CSV toast.

Tested end-to-end via the testing agent (iteration_1.json) — 100% pass, no console errors.

## Prioritized backlog (deferred)
**P0 — Foundations**
- FastAPI backend + MongoDB models for users, tickets, notifications, BRDs, audit log.
- Auth (JWT or Emergent Google Auth) replacing localStorage mock.
- Persist issue submission flow to backend with real ticket ID generation.

**P1 — AI features (per BRD)**
- AI deduplication engine (semantic + fuzzy matching).
- Auto-prioritization (impact score → P0–P3).
- Auto-BRD draft generation by category template.
- AI form-assist on issue submission.

**P2 — Workflow & governance**
- Real SLA timers with cron-driven escalation.
- Configurable workflows per category in Admin Console.
- Email + Teams notification engine.
- Audit log persistence + queryable history.

**P3 — Integrations & polish**
- Jira placeholder fields → real Jira integration.
- BI tool embed (Grafana / Metabase) for leadership dashboards.
- Bulk import, file attachments, CSV/PDF export pipelines.
- Mobile-responsive optimisations + offline PWA for warehouse.

## Next tasks (when user resumes)
1. Decide auth strategy (Emergent Google Auth vs JWT) for backend rollout.
2. Build FastAPI backend + MongoDB schema mirroring `mockData.js` structures.
3. Wire frontend pages to real APIs, replace `mockData.js` with API calls.
4. Plan AI deduplication / BRD drafting integration (likely via Emergent Universal Key).

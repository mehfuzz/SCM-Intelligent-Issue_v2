# SCM Issue Intelligence & Workflow Portal

Airtel SCM Center of Excellence — single-pane portal for issue capture,
auto-prioritisation, COE triage, POC delivery, validation, and leadership
reporting. Built to mirror the framework defined in
`docs/SCM_Issue_Intelligence_Framework.xlsx`.

## Architecture

```
/
├── api/                       # Vercel serverless functions (Node 20)
│   ├── _lib/                  # supabase client, http helpers, mappers, priority calc
│   ├── auth/login.js
│   ├── tickets/index.js       # GET list, POST create
│   ├── tickets/[id].js        # GET one, PATCH (auto-audited), DELETE
│   ├── audit.js
│   ├── comments.js
│   ├── notifications.js
│   ├── test-evidence.js
│   ├── users.js
│   └── health.js
├── supabase/
│   ├── migrations/0001_init.sql   # Schema + enums + RLS-enabled tables
│   └── seed.sql                   # Framework Issue-Log sample rows
├── frontend/                  # Create React App (the SPA)
│   ├── src/lib/api.js         # fetch wrapper around /api/*
│   ├── src/lib/hydrate.js     # boot-time data hydration into in-memory store
│   └── src/...                # pages, components, context
├── vercel.json
└── package.json               # root deps for serverless functions
```

* **Frontend**: React + Tailwind + Radix UI + Recharts (CRA / craco)
* **Backend**: Vercel serverless functions (Node 20) using `@supabase/supabase-js`
* **Database**: Supabase Postgres
* **Auth**: Mock login against `app_users` (cleartext passwords for demo
  parity). Swap for Supabase Auth + JWT before any real deployment.

## Prioritisation engine

Per the framework's `Prioritisation Parameters` sheet:

* People Affected, Time Lost, Cost Saving → PERCENTRANK on 0–100 across all
  active issues.
* Frequency → base score (Daily 100, Weekly 75, Monthly 40, Ad-hoc 15), then
  percentile-ranked.
* Composite = average of the four (equal 25 % weights).
* Tier:
  * `Compliance Risk = Yes` → **P0** (overrides composite).
  * `Composite ≥ 70` → **P1 (Critical)**
  * `Composite ≥ 40` → **P2 (High)**
  * Otherwise → **P3 (Standard)**
* Linear ranking: P0 tickets sorted by composite asc (matches Excel demo),
  then everyone else by composite desc.

The same calculation is implemented in two places that stay in sync:

* `api/_lib/priority.js` — server-side, applied on ticket create.
* `frontend/src/data/mockData.js` — client-side, used by COE / POC / Leadership
  views and CSV export.

## Per-role UX

| Role          | What they see                                                                                        |
|---------------|------------------------------------------------------------------------------------------------------|
| Submitter     | Home with own tickets + search; capture form (Modules/Functions per framework, Compliance Yes/No, no Subcategory); Validation tab with POC-attached test screenshots/links; Reports scoped to their own submissions (Priority/SLA hidden). |
| COE Admin     | Workbench with all tickets, Excel-style Issue Log tab, audit-trail tab; inline edit of Priority / Status / Assignee; linear ranking; CSV export. |
| POC Owner    | Excel-view of assigned issues; inline Status & COE-effort edits; SLA change requires a justification comment (audit-logged); BRD Editor. |
| Leadership   | KPI cards + chart bars are double-click drill-downs; Per-POC report; full Issue Log; richer charts; full-log CSV export. |

## Local development

```bash
# Install root deps (for the @supabase/supabase-js used by serverless fns)
npm install

# Install + start the SPA
cd frontend
npm install --legacy-peer-deps
npm start
```

The SPA boots, calls `/api/health`, and:

* If the API is reachable **and** Supabase env vars are set → it hydrates
  `MOCK_TICKETS` / `MOCK_USERS` from the live API.
* Otherwise → it stays on the bundled mock data so the UI is fully usable
  offline.

To run the API locally with hot reload, use the Vercel CLI:

```bash
npm i -g vercel
vercel link            # one-time
vercel env pull        # pull Supabase env vars into .env.local
vercel dev             # runs SPA + /api/* together at http://localhost:3000
```

## Deploying to Vercel

1. Create a Supabase project, then open the SQL Editor and run **one of**:
   * **Quickest** — paste & run `supabase/init.sql` (this concatenates
     the migration + seed in the correct order).
   * Or run them separately, in this order:
     ```
     supabase/migrations/0001_init.sql      -- schema first
     supabase/seed.sql                      -- data second
     ```
   The migration must run before the seed; otherwise you'll see
   `ERROR: relation "app_users" does not exist`.
2. In Vercel, import this repo. Vercel auto-detects the `vercel.json` build
   spec (`npm install && cd frontend && npm install --legacy-peer-deps && npm run build`).
3. Add the following **Environment Variables** in Vercel project settings:
   * `SUPABASE_URL` — `https://<project-ref>.supabase.co`
   * `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only).
   * (Optional) `REACT_APP_API_BASE` — leave unset to use the default `/api`.
4. Deploy. The SPA is served from `frontend/build`; `/api/*` paths route to
   the serverless functions automatically.

## Troubleshooting

### "Data isn't being saved — refreshing wipes everything"

The SPA is running in **demo mode** (using bundled mock data instead of
Supabase). Edits live in React state only and disappear on reload. The
yellow banner at the top of the page should tell you why; you can also
hit `/api/health` directly for full diagnostic output, e.g.

```json
{
  "ok": true,
  "supabaseConfigured": false,
  "missingEnvVars": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  "dbReachable": false,
  "userCount": null,
  "schemaApplied": false,
  "hint": "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel project settings, then redeploy."
}
```

Common causes & fixes:

| `/api/health` says…                                            | What to do                                                                 |
|----------------------------------------------------------------|----------------------------------------------------------------------------|
| `missingEnvVars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]`| Add both env vars in **Vercel → Project Settings → Environment Variables**, then **Redeploy** (env-var changes don't auto-redeploy). |
| `dbReachable: false, dbError: "..."` | Wrong URL/key, or the Supabase project is paused. Double-check the values from **Supabase → Project Settings → API**. |
| `userCount: 0, schemaApplied: false` | Schema hasn't been loaded. Open the **Supabase SQL Editor** and run `supabase/init.sql`. |
| `dbReachable: true, userCount > 0`   | Backend is healthy — the banner should be gone. If it isn't, hard-reload the page. |

### Vars are set but writes still don't stick

1. Check the browser DevTools **Network** tab. POST/PATCH calls to
   `/api/tickets`, `/api/audit`, etc. should return 200/201. If they
   return 500, the response body will say why (usually an RLS / type /
   FK error).
2. Make sure you used the **service role** key, not the anon key — the
   server-side functions bypass RLS via the service role. The anon key
   will hit RLS and be silently denied on every write.

### Demo credentials

| Role       | Email                       | Password |
|------------|-----------------------------|----------|
| Submitter  | ravi.kumar@airtel.in        | demo123  |
| COE Admin  | priya.sharma@airtel.in      | demo123  |
| POC Owner  | amit.singh@airtel.in        | demo123  |
| Leadership | neeta.rao@airtel.in         | demo123  |
| Sys Admin  | admin@airtel.in             | demo123  |

## Tests / report artefacts

Pytest stubs and prior test reports live in `tests/` and `test_reports/` and
have been preserved from the original framework drop; they were not part of
this iteration's frontend / backend changes.

-- One-shot bootstrap for a fresh Supabase project.
-- Equivalent to running supabase/migrations/0001_init.sql then
-- supabase/seed.sql in sequence. Paste & run in the Supabase SQL Editor.

-- SCM Issue Intelligence — initial schema
-- Mirrors the framework's Issue Log + Prioritisation Parameters sheets.
--
-- Run this BEFORE seed.sql. If you prefer a single paste, use
-- supabase/init.sql which concatenates both.

-- pgcrypto is required for gen_random_uuid(). Supabase ships it but the
-- function lives in the `extensions` schema; this guarantees it is loadable.
create extension if not exists pgcrypto;

-- ============================================================================
-- Enum types
-- ============================================================================
create type ticket_status as enum (
  'Submitted','Triaged','POC Assigned','In Progress','Pending Validation','Closed','Reopened'
);

create type ticket_priority as enum ('P0','P1','P2','P3');

create type compliance_flag as enum ('Yes','No');

create type frequency_band as enum ('Daily','Weekly','Monthly','Ad-hoc');

create type sla_state as enum ('on-track','at-risk','breached');

create type user_role as enum ('Submitter','COE Admin','POC Owner','Leadership','System Admin');

-- ============================================================================
-- Users (mock login — no Supabase Auth, kept as a plain table)
-- ============================================================================
create table app_users (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  password        text not null,            -- plain for mock parity; do not use in production
  role            user_role not null,
  department      text,
  avatar_initials text,
  created_at      timestamptz default now()
);

-- ============================================================================
-- Tickets
-- ============================================================================
create table tickets (
  id                    text primary key,
  title                 text not null,
  module                text not null,
  sub_process           text,
  function              text,
  category              text,
  description           text,
  submitted_by          text,
  submitted_by_id       text references app_users(id) on delete set null,
  submitted_at          timestamptz default now(),
  assigned_to           text,
  assigned_to_id        text references app_users(id) on delete set null,
  status                ticket_status default 'Submitted',
  priority              ticket_priority default 'P3',
  -- Impact / scoring inputs (from Capture Form Fields)
  people_affected       numeric default 0,
  frequency             frequency_band default 'Weekly',
  hours_lost_per_week   numeric default 0,
  cost_savings          numeric default 0,
  compliance_risk       compliance_flag default 'No',
  -- SLA tracking
  sla_response_hours    numeric default 24,
  sla_resolution_hours  numeric default 168,
  sla_elapsed_hours     numeric default 0,
  sla_state             sla_state default 'on-track',
  sla_days_open         integer default 0,
  -- POC fields
  coe_effort_days       numeric default 0,
  suggested_solution    text,
  supporting_evidence   text,
  notes                 text,
  -- Linkage
  related_ticket_id     text,
  parent_id             text,
  -- Metadata
  brd_id                text,
  brd_status            text,
  tags                  text[],
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index tickets_assigned_to_idx on tickets(assigned_to_id);
create index tickets_submitted_by_idx on tickets(submitted_by_id);
create index tickets_status_idx on tickets(status);
create index tickets_priority_idx on tickets(priority);

-- ============================================================================
-- Audit trail
-- ============================================================================
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   text references tickets(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    text references app_users(id) on delete set null,
  actor_name  text not null,
  action      text not null,
  field       text,
  before_val  text,
  after_val   text,
  note        text
);

create index audit_log_ticket_idx on audit_log(ticket_id, at desc);

-- ============================================================================
-- Comments
-- ============================================================================
create table comments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   text not null references tickets(id) on delete cascade,
  author_id   text references app_users(id) on delete set null,
  author      text not null,
  author_role text,
  body        text not null,
  at          timestamptz not null default now()
);

create index comments_ticket_idx on comments(ticket_id, at desc);

-- ============================================================================
-- Test evidence (screenshots/links for submitter validation)
-- ============================================================================
create table test_evidence (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   text not null references tickets(id) on delete cascade,
  label       text not null,
  url         text not null,
  uploaded_by text,
  at          timestamptz not null default now()
);

create index test_evidence_ticket_idx on test_evidence(ticket_id);

-- ============================================================================
-- Notifications
-- ============================================================================
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references app_users(id) on delete cascade,
  type        text not null,
  title       text not null,
  message     text,
  ticket_id   text,
  at          timestamptz default now(),
  read        boolean default false
);

create index notifications_user_idx on notifications(user_id, at desc);

-- ============================================================================
-- BRDs
-- ============================================================================
create table brds (
  id          text primary key,
  ticket_id   text references tickets(id) on delete set null,
  title       text not null,
  status      text default 'Draft',
  version     text default 'v1.0',
  sections    jsonb default '{}'::jsonb,
  versions    jsonb default '[]'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================================
-- Updated-at trigger
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tickets_set_updated_at before update on tickets
  for each row execute function set_updated_at();

create trigger brds_set_updated_at before update on brds
  for each row execute function set_updated_at();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
-- The serverless layer authenticates with the service role key, which bypasses
-- RLS. We still enable RLS so any anon/authenticated client (if added later)
-- gets a deny-by-default posture; explicit policies can be added when real
-- auth is introduced.
alter table app_users      enable row level security;
alter table tickets        enable row level security;
alter table audit_log      enable row level security;
alter table comments       enable row level security;
alter table test_evidence  enable row level security;
alter table notifications  enable row level security;
alter table brds           enable row level security;

-- ============================================================================
-- Seed data
-- ============================================================================

-- Seed data — mirrors frontend/src/data/mockData.js so a fresh Supabase
-- project boots with the framework's sample Issue Log already loaded.

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------
insert into app_users (id, name, email, password, role, department, avatar_initials) values
  ('u1','Ravi Kumar',      'ravi.kumar@airtel.in',   'demo123','Submitter',    'SCM Operations',           'RK'),
  ('u2','Priya Sharma',    'priya.sharma@airtel.in', 'demo123','COE Admin',    'SCM Center of Excellence', 'PS'),
  ('u3','Amit Singh',      'amit.singh@airtel.in',   'demo123','POC Owner',    'Procurement Tech',         'AS'),
  ('u4','Neeta Rao',       'neeta.rao@airtel.in',    'demo123','Leadership',   'SCM Leadership',           'NR'),
  ('u5','System Admin',    'admin@airtel.in',        'demo123','System Admin', 'IT Platform',              'SA'),
  ('u6','Kushal Soni',     'kushal.soni@airtel.in',  'demo123','POC Owner',    'SCM CoE',                  'KS'),
  ('u7','Shikha Aggarwal', 'shikha@airtel.in',       'demo123','POC Owner',    'SCM CoE',                  'SA'),
  ('u8','Rajesh Kansal',   'rajesh.kansal@airtel.in','demo123','Submitter',    'Infra Procurement',        'RK'),
  ('u9','Akram Raza',      'akram.raza@airtel.in',   'demo123','Submitter',    'Material Management',      'AR')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Tickets — Issue Log sample rows from the framework
-- ----------------------------------------------------------------------------
insert into tickets (
  id, title, module, sub_process, function, category, description,
  submitted_by, submitted_by_id, submitted_at,
  assigned_to, assigned_to_id, status, priority,
  people_affected, frequency, hours_lost_per_week, cost_savings, compliance_risk,
  sla_response_hours, sla_resolution_hours, sla_elapsed_hours, sla_state, sla_days_open,
  coe_effort_days, suggested_solution, supporting_evidence, notes, brd_status, brd_id, tags
) values
  ('SCM-SOW-001','Manual / Avoidable Step','SOW','SOW Review & Approval','Material Management','Process Issues',
   'Manual SOW validation causes 3–5 day delays before vendor onboarding can begin.',
   'Akram Raza','u9','2026-04-10 09:00+00','Kushal Soni','u6','In Progress','P1',
   4,'Daily',18,150000,'No',
   8,72,96,'breached',33,
   12,'Auto-route SOW to predefined validator pool with rule-based pre-checks.',
   'https://airtel.sharepoint.com/scm/sow-delay-evidence.pdf','','Pending',null,
   array['sow','manual']),

  ('SCM-VND-002','Handoff Failure','Vendor Onboarding','Vendor Verification','Infra','Process Issues',
   'Vendor verification done via email chains with no tracking or acknowledgement.',
   'Rajesh Kansal','u8','2026-04-12 09:00+00','Shikha Aggarwal','u7','Triaged','P2',
   3,'Daily',22,50000,'No',
   24,168,92,'on-track',31,
   8,'Move verification to portal with status tracking and acknowledgements.',
   '','','Pending',null,
   array['vendor','handoff']),

  ('SCM-GBP-003','Approval Bottleneck','GBPA','Approval Workflow','Network','Process Issues',
   'Single approver for all GBPA requests above threshold; 3–7 day queue building up.',
   'Varun Mehta','u8','2026-04-14 09:00+00','Rajesh Kansal','u8','POC Assigned','P2',
   3.5,'Daily',15,25000,'No',
   24,168,80,'on-track',29,
   5,'Tier-based approval matrix with parallel routing.',
   '','','Pending',null,
   array['gbpa','approval']),

  ('SCM-PO-004','Financial Leakage — PO/GRN Mismatch','PO','GRN Matching','ToCo','Compliance & Risk',
   'PO-GRN mismatch resulting in potential duplicate payments — 4 confirmed cases in Q1.',
   'Shikha Aggarwal','u7','2026-04-15 09:00+00','Varun Mehta','u3','In Progress','P0',
   6,'Weekly',8,80000,'Yes',
   4,48,60,'on-track',28,
   10,'Enforce 3-way match in ERP and block duplicate payment runs.',
   'audit-finding-Q1.xlsx','Auto P0 — compliance override','Approved','BRD-004',
   array['po','grn','compliance']),

  ('SCM-NFA-005','Unclear Process Design — NFA Turnaround','NFA','NFA Submission','DTH','Process Issues',
   'NFA turnaround exceeds 7 days; no SLA defined; different verticals using different steps.',
   'Akram Raza','u9','2026-04-16 09:00+00',null,null,'Submitted','P2',
   2.5,'Weekly',12,300000,'No',
   24,168,32,'on-track',27,
   6,'Standardised NFA template + SLA-driven workflow.',
   '','','Pending',null,
   array['nfa','sla']),

  ('SCM-ORC-006','Oracle MOAC Report Bug','PO','MOAC Report','Material Management','System & Tool Issues',
   'MOAC Oracle report not auto-refreshing for cost centre 4502; manual refresh takes 45 min/day.',
   'Gaurav Khanna','u9','2026-04-18 09:00+00','Gaurav Khanna','u3','In Progress','P3',
   0.75,'Daily',6,30000,'No',
   24,120,60,'on-track',25,
   3,'Add scheduled refresh job for impacted cost centres.',
   '','','In Review','BRD-006',
   array['oracle','report']),

  ('SCM-CON-007','Inaccurate Contract Values in i360','Contract','Contract Amendment','Infra','Data & Reporting',
   'i360 showing pre-amendment contract values; 8 contracts affected; causing reconciliation errors.',
   'Rajesh Kansal','u8','2026-04-20 09:00+00','Shikha Aggarwal','u7','Triaged','P3',
   2,'Weekly',10,10000,'No',
   24,168,45,'on-track',23,
   4,'Bi-directional sync between contract repo and i360.',
   '','','Pending',null,
   array['contract','reporting']),

  ('SCM-SRC-008','Knowledge Gap — Vendor Shortlisting','Sourcing','Vendor Shortlisting','Network','People & Knowledge',
   'No documented process for vendor shortlisting criteria; different buyers applying different rules.',
   'Akram Raza','u9','2026-04-22 09:00+00',null,null,'Submitted','P3',
   1.5,'Weekly',8,75000,'No',
   24,168,30,'on-track',21,
   5,'Document & circulate a shortlisting scorecard; quarterly refresh.',
   '','','Pending',null,
   array['sourcing','sop']),

  ('SCM-PR-009','Oracle ↔ i360 PR Sync Gap','PR','PR Approval','Material Management','System & Tool Issues',
   'Oracle PR approvals not syncing to i360 dashboard; manual update required every morning.',
   'Varun Mehta','u3','2026-04-24 09:00+00','Rajesh Kansal','u8','POC Assigned','P2',
   1,'Daily',14,120000,'No',
   24,120,50,'on-track',19,
   7,'Event-driven push from Oracle to i360 on approval.',
   '','','Pending',null,
   array['oracle','i360']),

  ('SCM-SLA-010','Contractual SLA Breach — Vendor','Contract','Vendor SLA Tracking','Network','Compliance & Risk',
   'Vendor SLA breached on 3 active contracts; penalty clauses live; not flagged anywhere in system.',
   'Shikha Aggarwal','u7','2026-04-26 09:00+00','Kushal Soni','u6','In Progress','P0',
   2,'Daily',5,200000,'Yes',
   4,48,28,'on-track',17,
   6,'SLA monitor with proactive alerts & penalty accrual ledger.',
   '','Auto P0 — penalty accruing','In Review','BRD-010',
   array['sla','compliance']),

  ('SCM-VND-011','Vendor Master Cleanup','Master Data','Vendor Records','COE','Data & Reporting',
   'Cleansed 1,200 duplicate vendor records; introduced dedup rules.',
   'Ravi Kumar','u1','2026-03-02 09:00+00','Amit Singh','u3','Pending Validation','P3',
   2,'Weekly',4,240000,'No',
   24,168,120,'on-track',14,
   3,'Dedup logic now live; ready for submitter validation.',
   '','','Approved','BRD-011',
   array['vendor','master-data']),

  ('SCM-PO-012','ASN Auto-Notification','Downstream','ASN Tracking','Service','System & Tool Issues',
   'ASN delay alerts now auto-fire after 24h slip.',
   'Ravi Kumar','u1','2026-02-10 11:20+00','Amit Singh','u3','Closed','P3',
   1,'Weekly',6,240000,'No',
   24,120,96,'on-track',6,
   3,'Scheduled job scans ASN table and posts Teams alerts.',
   '','','Approved','BRD-012',
   array['asn','notification'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Test evidence for the closed Vendor Master Cleanup ticket
-- ----------------------------------------------------------------------------
insert into test_evidence (ticket_id, label, url, uploaded_by) values
  ('SCM-VND-011','Dedup before/after screenshot','https://airtel.sharepoint.com/scm/dedup-screenshot.png','Amit Singh'),
  ('SCM-VND-011','UAT environment link',         'https://uat.scm.airtel.in/vendor-master',            'Amit Singh');

-- ----------------------------------------------------------------------------
-- Comments + Audit log samples
-- ----------------------------------------------------------------------------
insert into comments (ticket_id, author_id, author, author_role, body, at) values
  ('SCM-SOW-001','u2','Priya Sharma','COE Admin','Confirmed SLA breach; escalating to POC Owner.','2026-04-12 11:30+00'),
  ('SCM-SOW-001','u6','Kushal Soni','POC Owner','Drafted workflow change. Will share BRD by EOD.', '2026-04-15 17:45+00'),
  ('SCM-PO-004', 'u2','Priya Sharma','COE Admin','P0 by compliance override — duplicate payment risk.','2026-04-16 09:00+00');

insert into audit_log (ticket_id, at, actor_id, actor_name, action, field, before_val, after_val) values
  ('SCM-SOW-001','2026-04-10 09:00+00','u9','Akram Raza',  'Issue submitted',     null,            null,           null),
  ('SCM-SOW-001','2026-04-10 09:01+00',null,'System',      'Auto-prioritisation', 'Priority',      null,           'P1'),
  ('SCM-SOW-001','2026-04-11 10:15+00','u2','Priya Sharma','Status change',       'Status',        'Submitted',    'Triaged'),
  ('SCM-SOW-001','2026-04-12 11:32+00','u2','Priya Sharma','Assigned POC',        'Assigned To',   '—',            'Kushal Soni'),
  ('SCM-SOW-001','2026-04-13 09:00+00','u6','Kushal Soni', 'Status change',       'Status',        'POC Assigned', 'In Progress'),
  ('SCM-PO-004', '2026-04-15 09:00+00','u7','Shikha Aggarwal','Issue submitted',  null,            null,           null),
  ('SCM-PO-004', '2026-04-15 09:01+00',null,'System',      'Priority Zero Override','Priority',    null,           'P0');

-- ----------------------------------------------------------------------------
-- Notifications + BRD sample
-- ----------------------------------------------------------------------------
insert into notifications (user_id, type, title, message, ticket_id, at, read) values
  ('u9','sla_breach', 'SLA Breached',      'SCM-SOW-001 has breached resolution SLA','SCM-SOW-001','2026-04-13 09:00+00',false),
  ('u8','assignment', 'New Assignment',    'SCM-PR-009 has been assigned to you',     'SCM-PR-009', '2026-04-24 09:35+00',false),
  ('u9','comment',    'New Comment',       'Kushal Soni commented on SCM-SOW-001',    'SCM-SOW-001','2026-04-15 17:45+00',true),
  ('u1','validation', 'Validation Needed', 'SCM-VND-011 is ready for your validation','SCM-VND-011','2026-04-25 14:00+00',false),
  ('u8','sla_at_risk','SLA At Risk',       'SCM-VND-002 is approaching resolution SLA','SCM-VND-002','2026-04-26 08:00+00',false);

insert into brds (id, ticket_id, title, status, version, sections, versions) values
  ('BRD-004','SCM-PO-004','BRD — PO/GRN 3-way Match Enforcement','Approved','v1.1',
   jsonb_build_object(
     'Background','Four confirmed duplicate-payment cases traced to PO/GRN mismatches in Q1.',
     'Objective','Eliminate duplicate payments via enforced 3-way match in ERP.',
     'Scope','PO module — Invoice matching only.',
     'Functional Requirements','1. Block invoice payment if PO/GRN/Invoice qty/value mismatch.\n2. Daily exception report to AP.\n3. Audit log for every override.',
     'Acceptance Criteria','• Zero duplicate payments in 30-day window.\n• 100% exception coverage in daily report.',
     'Risks & Dependencies','Oracle EBS patch level; finance team training.'
   ),
   jsonb_build_array(
     jsonb_build_object('v','v1.0','at','2026-04-16T09:00:00Z','by','AI Draft'),
     jsonb_build_object('v','v1.1','at','2026-04-17T11:20:00Z','by','Varun Mehta')
   ));

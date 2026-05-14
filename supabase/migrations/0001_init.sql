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

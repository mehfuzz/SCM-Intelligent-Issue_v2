-- Insights + leadership-chat tables. Idempotent — safe to re-run.

-- ============================================================================
-- 1) AI-generated insights (Feature 1)
-- ============================================================================
create table if not exists insights (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null,                  -- one cron run produces N rows
  generated_at      timestamptz not null default now(),
  category          text not null,                   -- 'hotspot' | 'cost' | 'bottleneck' | 'quality' | 'load' | 'forecast'
  title             text not null,
  body              text not null,                   -- narrative
  supporting_numbers jsonb default '[]'::jsonb,      -- [{label,value}, ...]
  root_cause        text,
  recommended_action text,
  projected_impact_inr numeric,                      -- nullable
  cited_ticket_ids  text[] default array[]::text[],
  -- Score the LLM gave us 1-100 for "actionability"; used to sort the panel
  impact_score      numeric default 50,
  -- "stale" once a newer run exists for the same category, but we keep
  -- history so feedback can be analysed over time.
  superseded        boolean default false
);
create index if not exists insights_run_idx        on insights(run_id);
create index if not exists insights_generated_idx  on insights(generated_at desc);
create index if not exists insights_superseded_idx on insights(superseded);

create table if not exists insight_feedback (
  id          uuid primary key default gen_random_uuid(),
  insight_id  uuid not null references insights(id) on delete cascade,
  user_id     text references app_users(id) on delete set null,
  vote        smallint not null check (vote in (-1, 1)),  -- 👎 / 👍
  reason      text,
  at          timestamptz not null default now()
);
create index if not exists insight_feedback_idx on insight_feedback(insight_id);

-- ============================================================================
-- 2) Leadership chat (Feature 2)
-- ============================================================================
create table if not exists chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references app_users(id) on delete set null,
  title       text,                            -- auto-derived from first prompt
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists chat_sessions_user_idx on chat_sessions(user_id, updated_at desc);

create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user','assistant','tool')),
  content     text,
  -- For assistant messages that triggered a tool call, we persist the calls
  -- and their results so the conversation can be replayed and audited.
  tool_calls  jsonb default '[]'::jsonb,
  tool_name   text,
  tool_args   jsonb,
  tool_result jsonb,
  provider    text,           -- 'groq' | 'gemini' | null
  model       text,
  at          timestamptz default now()
);
create index if not exists chat_messages_session_idx on chat_messages(session_id, at);

-- Trigger to bump chat_sessions.updated_at when a message is added.
create or replace function chat_session_touch()
returns trigger as $$
begin
  update chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists chat_messages_touch on chat_messages;
create trigger chat_messages_touch after insert on chat_messages
  for each row execute function chat_session_touch();

-- RLS on (deny-by-default; serverless layer uses service role).
alter table insights         enable row level security;
alter table insight_feedback enable row level security;
alter table chat_sessions    enable row level security;
alter table chat_messages    enable row level security;

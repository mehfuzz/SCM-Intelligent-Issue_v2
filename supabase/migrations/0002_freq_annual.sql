-- Add 'Annual' to the frequency_band enum so the new SCM frequency vocabulary
-- (Daily / Weekly / Monthly / Annual) can be persisted. 'Ad-hoc' stays in the
-- enum as a back-compat alias for any existing rows.
--
-- Postgres only allows adding new enum values via ALTER TYPE, and it must run
-- OUTSIDE a transaction block. Wrap in a DO so repeated runs are no-ops.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'frequency_band' and e.enumlabel = 'Annual'
  ) then
    alter type frequency_band add value 'Annual' after 'Monthly';
  end if;
end $$;

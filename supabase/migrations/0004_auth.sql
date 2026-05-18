-- Authentication hardening: bcrypt passwords, first-login password change, user activation.
-- Idempotent — safe to re-run on any database initialised from 0001–0003.

-- pgcrypto must be available (already required by 0001_init.sql).
create extension if not exists pgcrypto;

-- New columns ------------------------------------------------------------
alter table app_users add column if not exists password_hash       text;
alter table app_users add column if not exists must_change_password boolean default false;
alter table app_users add column if not exists is_active            boolean default true;

-- Migrate existing cleartext passwords to blowfish hashes.
-- pgcrypto's crypt() with gen_salt('bf') produces $2a$... format,
-- which bcryptjs.compare() on the Node side can verify directly.
update app_users
  set password_hash = crypt(password, gen_salt('bf', 10))
  where password_hash is null
    and password is not null;

-- Safety fallback for any row still missing a hash.
update app_users
  set password_hash = crypt('changeme', gen_salt('bf', 10))
  where password_hash is null;

alter table app_users alter column password_hash set not null;

-- Drop the old cleartext column now that every row has a hash.
alter table app_users drop column if exists password;

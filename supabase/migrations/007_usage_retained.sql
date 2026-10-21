-- Keeps a deleted account's usage counts for the rest of the IST month, so deleting an account and signing up
-- again does not reset the daily or monthly limits.
-- Rows are keyed by a keyed hash (HMAC-SHA256) of the lowercased email, never the email itself.
-- They are written and read only by the server (service role); RLS is on with no policies.
-- The daily cleanup job (app/api/cron/cleanup) removes rows from before the current month.
create table if not exists public.usage_retained (
  email_hash text not null,
  day date not null,
  scans int not null default 0,
  ai_calls int not null default 0,
  primary key (email_hash, day)
);

alter table public.usage_retained enable row level security;
revoke all on public.usage_retained from anon, authenticated;

-- Check afterwards: should list usage_retained with rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'usage_retained';

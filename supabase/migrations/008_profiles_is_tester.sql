-- Marks the shared test account (scripts/create-tester.mjs). Unlike is_demo it does NOT raise limits: test accounts
-- get their own capped limits (TESTER_LIMIT_* in lib/limits.ts). Like is_demo it blocks self-deletion.
-- Set only by the service role (the profiles table has a select-only RLS policy for users).
alter table public.profiles add column if not exists is_tester boolean not null default false;

-- Check afterwards: should return one row, data_type boolean, default false.
-- select column_name, data_type, column_default from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_tester';

-- InvoiceGuard schema. Run once in Supabase: SQL Editor > New query > paste > Run.
-- Every table holding user data has user_id and row-level security,
-- so one account can never read another account's rows.

create extension if not exists pgcrypto;

-- Profiles (one per auth user; marks judge demo accounts)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Scans
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text not null,
  row_count int not null default 0,
  flag_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists scans_user_idx on public.scans (user_id, created_at desc);

-- Invoices from uploaded registers
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  company_code text,
  vendor_id text,
  vendor_name text,
  invoice_ref text,
  invoice_ref_norm text,
  invoice_date date,
  amount numeric(16, 2),
  currency text,
  po_number text,
  doc_number text
);
create index if not exists invoices_scan_idx on public.invoices (scan_id);
create index if not exists invoices_vendor_idx on public.invoices (user_id, vendor_id);

-- Duplicate pairs
create table if not exists public.flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  pair_code text not null,
  pair_key text not null,
  invoice_a uuid not null references public.invoices (id) on delete cascade,
  invoice_b uuid not null references public.invoices (id) on delete cascade,
  score int not null,
  risk_band text not null check (risk_band in ('High', 'Medium', 'Low')),
  rules_fired text[] not null default '{}',
  dup_type text not null,
  amount numeric(16, 2) not null default 0,
  ai_explanation text,
  ai_action text,
  status text not null default 'pending' check (status in ('pending', 'yes', 'no', 'ignore')),
  recovery_status text,
  note text,
  review_seconds int,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists flags_user_status_idx on public.flags (user_id, status, score desc);
create index if not exists flags_user_key_idx on public.flags (user_id, pair_key);

-- AI vendor-match cache (per user, so one company's suppliers never inform another's)
create table if not exists public.vendor_matches (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vendor_a text not null,
  vendor_b text not null,
  same_supplier boolean not null,
  reason text,
  primary key (user_id, vendor_a, vendor_b)
);

-- Usage counters (written only by consume_quota)
create table if not exists public.usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  scans int not null default 0,
  ai_calls int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.global_usage (
  day date primary key,
  ai_calls int not null default 0
);

-- Row-level security
alter table public.profiles enable row level security;
alter table public.scans enable row level security;
alter table public.invoices enable row level security;
alter table public.flags enable row level security;
alter table public.vendor_matches enable row level security;
alter table public.usage enable row level security;
alter table public.global_usage enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid());

drop policy if exists "own scans" on public.scans;
create policy "own scans" on public.scans for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own invoices" on public.invoices;
create policy "own invoices" on public.invoices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own flags" on public.flags;
create policy "own flags" on public.flags for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own vendor matches" on public.vendor_matches;
create policy "own vendor matches" on public.vendor_matches for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own usage" on public.usage;
create policy "read own usage" on public.usage for select using (user_id = auth.uid());
-- global_usage has no policies: only the server (service role) can touch it.

-- Quota check-and-increment in one transaction.
-- Callable only with the service-role key (never from the browser), so users
-- cannot pass their own limits.
create or replace function public.consume_quota(
  p_user uuid,
  p_kind text,            -- 'scan' or 'ai'
  p_n int,
  p_day_limit int,
  p_month_limit int,
  p_global_limit int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_month_start date := date_trunc('month', v_day)::date;
  v_day_used int;
  v_month_used int;
  v_global_used int;
begin
  insert into usage (user_id, day) values (p_user, v_day) on conflict do nothing;
  perform 1 from usage where user_id = p_user and day = v_day for update;

  if p_kind = 'scan' then
    select scans into v_day_used from usage where user_id = p_user and day = v_day;
    select coalesce(sum(scans), 0) into v_month_used from usage where user_id = p_user and day >= v_month_start;
  else
    select ai_calls into v_day_used from usage where user_id = p_user and day = v_day;
    select coalesce(sum(ai_calls), 0) into v_month_used from usage where user_id = p_user and day >= v_month_start;
  end if;

  if v_day_used + p_n > p_day_limit then
    return jsonb_build_object('ok', false, 'reason', 'daily');
  end if;
  if v_month_used + p_n > p_month_limit then
    return jsonb_build_object('ok', false, 'reason', 'monthly');
  end if;

  if p_kind = 'ai' then
    insert into global_usage (day) values (v_day) on conflict do nothing;
    select ai_calls into v_global_used from global_usage where day = v_day for update;
    if v_global_used + p_n > p_global_limit then
      return jsonb_build_object('ok', false, 'reason', 'global');
    end if;
    update global_usage set ai_calls = ai_calls + p_n where day = v_day;
    update usage set ai_calls = ai_calls + p_n where user_id = p_user and day = v_day;
  else
    update usage set scans = scans + p_n where user_id = p_user and day = v_day;
  end if;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.consume_quota(uuid, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.consume_quota(uuid, text, int, int, int, int) to service_role;

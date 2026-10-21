-- Closes the Supabase "rls_disabled_in_public" alert (project moambzzbxmqzhksuxxyt).
-- public.expenses is not used by InvoiceGuard and has no user_id column, so no per-user policy is possible.
-- RLS on with no policies means only the service role can read or write it.
alter table public.expenses enable row level security;

-- InvoiceGuard's own tables already have RLS (001_init.sql); re-asserting is a no-op and guards against drift.
alter table public.profiles       enable row level security;
alter table public.scans          enable row level security;
alter table public.invoices       enable row level security;
alter table public.flags          enable row level security;
alter table public.vendor_matches enable row level security;
alter table public.usage          enable row level security;
alter table public.global_usage   enable row level security;

-- Check afterwards: every row should show rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;

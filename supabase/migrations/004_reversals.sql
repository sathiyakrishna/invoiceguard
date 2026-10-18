-- Booked-and-reversed invoices are never flagged as duplicates.
-- reversed_with: SAP "reversed with" / STBLG document from the upload (null if blank).
-- is_reversed:   true for an invoice that was reversed and for the credit line that reverses it.
-- Existing rows keep is_reversed = false. Row-level security is unchanged (it keys on user_id).

alter table public.invoices add column if not exists reversed_with text;
alter table public.invoices add column if not exists is_reversed boolean not null default false;

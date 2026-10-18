-- Payment history: catch a duplicate of an invoice already paid in an earlier payment run.
-- clearing_date:     SAP AUGDT, when the invoice was paid/cleared. Null = open, in this payment run.
-- clearing_document: SAP AUGBL, the document that cleared it.
-- Existing rows stay null (treated as open). Row-level security is unchanged (it keys on user_id).

alter table public.invoices add column if not exists clearing_date date;
alter table public.invoices add column if not exists clearing_document text;

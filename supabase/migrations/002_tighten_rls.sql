-- Tighten insert/update checks: referenced scan and invoices must belong to you

drop policy if exists "own invoices" on public.invoices;
create policy "own invoices" on public.invoices for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.scans s
                where s.id = scan_id and s.user_id = auth.uid())
  );

drop policy if exists "own flags" on public.flags;
create policy "own flags" on public.flags for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.scans s
                where s.id = scan_id and s.user_id = auth.uid())
    and exists (select 1 from public.invoices i
                where i.id = invoice_a and i.user_id = auth.uid())
    and exists (select 1 from public.invoices i
                where i.id = invoice_b and i.user_id = auth.uid())
  );
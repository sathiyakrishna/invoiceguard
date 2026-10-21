# InvoiceGuard

Catch duplicate supplier invoices before the payment run.

An AP analyst uploads the payment-run register (CSV, Excel or a text-based PDF exported from an ERP or spreadsheet, not a scan). Rules find and score likely duplicate pairs that SAP's standard check misses (reference format changes, the same invoice in two company codes, PO vs non-PO routes, alternate vendor accounts). AI matches vendor names and explains each flag in plain words. The analyst classifies every pair Yes, No or Ignore, and the dashboard shows payment value prevented, all computed live from the database.

Built for the HelloPM AI Product Management buildathon (theme: personal productivity).

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres, row-level security, Google sign-in) · OpenAI API (vendor matching and explanations only) · Vitest · Vercel

## How detection works

| Rule | Fires when | Points |
| --- | --- | --- |
| R1 | Normalized invoice numbers match (INV-0012 = INV0012) | 50 |
| R2 | Invoice number has a typo: two characters swapped or one extra/missing | 30 |
| R3 | Same gross amount | 30 |
| R4 | Amount within 1% | 15 |
| R5 | Invoice dates within 30 days | 10 |
| R6 | Same invoice in two company codes (only with R1) | 10 |
| R7 | One with PO, one without (only with R1) | 10 |
| R8 | Different vendor accounts the AI confirmed as the same supplier | 10 |

Only pairs with the same vendor (or an AI-confirmed alias) and amounts within 1% are compared, and every pair needs an invoice-number signal. Bands: 80+ High (red), 60–79 Medium (amber), 50–59 Low (green). Recurring charges (RENT-AUG vs RENT-SEP) and consecutive invoices are excluded. Pairs you mark Ignore are not flagged again. Code: `lib/detect.ts`, tests: `tests/`.

**Booked-and-reversed invoices are never flagged.** Negative amounts are kept as credit lines and are never compared as duplicates themselves. An invoice counts as reversed when:
- its **Reversed with** column (SAP `STBLG`; also matched as "reversal doc" or "reversal document") is filled, in which case the credit line whose document number matches is its reversal; or
- a credit line has the same vendor, the same normalized invoice number and the exact negative amount, dated on or after the invoice. The earliest matching invoice is the one reversed.

Each credit reverses at most one invoice. Reversed invoices and their reversal credits are excluded from every pair and shown with a grey **Reversed** tag in the ledger preview. A corrected re-posting (same number and amount, booked after the reversal) is a live invoice: it is only compared with other non-reversed invoices. The sample register includes 3 such booked-reversed-and-reposted cases (2 using `reversed_with`, 1 using only the offsetting credit), and none are flagged. If your export has no credit lines or reversal column, nothing changes. When an invoice has a **Clearing document** (SAP `AUGBL`) and several credit lines could offset it, the credit whose document number matches that clearing document is used.

**Payment history: a duplicate of an invoice already paid is caught.** Include the optional **Clearing date** (SAP `AUGDT`, also "clrng date") and **Clearing document** (`AUGBL`, "clearing doc", "clrng doc") columns, for example from an FBL1N export with cleared items, and a new invoice is also compared with invoices paid in earlier payment runs. A blank clearing date means the invoice is open, in this payment run.
- A pair needs at least one open invoice. Two invoices that are both already paid are skipped, since they are outside pre-payment scope.
- In every pair the paid invoice is **A** and the open one is **B**, and the case review labels them "Paid on DD/MM/YYYY" and "Open, in this payment run". Pairs with no payment information keep the older rule, A = the earlier invoice.
- Reversed invoices stay excluded. Files without clearing columns behave exactly as before.

AI never changes a score or a status. Explanations are generated only when you open a pair, and cached.

## Set up (about 30 minutes)

### 1. Install
```bash
npm install
cp .env.example .env.local
npm test          # 20 tests, should all pass
```

### 2. Supabase
1. Create a project at supabase.com (region: Mumbai).
2. **SQL Editor › New query**: paste all of `supabase/migrations/001_init.sql` and click **Run**. Then run `supabase/migrations/002_tighten_rls.sql` the same way (it makes invoices and flags accept only your own scans), `supabase/migrations/004_reversals.sql` (reversal columns on invoices), `supabase/migrations/005_payment_history.sql` (clearing date and clearing document on invoices) and `supabase/migrations/006_enable_rls_expenses.sql` (turns on row-level security for every table in `public`, including a stray `expenses` table; run it if the Supabase dashboard warns that RLS is disabled). Then run `supabase/migrations/007_usage_retained.sql` (keeps a deleted account's usage counts for the rest of the month, so Settings › Delete my account can't be used to reset limits). There is no `003`: the numbering skips it.
   Upgrading a database from before the rename? Also run: `update public.flags set dup_type = 'Alternate vendor account' where dup_type = 'Alternate vendor ID';`
3. **Project Settings › API**: copy the Project URL, `anon` key and `service_role` key into `.env.local`.
4. **Authentication › Providers › Email**: turn **off** "Allow new users to sign up" (demo accounts are created by script; the public uses Google).
5. **Authentication › URL Configuration**: set Site URL to your Vercel URL later; add redirect URLs `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`.

### 3. Google sign-in
1. Google Cloud Console › APIs & Services › **OAuth consent screen**: External, app name InvoiceGuard, scopes email and profile only. Click **Publish app** (In production) so any Gmail can sign in.
2. **Credentials › Create OAuth client ID** (Web application). Authorized redirect URI: the callback URL shown in Supabase › Authentication › Providers › Google.
3. Paste the client ID and secret into Supabase › Authentication › Providers › **Google** and enable it.

### 4. OpenAI
Create a separate project at platform.openai.com for InvoiceGuard, set a monthly budget limit, create an API key and put it in `OPENAI_API_KEY`.

### 5. Run locally
```bash
npm run dev       # http://localhost:3000
```
Upload `public/sample_register.csv` (2,000 invoices, 25 planted duplicates). `answer_key.csv` lists them (not pushed to GitHub). About 70% of the sample invoices carry a clearing date (paid in an earlier run); each planted duplicate is an open invoice whose original was paid.

3 of the 25 are alternate vendor accounts (the same supplier under two vendor IDs). They are only flagged when the AI vendor matching runs, so `OPENAI_API_KEY` must be set; without it a scan finds 22.

### 6. Judge demo accounts
Set `DEMO_PASSWORD_1..3` in `.env.local` (12+ characters), then:
```bash
npm run demo-users   # creates judge1/2/3@invoiceguard.app with higher limits
```

### 7. GitHub and Vercel
```bash
git init && git add . && git commit -m "InvoiceGuard"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/invoiceguard.git
git push -u origin main
```
Vercel › Add New Project › import the repo › add every variable from `.env.local` (set `NEXT_PUBLIC_SITE_URL` to the Vercel URL and a random `CRON_SECRET`) › Deploy. Then add the Vercel callback URL in Supabase (step 2.5). Every `git push` redeploys.

## Limits (env variables)

Per user: 3 scans and 50 AI calls a day, 10 scans and 200 AI calls a month. Demo accounts: 10 scans and 300 AI calls a day. All users together: 1,500 AI calls a day. Checked and counted in one database transaction (`consume_quota`), callable only by the server. Rule checks never use credits.

## Security

- Row-level security on every table: an account can only read its own rows.
- Service-role and OpenAI keys are server-only.
- Only flagged pairs and similar vendor names are sent to the AI, never whole registers.
- Exported CSV cells are escaped against spreadsheet formula injection.
- Scans are deleted after 30 days by a daily Vercel cron (`/api/cron/cleanup`); users can delete all their data in Settings.

## Before submitting

- Replace `[YOUR CONTACT EMAIL]` in `app/privacy/page.tsx`.
- Test sign-in with a Gmail that has never used the app, in incognito, on phone and laptop.
- Isolation test: sign in with two accounts and confirm neither sees the other's scans.

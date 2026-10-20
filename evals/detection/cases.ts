// Labelled detection scenarios. Synthetic data only: invented vendors, invoice numbers and amounts.
// Labels say what SHOULD happen to an AP analyst, written from the rule table in lib/detect.ts and from common sense,
// not copied from what the engine currently outputs. A scenario lists the document pairs that must be flagged;
// every other pair in it must not be. `band` and `action` are optional extra expectations on a flagged pair.
import type { Band, InvoiceRow, SuggestedAction } from '../../lib/detect';

export type Expected = { docs: [string, string]; band?: Band; action?: SuggestedAction };
export type Scenario = {
  id: string;
  category: string;
  why: string;
  rows: InvoiceRow[];
  sameSupplier?: Array<[string, string]>; // vendor-account pairs the AI is assumed to have confirmed as one supplier
  expect: Expected[];
  gap?: string; // a known limitation of the engine: reported, but kept out of the pass/fail gate
};

const base: InvoiceRow = {
  company_code: '1000', vendor_id: 'V1', vendor_name: 'Kaveri Steel Ltd', invoice_ref: 'INV-1000', invoice_date: '2026-09-02',
  amount: 125000, currency: 'INR', po_number: '4500000001', doc_number: 'D1'
};
const r = (doc: string, o: Partial<InvoiceRow> = {}): InvoiceRow => ({ ...base, doc_number: doc, ...o });

export const CATEGORIES = {
  exact: 'Exact and format duplicates',
  typo: 'Invoice-number typos',
  near: 'Near amount',
  po: 'PO vs non-PO',
  cross: 'Cross company code',
  alt: 'Alternate vendor account',
  recurring: 'Legitimate recurring or series',
  trap: 'Near-miss traps',
  reversal: 'Reversals and credits'
} as const;

const S = (id: string, category: string, why: string, rows: InvoiceRow[], expect: Expected[], extra: Partial<Scenario> = {}): Scenario =>
  ({ id, category, why, rows, expect, ...extra });
const pair = (a: string, b: string, band?: Band, action?: SuggestedAction): Expected => ({ docs: [a, b], band, action });

export const SCENARIOS: Scenario[] = [
  // ───────────── exact and format duplicates ─────────────
  S('exact-same-day', CATEGORIES.exact, 'identical invoice entered twice on the same day',
    [r('D1', { invoice_ref: 'KS-7741', amount: 453210.55 }), r('D2', { invoice_ref: 'KS-7741', amount: 453210.55 })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('exact-12-days', CATEGORIES.exact, 'same invoice posted again 12 days later',
    [r('D1', { invoice_ref: 'KS-7742' }), r('D2', { invoice_ref: 'KS-7742', invoice_date: '2026-09-14' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('exact-45-days', CATEGORIES.exact, 'date is not required: same number and amount 45 days later is still a repeat',
    [r('D1', { invoice_ref: 'KS-7743' }), r('D2', { invoice_ref: 'KS-7743', invoice_date: '2026-10-17' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('format-hyphen', CATEGORIES.exact, 'hyphen dropped when re-keyed',
    [r('D1', { invoice_ref: 'INV-2041' }), r('D2', { invoice_ref: 'INV2041' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('format-case-space-slash', CATEGORIES.exact, 'case, space and slash differences',
    [r('D1', { invoice_ref: 'MI/889' }), r('D2', { invoice_ref: 'mi 889' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('format-leading-zeros', CATEGORIES.exact, 'leading zeros differ',
    [r('D1', { invoice_ref: 'INV-0012' }), r('D2', { invoice_ref: 'INV-12' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('format-dots-underscores', CATEGORIES.exact, 'dots and underscores in the reference',
    [r('D1', { invoice_ref: 'GT_55.201' }), r('D2', { invoice_ref: 'GT55-201' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('exact-three-copies', CATEGORIES.exact, 'the same invoice three times gives three pairs',
    [r('D1', { invoice_ref: 'KS-7750' }), r('D2', { invoice_ref: 'KS-7750', invoice_date: '2026-09-03' }), r('D3', { invoice_ref: 'KS-7750', invoice_date: '2026-09-04' })],
    [pair('D1', 'D2'), pair('D1', 'D3'), pair('D2', 'D3')]),
  S('exact-already-paid', CATEGORIES.exact, 'a repeat of an invoice that was already paid',
    [r('D1', { invoice_ref: 'KS-7751', clearing_date: '2026-09-20', clearing_document: 'C1' }), r('D2', { invoice_ref: 'KS-7751', invoice_date: '2026-09-10' })],
    [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('exact-same-vendor-name-variant', CATEGORIES.exact, 'vendor name spelled differently but the vendor account is the same',
    [r('D1', { invoice_ref: 'KS-7752', vendor_name: 'Kaveri Steel Ltd' }), r('D2', { invoice_ref: 'KS-7752', vendor_name: 'KAVERI STEEL LIMITED' })], [pair('D1', 'D2', 'High')]),
  S('exact-round-amount', CATEGORIES.exact, 'round amount repeated with the same number',
    [r('D1', { invoice_ref: 'RB-300', amount: 100000 }), r('D2', { invoice_ref: 'RB-300', amount: 100000, invoice_date: '2026-09-05' })], [pair('D1', 'D2', 'High')]),

  // ───────────── near amount ─────────────
  S('near-0.4pct', CATEGORIES.near, 'same number, amount differs by about 0.4%',
    [r('D1', { invoice_ref: 'KS-7760', amount: 200000 }), r('D2', { invoice_ref: 'KS-7760', amount: 200800, invoice_date: '2026-09-04' })], [pair('D1', 'D2', 'Medium', 'Block the open invoice')]),
  S('near-0.99pct', CATEGORIES.near, 'amount differs by just under 1% (inside the tolerance)',
    [r('D1', { invoice_ref: 'KS-7761', amount: 200000 }), r('D2', { invoice_ref: 'KS-7761', amount: 201980, invoice_date: '2026-09-03' })], [pair('D1', 'D2', 'Medium')]),
  S('near-40-days', CATEGORIES.near, 'near amount and dates far apart still flagged on number plus amount',
    [r('D1', { invoice_ref: 'KS-7762', amount: 200000 }), r('D2', { invoice_ref: 'KS-7762', amount: 200500, invoice_date: '2026-10-12' })], [pair('D1', 'D2', 'Medium')]),
  S('near-tds-style', CATEGORIES.near, 'same number, one paisa-level rounding difference',
    [r('D1', { invoice_ref: 'KS-7763', amount: 88500.5 }), r('D2', { invoice_ref: 'KS-7763', amount: 88500.54, invoice_date: '2026-09-02' })], [pair('D1', 'D2', 'Medium')]),

  // ───────────── typos ─────────────
  S('typo-swap-digits', CATEGORIES.typo, 'two adjacent digits swapped',
    [r('D1', { invoice_ref: 'LT40417' }), r('D2', { invoice_ref: 'LT40471', invoice_date: '2026-09-05' })], [pair('D1', 'D2', 'Medium', 'Check with supplier')]),
  S('typo-extra-char', CATEGORIES.typo, 'one extra trailing character',
    [r('D1', { invoice_ref: 'SF55' }), r('D2', { invoice_ref: 'SF55A', invoice_date: '2026-09-04' })], [pair('D1', 'D2', 'Medium', 'Check with supplier')]),
  S('typo-missing-char', CATEGORIES.typo, 'one character dropped',
    [r('D1', { invoice_ref: 'INV-4412' }), r('D2', { invoice_ref: 'INV-412', invoice_date: '2026-09-03' })], [pair('D1', 'D2', 'Medium')]),
  S('typo-letter-digit-swap', CATEGORIES.typo, 'a letter and a digit swapped',
    [r('D1', { invoice_ref: 'AB1234' }), r('D2', { invoice_ref: 'AB1243', invoice_date: '2026-09-06' })], [pair('D1', 'D2', 'Medium')]),
  S('typo-25-days', CATEGORIES.typo, 'typo pair 25 days apart is still inside the window',
    [r('D1', { invoice_ref: 'LT50718' }), r('D2', { invoice_ref: 'LT50781', invoice_date: '2026-09-27' })], [pair('D1', 'D2')]),
  S('typo-near-amount', CATEGORIES.typo, 'typo plus amount within 1%',
    [r('D1', { invoice_ref: 'LT60718', amount: 300000 }), r('D2', { invoice_ref: 'LT60781', amount: 300900, invoice_date: '2026-09-03' })], [pair('D1', 'D2', 'Low', 'Check with supplier')]),

  // ───────────── PO vs non-PO ─────────────
  S('po-vs-none', CATEGORIES.po, 'one posted against a PO, the same invoice again without one',
    [r('D1', { invoice_ref: 'KS-7770' }), r('D2', { invoice_ref: 'KS-7770', po_number: '' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('po-vs-none-20-days', CATEGORIES.po, 'PO and non-PO copies 20 days apart',
    [r('D1', { invoice_ref: 'KS-7771' }), r('D2', { invoice_ref: 'KS-7771', po_number: '', invoice_date: '2026-09-22' })], [pair('D1', 'D2', 'High')]),
  S('po-different-pos', CATEGORIES.po, 'both carry a PO but different PO numbers: still the same invoice',
    [r('D1', { invoice_ref: 'KS-7772', po_number: '4500000011' }), r('D2', { invoice_ref: 'KS-7772', po_number: '4500000012' })], [pair('D1', 'D2', 'High')]),
  S('po-none-near-amount', CATEGORIES.po, 'PO vs non-PO with a small amount difference',
    [r('D1', { invoice_ref: 'KS-7773', amount: 150000 }), r('D2', { invoice_ref: 'KS-7773', amount: 150600, po_number: '' })], [pair('D1', 'D2', 'High')]),

  // ───────────── cross company code ─────────────
  S('cross-company', CATEGORIES.cross, 'booked in two company codes',
    [r('D1', { invoice_ref: 'KS-7780' }), r('D2', { invoice_ref: 'KS-7780', company_code: '2000', invoice_date: '2026-09-03' })], [pair('D1', 'D2', 'High', 'Block the open invoice')]),
  S('cross-company-and-po', CATEGORIES.cross, 'two company codes and PO vs non-PO together',
    [r('D1', { invoice_ref: 'KS-7781' }), r('D2', { invoice_ref: 'KS-7781', company_code: '2000', po_number: '' })], [pair('D1', 'D2', 'High')]),
  S('cross-company-format', CATEGORIES.cross, 'two company codes and a format difference in the number',
    [r('D1', { invoice_ref: 'KS/7782' }), r('D2', { invoice_ref: 'KS7782', company_code: '3000', invoice_date: '2026-09-09' })], [pair('D1', 'D2', 'High')]),

  // ───────────── alternate vendor accounts ─────────────
  S('alt-vendor', CATEGORIES.alt, 'one supplier under two vendor accounts, same number and amount',
    [r('D1', { invoice_ref: 'KS-7790' }), r('D2', { invoice_ref: 'KS-7790', vendor_id: 'V2', vendor_name: 'KAVERI STEEL LIMITED' })],
    [pair('D1', 'D2', 'High', 'Check with supplier')], { sameSupplier: [['V1', 'V2']] }),
  S('alt-vendor-near-amount', CATEGORIES.alt, 'alias account plus an amount within 1%',
    [r('D1', { invoice_ref: 'KS-7791', amount: 400000 }), r('D2', { invoice_ref: 'KS-7791', amount: 401500, vendor_id: 'V2', vendor_name: 'Kaveri Steel' })],
    [pair('D1', 'D2', 'High', 'Check with supplier')], { sameSupplier: [['V1', 'V2']] }),
  S('alt-vendor-reversed-key', CATEGORIES.alt, 'the confirmed pair is given in the other order',
    [r('D1', { invoice_ref: 'KS-7792' }), r('D2', { invoice_ref: 'KS-7792', vendor_id: 'V2', vendor_name: 'Kaveri Steel Industries' })],
    [pair('D1', 'D2', 'High', 'Check with supplier')], { sameSupplier: [['V2', 'V1']] }),
  S('alt-vendor-40-days', CATEGORIES.alt, 'alias account 40 days later',
    [r('D1', { invoice_ref: 'KS-7793' }), r('D2', { invoice_ref: 'KS-7793', vendor_id: 'V2', vendor_name: 'Kaveri Steel Industries', invoice_date: '2026-10-12' })],
    [pair('D1', 'D2', 'High', 'Check with supplier')], { sameSupplier: [['V1', 'V2']] }),

  // ───────────── legitimate recurring and series (must NOT flag) ─────────────
  S('recurring-rent-month', CATEGORIES.recurring, 'monthly rent, month name in the reference',
    [r('D1', { invoice_ref: 'RENT-AUG', amount: 85000 }), r('D2', { invoice_ref: 'RENT-SEP', amount: 85000, invoice_date: '2026-10-01' })], []),
  S('recurring-subscription', CATEGORIES.recurring, 'subscription numbered by month and year',
    [r('D1', { invoice_ref: 'SUB-JAN-2026', amount: 24000, invoice_date: '2026-01-05' }), r('D2', { invoice_ref: 'SUB-FEB-2026', amount: 24000, invoice_date: '2026-02-05' })], []),
  S('recurring-electricity-slash', CATEGORIES.recurring, 'utility bill numbered by month with slashes',
    [r('D1', { invoice_ref: 'ELEC/08/2026', amount: 41250 }), r('D2', { invoice_ref: 'ELEC/09/2026', amount: 41250, invoice_date: '2026-10-02' })], []),
  S('recurring-sequential', CATEGORIES.recurring, 'consecutive numbers for a flat monthly fee',
    [r('D1', { invoice_ref: 'INV-3001', amount: 60000 }), r('D2', { invoice_ref: 'INV-3002', amount: 60000, invoice_date: '2026-10-02' })], []),
  S('recurring-1361-1366', CATEGORIES.recurring, 'numbers that differ by one character are not a typo signal',
    [r('D1', { invoice_ref: 'INV-1361', amount: 72000 }), r('D2', { invoice_ref: 'INV-1366', amount: 72000, invoice_date: '2026-09-09' })], []),
  S('recurring-twelve-months', CATEGORIES.recurring, 'twelve months of the same fee, no pair',
    ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map((m, i) =>
      r(`D${i + 1}`, { invoice_ref: `LEASE-${m}`, amount: 150000, invoice_date: `2026-${String(i + 1).padStart(2, '0')}-01` })), []),
  S('recurring-quarters', CATEGORIES.recurring, 'quarterly maintenance, one character differs',
    [r('D1', { invoice_ref: 'MAINT-Q1', amount: 90000 }), r('D2', { invoice_ref: 'MAINT-Q2', amount: 90000, invoice_date: '2026-09-20' })], []),
  S('recurring-month-number', CATEGORIES.recurring, 'year-month in the reference',
    [r('D1', { invoice_ref: 'RENT-2026-08', amount: 85000 }), r('D2', { invoice_ref: 'RENT-2026-09', amount: 85000, invoice_date: '2026-10-01' })], []),
  S('recurring-weekly', CATEGORIES.recurring, 'weekly service numbered by date',
    [r('D1', { invoice_ref: 'WK-0912', amount: 18000 }), r('D2', { invoice_ref: 'WK-0919', amount: 18000, invoice_date: '2026-09-09' })], []),
  S('recurring-month-names-long', CATEGORIES.recurring, 'full month names in the reference',
    [r('D1', { invoice_ref: 'SERVICE FEE AUGUST', amount: 55000 }), r('D2', { invoice_ref: 'SERVICE FEE SEPTEMBER', amount: 55000, invoice_date: '2026-10-01' })], []),

  // ───────────── near-miss traps (must NOT flag) ─────────────
  S('trap-same-amount-different-refs', CATEGORIES.trap, 'same vendor and amount, unrelated invoice numbers',
    [r('D1', { invoice_ref: 'KS-1100', amount: 99000 }), r('D2', { invoice_ref: 'KS-5821', amount: 99000 })], []),
  S('trap-near-amount-different-refs', CATEGORIES.trap, 'amount within 1% but different numbers',
    [r('D1', { invoice_ref: 'KS-1101', amount: 99000 }), r('D2', { invoice_ref: 'KS-5822', amount: 99400 })], []),
  S('trap-same-ref-amount-5pct', CATEGORIES.trap, 'same number but the amount differs by 5%: a different or amended invoice, outside the 1% design tolerance',
    [r('D1', { invoice_ref: 'KS-1102', amount: 200000 }), r('D2', { invoice_ref: 'KS-1102', amount: 210000 })], []),
  S('trap-same-ref-amount-1.5pct', CATEGORIES.trap, 'amount just outside the 1% tolerance',
    [r('D1', { invoice_ref: 'KS-1103', amount: 200000 }), r('D2', { invoice_ref: 'KS-1103', amount: 203000 })], []),
  S('trap-same-ref-different-vendors', CATEGORIES.trap, 'two unrelated suppliers both use INV-001',
    [r('D1', { invoice_ref: 'INV-001', vendor_id: 'V1' }), r('D2', { invoice_ref: 'INV-001', vendor_id: 'V9', vendor_name: 'Meenakshi Packaging Pvt Ltd' })], []),
  S('trap-alias-not-confirmed', CATEGORIES.trap, 'similar vendor accounts the AI did not confirm as one supplier',
    [r('D1', { invoice_ref: 'KS-1104' }), r('D2', { invoice_ref: 'KS-1104', vendor_id: 'V2', vendor_name: 'Kaveri Steel LLP' })], []),
  S('trap-same-document-twice', CATEGORIES.trap, 'the same SAP document listed twice in the extract',
    [r('D1', { invoice_ref: 'KS-1105' }), r('D1', { invoice_ref: 'KS-1105' })], []),
  S('trap-both-paid', CATEGORIES.trap, 'both already paid: outside the pre-payment scope',
    [r('D1', { invoice_ref: 'KS-1106', clearing_date: '2026-09-20', clearing_document: 'C1' }), r('D2', { invoice_ref: 'KS-1106', clearing_date: '2026-09-25', clearing_document: 'C2' })], []),
  S('trap-credit-note-other-ref', CATEGORIES.trap, 'a credit note and an invoice with different numbers',
    [r('D1', { invoice_ref: 'KS-1107', amount: 50000 }), r('D2', { invoice_ref: 'CN-0042', amount: -50000 })], []),
  S('trap-different-currency', CATEGORIES.trap, 'same number, same figure, but INR vs USD',
    [r('D1', { invoice_ref: 'KS-1108', amount: 5000, currency: 'INR' }), r('D2', { invoice_ref: 'KS-1108', amount: 5000, currency: 'USD' })], [],
    { gap: 'detect() ignores the currency column' }),
  S('trap-single-char-diff', CATEGORIES.trap, 'one different character is not a typo signal',
    [r('D1', { invoice_ref: 'INV-5521', amount: 70000 }), r('D2', { invoice_ref: 'INV-5522', amount: 70000 })], []),
  S('trap-non-adjacent-swap', CATEGORIES.trap, 'two characters differ but not adjacent',
    [r('D1', { invoice_ref: 'AB1234', amount: 70000 }), r('D2', { invoice_ref: 'AB4231', amount: 70000 })], []),
  S('trap-typo-far-apart', CATEGORIES.trap, 'typo-like numbers 90 days apart are a series, not a re-key',
    [r('D1', { invoice_ref: 'LT70418', amount: 70000 }), r('D2', { invoice_ref: 'LT70481', amount: 70000, invoice_date: '2026-12-01' })], []),
  S('trap-typo-amount-5pct', CATEGORIES.trap, 'typo-like numbers but the amounts differ by 5%',
    [r('D1', { invoice_ref: 'LT80418', amount: 70000 }), r('D2', { invoice_ref: 'LT80481', amount: 73500, invoice_date: '2026-09-04' })], []),
  S('trap-blank-refs', CATEGORIES.trap, 'two invoices with no invoice number at all',
    [r('D1', { invoice_ref: '', amount: 45000 }), r('D2', { invoice_ref: '', amount: 45000, invoice_date: '2026-09-04' })], []),
  S('trap-placeholder-ref-na', CATEGORIES.trap, 'placeholder "N/A" as the invoice number on two different invoices',
    [r('D1', { invoice_ref: 'N/A', amount: 45000 }), r('D2', { invoice_ref: 'N/A', amount: 45000, invoice_date: '2026-09-04' })], [],
    { gap: 'placeholder references such as N/A or TBD normalise to a real-looking number and match' }),
  S('trap-placeholder-ref-tbd', CATEGORIES.trap, 'placeholder "TBD" as the invoice number',
    [r('D1', { invoice_ref: 'TBD', amount: 32000 }), r('D2', { invoice_ref: 'TBD', amount: 32000, invoice_date: '2026-09-06' })], [],
    { gap: 'placeholder references such as N/A or TBD normalise to a real-looking number and match' }),
  S('trap-alias-refs-differ', CATEGORIES.trap, 'confirmed alias accounts but the invoice numbers are unrelated',
    [r('D1', { invoice_ref: 'KS-1109' }), r('D2', { invoice_ref: 'KS-6644', vendor_id: 'V2', vendor_name: 'Kaveri Steel Industries' })], [], { sameSupplier: [['V1', 'V2']] }),
  S('trap-three-vendors-one-number', CATEGORIES.trap, 'three suppliers each reuse INV-001',
    [r('D1', { invoice_ref: 'INV-001', vendor_id: 'V1' }), r('D2', { invoice_ref: 'INV-001', vendor_id: 'V7', vendor_name: 'Sundaram Fasteners Co' }), r('D3', { invoice_ref: 'INV-001', vendor_id: 'V8', vendor_name: 'Lakshmi Textiles Pvt Ltd' })], []),

  // ───────────── reversals and credits ─────────────
  S('reversal-and-repost', CATEGORIES.reversal, 'booked, reversed by a credit, then correctly re-posted',
    [r('D1', { invoice_ref: 'KS-2001' }), r('D2', { invoice_ref: 'KS-2001', amount: -125000, invoice_date: '2026-09-05' }), r('D3', { invoice_ref: 'KS-2001', invoice_date: '2026-09-08' })], []),
  S('reversal-reversed-with', CATEGORIES.reversal, 'reversal recorded through the reversed_with field, then re-posted',
    [r('D1', { invoice_ref: 'KS-2002', reversed_with: 'D2' }), r('D2', { invoice_ref: 'KS-2002', amount: -125000, invoice_date: '2026-09-06' }), r('D3', { invoice_ref: 'KS-2002', invoice_date: '2026-09-09' })], []),
  S('reversal-duplicate-then-reversed', CATEGORIES.reversal, 'a duplicate was posted and one copy reversed: one live invoice remains, so no pair',
    [r('D1', { invoice_ref: 'KS-2003' }), r('D2', { invoice_ref: 'KS-2003', invoice_date: '2026-09-03' }), r('D3', { invoice_ref: 'KS-2003', amount: -125000, invoice_date: '2026-09-05' })], []),
  S('reversal-partial-credit', CATEGORIES.reversal, 'a partial credit is not a reversal: the two live invoices are still a duplicate',
    [r('D1', { invoice_ref: 'KS-2004' }), r('D2', { invoice_ref: 'KS-2004', amount: -40000, invoice_date: '2026-09-05' }), r('D3', { invoice_ref: 'KS-2004', invoice_date: '2026-09-06' })],
    [pair('D1', 'D3', 'High')]),
  S('reversal-credit-before-invoice', CATEGORIES.reversal, 'a credit dated before the invoice does not reverse it, so the pair stands',
    [r('D1', { invoice_ref: 'KS-2005' }), r('D2', { invoice_ref: 'KS-2005', invoice_date: '2026-09-04' }), r('D3', { invoice_ref: 'KS-2005', amount: -125000, invoice_date: '2026-08-20' })],
    [pair('D1', 'D2', 'High')])
];

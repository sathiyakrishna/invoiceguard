// 50 explanation cases: 30 real pairs (10 High, 10 Medium, 10 Low) whose explanations are written live by the production prompt,
// and 20 deliberately flawed explanations written by hand (#1-40 are the labelled set; #41-50 are extra flawed cases that need no human labels). Synthetic data only.
// Pair data is not typed by hand: rows go through detect(), so risk band, score, rules and action are what the app would produce.
import { detect, RULES, suggestedAction, type Band, type InvoiceRow, type RuleId, vendorPairKey } from '../../lib/detect';
import { pickInvoice, type ExplainInput } from '../../lib/ai-prompts';

const base: InvoiceRow = {
  company_code: '1000', vendor_id: 'V1', vendor_name: 'Kaveri Steel Ltd', invoice_ref: 'KS-7741', invoice_date: '2026-09-02',
  amount: 453210.55, currency: 'INR', po_number: '4500012345', doc_number: '5100000001'
};
type Side = Partial<InvoiceRow>;

/** Runs two invoices through detect() and returns the pair exactly as the explain route would hand it to the AI. */
function build(want: Band, a: Side, b: Side, alias = false): ExplainInput {
  const rowA = { ...base, doc_number: '5100000001', ...a };
  const rowB = { ...base, doc_number: '5100000002', ...b };
  const same = alias ? new Set([vendorPairKey(rowA.vendor_id, rowB.vendor_id)]) : new Set<string>();
  const found = detect([rowA, rowB], same);
  if (found.length !== 1) throw new Error(`fixture ${rowA.invoice_ref}/${rowB.invoice_ref}: expected one pair, got ${found.length}`);
  const c = found[0];
  if (c.band !== want) throw new Error(`fixture ${rowA.invoice_ref}/${rowB.invoice_ref}: wanted ${want}, got ${c.band} (${c.rules.join('+')})`);
  const rows = [rowA, rowB];
  return {
    action: suggestedAction(c.rules), type: c.type, risk: c.band, score: c.score,
    rules: c.rules.map((r) => RULES[r as RuleId].label), a: pickInvoice(rows[c.a]), b: pickInvoice(rows[c.b])
  };
}
const paid = { clearing_date: '2026-09-18', clearing_document: '2000000101' };

export const REAL: ExplainInput[] = [
  // ---- High ----
  build('High', { invoice_ref: 'KS-7741' }, { invoice_ref: 'KS-7741' }),
  build('High', { vendor_id: 'V2', vendor_name: 'Sundaram Fasteners Pvt Ltd', invoice_ref: 'INV-2041', amount: 98250 }, { vendor_id: 'V2', vendor_name: 'Sundaram Fasteners Pvt Ltd', invoice_ref: 'INV2041', amount: 98250, invoice_date: '2026-09-04' }),
  build('High', { vendor_id: 'V3', vendor_name: 'Vinayak Castings Ltd', invoice_ref: 'VI9-3489', amount: 160560.29 }, { vendor_id: 'V3', vendor_name: 'Vinayak Castings Ltd', invoice_ref: 'VI9-3489', amount: 160560.29, company_code: '2000', invoice_date: '2026-09-03' }),
  build('High', { vendor_id: 'V4', vendor_name: 'Meenakshi Packaging Pvt Ltd', invoice_ref: 'MP-5520', amount: 72400 }, { vendor_id: 'V4', vendor_name: 'Meenakshi Packaging Pvt Ltd', invoice_ref: 'MP-5520', amount: 72400, po_number: '', invoice_date: '2026-09-09' }),
  build('High', { vendor_id: 'V5', vendor_name: 'Lakshmi Textiles Pvt Ltd', invoice_ref: 'LT-1190', amount: 241800, ...paid }, { vendor_id: 'V5', vendor_name: 'Lakshmi Textiles Pvt Ltd', invoice_ref: 'LT-1190', amount: 241800, invoice_date: '2026-09-11' }),
  build('High', { vendor_id: 'V6', vendor_name: 'Hindustan Valves Pvt Ltd', invoice_ref: 'HV-8830', amount: 515000 }, { vendor_id: 'V7', vendor_name: 'HINDUSTAN VALVES PRIVATE LIMITED', invoice_ref: 'HV-8830', amount: 515000, invoice_date: '2026-09-05' }, true),
  build('High', { vendor_id: 'V8', vendor_name: 'Deccan Logistics LLP', invoice_ref: 'DL-0412', amount: 36900 }, { vendor_id: 'V8', vendor_name: 'Deccan Logistics LLP', invoice_ref: 'DL-0412', amount: 36900, invoice_date: '2026-10-17' }),
  build('High', { vendor_id: 'V9', vendor_name: 'Rao & Sons Engineering Co', invoice_ref: 'RS-6601', amount: 129990.5, ...paid }, { vendor_id: 'V9', vendor_name: 'Rao & Sons Engineering Co', invoice_ref: 'RS-6601', amount: 129990.5, company_code: '3000', po_number: '', invoice_date: '2026-09-08' }),
  build('High', { vendor_id: 'V10', vendor_name: 'Eastern Gaskets Pvt Ltd', invoice_ref: 'EG-3345', amount: 84100, ...paid }, { vendor_id: 'V11', vendor_name: 'Eastern Gaskets Private Limited', invoice_ref: 'EG-3345', amount: 84100, invoice_date: '2026-09-12' }, true),
  build('High', { vendor_id: 'V12', vendor_name: 'Pioneer Hydraulics Co', invoice_ref: 'PH-9007', amount: 1204000, po_number: '4500020001' }, { vendor_id: 'V12', vendor_name: 'Pioneer Hydraulics Co', invoice_ref: 'PH-9007', amount: 1204000, company_code: '2000', po_number: '4500020002', invoice_date: '2026-09-03' }),
  // ---- Medium ----
  build('Medium', { vendor_id: 'V13', vendor_name: 'Zenith Packaging Industries Ltd', invoice_ref: 'LT40417', amount: 55000 }, { vendor_id: 'V13', vendor_name: 'Zenith Packaging Industries Ltd', invoice_ref: 'LT40471', amount: 55000, invoice_date: '2026-09-05' }),
  build('Medium', { vendor_id: 'V14', vendor_name: 'Navkar Chemicals Pvt Ltd', invoice_ref: 'SF55', amount: 318750 }, { vendor_id: 'V14', vendor_name: 'Navkar Chemicals Pvt Ltd', invoice_ref: 'SF55A', amount: 318750, invoice_date: '2026-09-04' }),
  build('Medium', { vendor_id: 'V15', vendor_name: 'Tirupati Wire Products', invoice_ref: 'TW-2210', amount: 200000 }, { vendor_id: 'V15', vendor_name: 'Tirupati Wire Products', invoice_ref: 'TW-2210', amount: 200800, invoice_date: '2026-09-04' }),
  build('Medium', { vendor_id: 'V16', vendor_name: 'Apex Bearings Ltd', invoice_ref: 'AB-7712', amount: 467300 }, { vendor_id: 'V16', vendor_name: 'Apex Bearings Ltd', invoice_ref: 'AB-7712', amount: 468100, invoice_date: '2026-10-12' }),
  build('Medium', { vendor_id: 'V17', vendor_name: 'Mahalakshmi Steel Traders', invoice_ref: 'MS-4180', amount: 91200, ...paid }, { vendor_id: 'V17', vendor_name: 'Mahalakshmi Steel Traders', invoice_ref: 'MS-4108', amount: 91200, invoice_date: '2026-09-07' }),
  build('Medium', { vendor_id: 'V18', vendor_name: 'Shree Ganesh Forgings Works', invoice_ref: 'INV-4412', amount: 62000 }, { vendor_id: 'V18', vendor_name: 'Shree Ganesh Forgings Works', invoice_ref: 'INV-412', amount: 62000, invoice_date: '2026-09-03' }),
  build('Medium', { vendor_id: 'V19', vendor_name: 'Bharat Electricals & Co', invoice_ref: 'BE-5005', amount: 150000, ...paid }, { vendor_id: 'V19', vendor_name: 'Bharat Electricals & Co', invoice_ref: 'BE-5005', amount: 150900, invoice_date: '2026-09-10' }),
  build('Medium', { vendor_id: 'V20', vendor_name: 'Orion Lubricants Inc', invoice_ref: 'OL-3318', amount: 27800 }, { vendor_id: 'V20', vendor_name: 'Orion Lubricants Inc', invoice_ref: 'OL-3381', amount: 27800, company_code: '2000', invoice_date: '2026-09-20' }),
  build('Medium', { vendor_id: 'V21', vendor_name: 'Gujarat Alloys Ltd', invoice_ref: 'GA-1020', amount: 300000 }, { vendor_id: 'V21', vendor_name: 'Gujarat Alloys Ltd', invoice_ref: 'GA-1020', amount: 302900, invoice_date: '2026-09-06' }),
  build('Medium', { vendor_id: 'V22', vendor_name: 'Surya Cables Ltd', invoice_ref: 'AB1234', amount: 78400 }, { vendor_id: 'V22', vendor_name: 'Surya Cables Ltd', invoice_ref: 'AB1243', amount: 78400, invoice_date: '2026-09-06' }),
  // ---- Low (typo + amount within 1% but not equal) ----
  build('Low', { vendor_id: 'V23', vendor_name: 'Universal Springs Ltd', invoice_ref: 'LT60718', amount: 300000 }, { vendor_id: 'V23', vendor_name: 'Universal Springs Ltd', invoice_ref: 'LT60781', amount: 300900, invoice_date: '2026-09-03' }),
  build('Low', { vendor_id: 'V24', vendor_name: 'Metro Fasteners Pvt Ltd', invoice_ref: 'MF-8801', amount: 45200 }, { vendor_id: 'V24', vendor_name: 'Metro Fasteners Pvt Ltd', invoice_ref: 'MF-8810', amount: 45350, invoice_date: '2026-09-05' }),
  build('Low', { vendor_id: 'V25', vendor_name: 'Allied Rubber Products', invoice_ref: 'AR-3300', amount: 112000, ...paid }, { vendor_id: 'V25', vendor_name: 'Allied Rubber Products', invoice_ref: 'AR-33000', amount: 112600, invoice_date: '2026-09-09' }),
  build('Low', { vendor_id: 'V26', vendor_name: 'Vijay Auto Components', invoice_ref: 'VA-5612', amount: 88000 }, { vendor_id: 'V26', vendor_name: 'Vijay Auto Components', invoice_ref: 'VA-5621', amount: 88500, invoice_date: '2026-09-04' }),
  build('Low', { vendor_id: 'V27', vendor_name: 'Delta Valves Pvt Ltd', invoice_ref: 'DV-7001', amount: 640000 }, { vendor_id: 'V27', vendor_name: 'Delta Valves Pvt Ltd', invoice_ref: 'DV-70010', amount: 643000, invoice_date: '2026-09-18' }),
  build('Low', { vendor_id: 'V28', vendor_name: 'Ganga Paper Mills', invoice_ref: 'GP-2041', amount: 23500 }, { vendor_id: 'V28', vendor_name: 'Ganga Paper Mills', invoice_ref: 'GP-2014', amount: 23600, company_code: '2000', invoice_date: '2026-09-02' }),
  build('Low', { vendor_id: 'V29', vendor_name: 'Anand Tools Pvt Ltd', invoice_ref: 'AT-9120', amount: 174500, ...paid }, { vendor_id: 'V29', vendor_name: 'Anand Tools Pvt Ltd', invoice_ref: 'AT-9102', amount: 175200, po_number: '', invoice_date: '2026-09-14' }),
  build('Low', { vendor_id: 'V30', vendor_name: 'Patel Brothers Transport', invoice_ref: 'PB-4470', amount: 51000 }, { vendor_id: 'V30', vendor_name: 'Patel Brothers Transport', invoice_ref: 'PB-4407', amount: 51300, invoice_date: '2026-09-23' }),
  build('Low', { vendor_id: 'V31', vendor_name: 'Nandi Castings Pvt Ltd', invoice_ref: 'NC-615', amount: 96500 }, { vendor_id: 'V31', vendor_name: 'Nandi Castings Pvt Ltd', invoice_ref: 'NC-6150', amount: 96900, invoice_date: '2026-09-06' }),
  build('Low', { vendor_id: 'V32', vendor_name: 'Sai Enterprises', invoice_ref: 'SE-3012', amount: 18800 }, { vendor_id: 'V32', vendor_name: 'Sai Enterprises', invoice_ref: 'SE-3021', amount: 18890, invoice_date: '2026-09-02' })
];

export type Flaw = 'invented_fact' | 'uncertain_high_medium' | 'low_overclaim' | 'wrong_action' | 'claims_block_or_pay' | 'wrong_figure' | 'wrong_date';
export type Case = { n: number; kind: 'real' | 'flawed'; flaw?: Flaw; input: ExplainInput; fixed?: string };

const R = REAL;
const sv = (i: ExplainInput) => i.a.vendor_name;
// Hand-written flawed explanations. Each uses correct amounts and dates except the one that is about a wrong figure.
const FLAWED: Array<{ from: number; flaw: Flaw; text: (i: ExplainInput) => string }> = [
  { from: 0, flaw: 'invented_fact', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again on ${i.b.invoice_date}. The supplier has already confirmed that the first payment went to a new bank account, so this looks like the same invoice entered twice.` },
  { from: 12, flaw: 'invented_fact', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again on ${i.b.invoice_date}. The second bill carries a revised GST rate, which suggests a re-issued invoice that is likely a repeat.` },
  { from: 3, flaw: 'uncertain_high_medium', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again on ${i.b.invoice_date}, one with a PO and one without. It is unclear whether this is really a duplicate and the match is uncertain.` },
  { from: 11, flaw: 'uncertain_high_medium', text: (i) => `${sv(i)} billed ${i.a.invoice_no} and ${i.b.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and ${i.b.invoice_date}. These may well be two legitimate bills, so it is hard to say.` },
  { from: 20, flaw: 'low_overclaim', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and ${i.b.invoice_no} for ${i.b.amount} on ${i.b.invoice_date}. This is definitely a duplicate with no doubt at all.` },
  { from: 1, flaw: 'wrong_action', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again on ${i.b.invoice_date}. This looks like the same invoice entered twice, so the supplier should be asked to confirm first.` },
  { from: 10, flaw: 'wrong_action', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again as ${i.b.invoice_no} on ${i.b.invoice_date}. This looks like the same invoice entered twice.` },
  { from: 2, flaw: 'claims_block_or_pay', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again on ${i.b.invoice_date}, posted in company codes ${i.a.company_code} and ${i.b.company_code}. InvoiceGuard has blocked the open invoice in the ERP.` },
  { from: 13, flaw: 'claims_block_or_pay', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again on ${i.b.invoice_date}. InvoiceGuard will hold the next payment run for this supplier until the analyst approves.` },
  { from: 6, flaw: 'wrong_figure', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ₹36,950.00 on ${i.a.invoice_date} and again on ${i.b.invoice_date}. This looks like the same invoice entered twice.` }
];

// Ten more flawed cases, numbered 41-50 so #1-40 (and the hand labels tied to them) keep their numbers. Each is built on a pair no other flawed case uses.
// They are wrong by construction, so they need no human labels. Everything except the named flaw is correct.
const EXTRA_FLAWED: Array<{ from: number; flaw: Flaw; text: (i: ExplainInput) => string }> = [
  { from: 4, flaw: 'invented_fact', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date}; it was already paid on ${i.a.cleared_on}, and the same number is open again from ${i.b.invoice_date}. The supplier never applied the credit note for the first payment, which explains the repeat.` },
  { from: 14, flaw: 'invented_fact', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date}; it was already paid on ${i.a.cleared_on}. The second invoice ${i.b.invoice_no} looks like a repeat, caused by a keying error at the supplier accounts desk.` },
  { from: 9, flaw: 'wrong_figure', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ₹12,40,000.00 on ${i.a.invoice_date} and again on ${i.b.invoice_date}, posted in company codes ${i.a.company_code} and ${i.b.company_code}. This looks like the same invoice entered twice.` },
  { from: 5, flaw: 'wrong_date', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again on 15/09/2026 under a second vendor account. This looks like one supplier billing twice, so the supplier should confirm before paying.` },
  { from: 18, flaw: 'wrong_date', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and again for ${i.b.amount} on 26/09/2026. The amounts differ slightly but this looks like the same invoice entered twice.` },
  { from: 19, flaw: 'uncertain_high_medium', text: (i) => `${sv(i)} billed ${i.a.invoice_no} and ${i.b.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and ${i.b.invoice_date}. It is not clear whether this is a real duplicate, so the evidence is inconclusive.` },
  { from: 23, flaw: 'low_overclaim', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and ${i.b.invoice_no} for ${i.b.amount} on ${i.b.invoice_date}. Beyond any doubt this is the same invoice billed twice.` },
  { from: 7, flaw: 'wrong_action', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date}; it was already paid on ${i.a.cleared_on}, and the same number is open again from ${i.b.invoice_date} in company code ${i.b.company_code}. This is only a possible duplicate, so the supplier should be asked to confirm first.` },
  { from: 17, flaw: 'wrong_action', text: (i) => `${sv(i)} billed ${i.a.invoice_no} and ${i.b.invoice_no} for ${i.a.amount} on ${i.a.invoice_date} and ${i.b.invoice_date}. These are plainly the same invoice entered twice.` },
  { from: 16, flaw: 'claims_block_or_pay', text: (i) => `${sv(i)} billed ${i.a.invoice_no} for ${i.a.amount} on ${i.a.invoice_date}; it was already paid on ${i.a.cleared_on}, and ${i.b.amount} is open again from ${i.b.invoice_date}. InvoiceGuard has paid the second invoice automatically.` }
];

// A fixed shuffle so the labelling sheet does not reveal which cases are flawed.
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) % 4294967296; const j = s % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

const all: Omit<Case, 'n'>[] = [
  ...R.map((input) => ({ kind: 'real' as const, input })),
  ...FLAWED.map((f) => ({ kind: 'flawed' as const, flaw: f.flaw, input: R[f.from], fixed: f.text(R[f.from]) }))
];
const labelled: Case[] = shuffled(all, 20261020).map((c, i) => ({ n: i + 1, ...c }));
const extra: Case[] = EXTRA_FLAWED.map((f, i) => ({ n: labelled.length + 1 + i, kind: 'flawed' as const, flaw: f.flaw, input: R[f.from], fixed: f.text(R[f.from]) }));
export const CASES: Case[] = [...labelled, ...extra];

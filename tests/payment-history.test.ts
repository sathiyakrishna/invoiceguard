import { describe, it, expect } from 'vitest';
import { detect, findReversals, findVendorCandidates, type InvoiceRow } from '@/lib/detect';
import { autoMap, toInvoiceRows } from '@/lib/parse';

const base: InvoiceRow = {
  company_code: '1000', vendor_id: 'V1', vendor_name: 'Bosch Ltd', invoice_ref: 'INV-0012',
  invoice_date: '2026-09-02', amount: 125000, currency: 'INR', po_number: '4500012345', doc_number: 'D1'
};
const row = (o: Partial<InvoiceRow>): InvoiceRow => ({ ...base, ...o });

describe('payment history (clearing dates)', () => {
  const paid = (o: Partial<InvoiceRow> = {}) => row({ vendor_id: 'V5', vendor_name: 'Paid Ltd', invoice_ref: 'PH-1', invoice_date: '2026-08-10', amount: 80000, doc_number: 'P1', clearing_date: '2026-09-01', clearing_document: 'C1', ...o });
  const open = (o: Partial<InvoiceRow> = {}) => row({ vendor_id: 'V5', vendor_name: 'Paid Ltd', invoice_ref: 'PH-1', invoice_date: '2026-08-14', amount: 80000, doc_number: 'P2', clearing_date: null, clearing_document: '', ...o });

  it('flags a paid invoice and an open duplicate, with the paid one as A and the open one as B', () => {
    const found = detect([open(), paid()]);
    expect(found).toHaveLength(1);
    expect(found[0].a).toBe(1); // the paid invoice, even though the open one is listed first
    expect(found[0].b).toBe(0);
  });

  it('A is the paid invoice even when it is dated after the open one', () => {
    const rows = [paid({ invoice_date: '2026-08-20' }), open({ invoice_date: '2026-08-12' })];
    const [c] = detect(rows);
    expect(rows[c.a].clearing_date).toBeTruthy();
    expect(rows[c.b].clearing_date).toBeFalsy();
  });

  it('does not flag two invoices that are both already paid', () => {
    expect(detect([paid(), paid({ invoice_date: '2026-08-14', doc_number: 'P2', clearing_document: 'C2' })])).toEqual([]);
  });

  it('still compares an open invoice with each paid one, but not the paid ones with each other', () => {
    const rows = [paid(), paid({ doc_number: 'P3', clearing_document: 'C3', invoice_date: '2026-08-12' }), open()];
    const found = detect(rows);
    expect(found).toHaveLength(2);
    expect(found.every((f) => f.b === 2)).toBe(true);
  });

  it('two open invoices are flagged as before, earlier one first', () => {
    const rows = [open({ invoice_date: '2026-08-14' }), open({ invoice_date: '2026-08-10', doc_number: 'P9' }), paid({ invoice_ref: 'OTHER-9', amount: 1234, doc_number: 'P7' })];
    const [c] = detect(rows);
    expect(c.a).toBe(1);
    expect(c.b).toBe(0);
  });

  it('files without clearing columns behave exactly as before', () => {
    const plain = [row({ invoice_ref: 'A-1' }), row({ invoice_ref: 'A1', invoice_date: '2026-09-01', doc_number: 'D2' }), row({ invoice_ref: 'ZZ-9', amount: 999, doc_number: 'D3' })];
    const blank = plain.map((r) => ({ ...r, clearing_date: null, clearing_document: '' }));
    expect(detect(blank)).toEqual(detect(plain));
    const [c] = detect(plain);
    expect(plain[c.a].invoice_date! <= plain[c.b].invoice_date!).toBe(true); // A = earlier, as before
  });

  it('clearing_document picks the matching credit when several credits could offset the invoice', () => {
    const inv = paid({ invoice_ref: 'RV-5', amount: 40000, clearing_document: 'D777' });
    const credit = (doc: string) => row({ vendor_id: 'V5', invoice_ref: 'RV-5', amount: -40000, invoice_date: '2026-08-15', doc_number: doc });
    expect(findReversals([inv, credit('D111'), credit('D777')])).toEqual([true, false, true]);
    expect(findReversals([inv, credit('D777'), credit('D111')])).toEqual([true, true, false]);
  });

  it('an invoice cleared against its reversal credit is excluded, but its open re-posting is not', () => {
    const orig = paid({ invoice_ref: 'RV-6', amount: 52000, clearing_date: '2026-08-12', clearing_document: 'D50' });
    const credit = row({ vendor_id: 'V5', invoice_ref: 'RV-6', amount: -52000, invoice_date: '2026-08-12', doc_number: 'D50', clearing_date: '2026-08-12', clearing_document: 'D50' });
    const repost = open({ invoice_ref: 'RV-6', amount: 52000, invoice_date: '2026-08-16' });
    expect(findReversals([orig, credit, repost])).toEqual([true, true, false]);
    expect(detect([orig, credit, repost])).toEqual([]);
  });

  it('does not offer a pair of two paid invoices to the vendor matcher', () => {
    const a = row({ vendor_id: 'V1', vendor_name: 'Bosch Ltd', invoice_ref: 'X-1', amount: 900, clearing_date: '2026-09-01' });
    const b = row({ vendor_id: 'V2', vendor_name: 'BOSCH LIMITED', invoice_ref: 'X-1', amount: 900, clearing_date: '2026-09-02' });
    expect(findVendorCandidates([a, b])).toHaveLength(0);
    expect(findVendorCandidates([a, { ...b, clearing_date: null }])).toHaveLength(1);
  });

  it('maps the SAP clearing columns and parses the clearing date', () => {
    for (const h of ['Clearing Date', 'clearing_date', 'CLRNG DATE', 'AUGDT']) expect(autoMap(['Vendor', 'Invoice no', 'Amount', h]).clearing_date).toBe(h);
    for (const h of ['Clearing Document', 'clearing_document', 'Clearing doc', 'Clrng doc', 'AUGBL']) expect(autoMap(['Vendor', 'Invoice no', 'Amount', h]).clearing_document).toBe(h);
    const map = autoMap(['Vendor', 'Invoice no', 'Amount', 'AUGDT', 'AUGBL']);
    const rec = { Vendor: 'V1', 'Invoice no': 'I-1', Amount: '100' };
    const { rows, errors } = toInvoiceRows([{ ...rec, AUGDT: '05.09.2026', AUGBL: ' 2000000123 ' }, { ...rec, 'Invoice no': 'I-2', AUGDT: '', AUGBL: '' }, { ...rec, 'Invoice no': 'I-3', AUGDT: 'soon', AUGBL: '' }], map);
    expect(rows.map((r) => r.clearing_date)).toEqual(['2026-09-05', null, null]);
    expect(rows.map((r) => r.clearing_document)).toEqual(['2000000123', '', '']);
    expect(errors.map((e) => e.message).join()).toContain('Clearing date "soon"');
  });
});

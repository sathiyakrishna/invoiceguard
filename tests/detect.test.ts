import { describe, it, expect } from 'vitest';
import { toInvoiceRows, autoMap } from '@/lib/parse';
import { suggestedAction, findReversals, detect, normalizeRef, normalizeVendor, jaroWinkler, vendorPairKey, findVendorCandidates, type InvoiceRow } from '@/lib/detect';

const base: InvoiceRow = {
  company_code: '1000', vendor_id: 'V1', vendor_name: 'Bosch Ltd', invoice_ref: 'INV-0012',
  invoice_date: '2026-09-02', amount: 125000, currency: 'INR', po_number: '4500012345', doc_number: 'D1'
};
const row = (o: Partial<InvoiceRow>): InvoiceRow => ({ ...base, ...o });

describe('normalization', () => {
  it('treats hyphens, slashes and leading zeros as the same reference', () => {
    expect(normalizeRef('INV-0012')).toBe(normalizeRef('INV0012'));
    expect(normalizeRef('MI/889')).toBe(normalizeRef('mi 889'));
    expect(normalizeRef('0012')).toBe('12');
    expect(normalizeRef('A1000')).toBe('A1000');
  });
  it('strips company suffixes from vendor names', () => {
    expect(normalizeVendor('Bosch Ltd.')).toBe('BOSCH');
    expect(normalizeVendor('BOSCH LIMITED')).toBe('BOSCH');
    expect(normalizeVendor('Robert Bosch India Pvt Ltd')).toBe('ROBERT BOSCH');
  });
  it('jaro-winkler behaves', () => {
    expect(jaroWinkler('ABC', 'ABC')).toBe(1);
    expect(jaroWinkler('LT40417', 'LT40471')).toBeGreaterThan(0.9);
    expect(jaroWinkler('ABC', 'XYZ')).toBe(0);
  });
});

describe('detect', () => {
  it('flags a reference format change as High', () => {
    const r = detect([row({}), row({ invoice_ref: 'INV0012', invoice_date: '2026-09-05', doc_number: 'D2' })]);
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('Reference format');
    expect(r[0].band).toBe('High');
    expect(r[0].rules).toEqual(expect.arrayContaining(['R1', 'R3', 'R5']));
    expect(r[0].a).toBe(0);
  });
  it('flags the same invoice in two company codes', () => {
    const r = detect([row({}), row({ company_code: '2000', doc_number: 'D2' })]);
    expect(r[0].type).toBe('Cross company code');
    expect(r[0].band).toBe('High');
  });
  it('flags PO vs non-PO', () => {
    const r = detect([row({}), row({ po_number: '', doc_number: 'D2', invoice_date: '2026-09-03' })]);
    expect(r[0].type).toBe('PO vs non-PO');
  });
  it('flags a typo in the reference as Medium', () => {
    const r = detect([row({ invoice_ref: 'LT-40417' }), row({ invoice_ref: 'LT-40471', doc_number: 'D2', invoice_date: '2026-09-09' })]);
    expect(r[0].type).toBe('Similar reference');
    expect(r[0].band).toBe('Medium');
  });
  it('flags near amounts', () => {
    const r = detect([row({}), row({ amount: 124980, doc_number: 'D2' })]);
    expect(r[0].rules).toContain('R4');
    expect(r[0].type).toBe('Near amount');
  });
  it('needs AI confirmation before pairing different vendor accounts', () => {
    const rows = [row({}), row({ vendor_id: 'V2', vendor_name: 'Robert Bosch India', doc_number: 'D2', po_number: '' })];
    expect(detect(rows)).toHaveLength(0);
    const r = detect(rows, new Set([vendorPairKey('V1', 'V2')]));
    expect(r[0].type).toBe('Alternate vendor account');
    expect(r[0].rules).toContain('R8');
  });
  it('ignores recurring rent with different references', () => {
    const r = detect([row({ invoice_ref: 'RENT-SEP', invoice_date: '2026-09-01' }), row({ invoice_ref: 'RENT-AUG', invoice_date: '2026-08-01', doc_number: 'D2' })]);
    expect(r).toHaveLength(0);
  });
  it('ignores month-named recurring charges even when dates are close', () => {
    const r = detect([row({ invoice_ref: 'AB-RENT-AUG', invoice_date: '2026-08-28' }), row({ invoice_ref: 'AB-RENT-SEP', invoice_date: '2026-09-02', doc_number: 'D2' })]);
    expect(r).toHaveLength(0);
  });
  it('does not treat consecutive invoice numbers as typos', () => {
    const r = detect([row({ invoice_ref: 'SH8-1361', amount: 276403.83 }), row({ invoice_ref: 'SH8-1366', amount: 276142.04, invoice_date: '2026-09-20', doc_number: 'D2' })]);
    expect(r).toHaveLength(0);
  });
  it('treats an extra character as a typo', () => {
    const r = detect([row({ invoice_ref: 'SF-55' }), row({ invoice_ref: 'SF-55A', doc_number: 'D2', invoice_date: '2026-09-03' })]);
    expect(r[0].rules).toContain('R2');
  });
  it('ignores the next invoice in a series months later', () => {
    const r = detect([row({ invoice_ref: 'AB-1001', invoice_date: '2026-06-01' }), row({ invoice_ref: 'AB-1002', invoice_date: '2026-09-01', doc_number: 'D2' })]);
    expect(r).toHaveLength(0);
  });
  it('does not pair unrelated amounts or the same document twice', () => {
    expect(detect([row({}), row({ amount: 200000, doc_number: 'D2' })])).toHaveLength(0);
    expect(detect([row({}), row({})])).toHaveLength(0);
  });
  it('skips pairs the user ignored before', () => {
    const rows = [row({}), row({ invoice_ref: 'INV0012', doc_number: 'D2' })];
    const key = detect(rows)[0].pairKey;
    expect(detect(rows, new Set(), new Set([key]))).toHaveLength(0);
  });
  it('finds vendor candidates for AI matching', () => {
    const c = findVendorCandidates([row({}), row({ vendor_id: 'V2', vendor_name: 'Robert Bosch India Pvt Ltd', doc_number: 'D2' })]);
    expect(c).toHaveLength(1);
  });
  it('handles 20,000 rows quickly', () => {
    const rows: InvoiceRow[] = Array.from({ length: 20000 }, (_, i) => row({ vendor_id: 'V' + (i % 400), invoice_ref: 'X-' + i, amount: 1000 + i * 7.3, doc_number: 'D' + i }));
    const t = Date.now();
    detect(rows);
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

describe('suggestedAction', () => {
  it('blocks a same-number, same-amount pair across company codes (DP-0002: R1 R3 R5 R6)', () => {
    expect(suggestedAction(['R1', 'R3', 'R5', 'R6'])).toBe('Block the open invoice');
  });
  it('blocks a same-number pair with an amount within 1%', () => {
    expect(suggestedAction(['R1', 'R4', 'R5'])).toBe('Block the open invoice');
  });
  it('checks with the supplier for a typo pair (R2)', () => {
    expect(suggestedAction(['R2', 'R3', 'R5'])).toBe('Check with supplier');
  });
  it('checks with the supplier for an alias-vendor pair (R8), even with R1 and R3', () => {
    expect(suggestedAction(['R1', 'R3', 'R8'])).toBe('Check with supplier');
  });
  it('checks with the supplier when nothing else decides it', () => {
    expect(suggestedAction(['R3', 'R5'])).toBe('Check with supplier');
  });
});

describe('booked and reversed invoices', () => {
  const orig = row({ vendor_id: 'V7', vendor_name: 'Reversal Ltd', invoice_ref: 'RV-100', invoice_date: '2026-08-10', amount: 50000, doc_number: 'D100' });
  const credit = (o: Partial<InvoiceRow> = {}) => row({ ...orig, amount: -50000, invoice_date: '2026-08-12', doc_number: 'D101', ...o });
  const repost = (o: Partial<InvoiceRow> = {}) => row({ ...orig, invoice_date: '2026-08-16', doc_number: 'D102', ...o });

  it('control: the original and a re-posting with the same number and amount ARE a duplicate', () => {
    expect(detect([orig, repost()])).toHaveLength(1);
  });

  it('reversed_with on the original: original and its credit are reversed, the re-posting is not flagged', () => {
    const rows = [row({ ...orig, reversed_with: 'D101' }), credit(), repost()];
    expect(findReversals(rows)).toEqual([true, true, false]);
    expect(detect(rows)).toEqual([]);
  });

  it('only an offsetting credit (no reversed_with): the earliest invoice is reversed, the re-posting stays live', () => {
    const rows = [repost(), credit(), orig]; // order in the file does not matter
    expect(findReversals(rows)).toEqual([false, true, true]);
    expect(detect(rows)).toEqual([]);
  });

  it('a re-posting is still compared with other live invoices', () => {
    const rows = [row({ ...orig, reversed_with: 'D101' }), credit(), repost(), repost({ doc_number: 'D103', invoice_date: '2026-08-18' })];
    expect(detect(rows)).toHaveLength(1); // the two re-postings are real duplicates of each other
  });

  it('prefers the credit whose doc number is the reversal document named on the original', () => {
    const rows = [row({ ...orig, reversed_with: 'D999' }), credit({ doc_number: 'D101' }), credit({ doc_number: 'D999' }), repost()];
    expect(findReversals(rows)).toEqual([true, false, true, false]);
  });

  it('a credit reverses at most one invoice', () => {
    const rows = [orig, repost(), credit()];
    expect(findReversals(rows)).toEqual([true, false, true]);
  });

  it('a credit with a different amount, number or vendor reverses nothing', () => {
    expect(findReversals([orig, credit({ amount: -49999 })])).toEqual([false, false]);
    expect(findReversals([orig, credit({ invoice_ref: 'RV-101' })])).toEqual([false, false]);
    expect(findReversals([orig, credit({ vendor_id: 'V8' })])).toEqual([false, false]);
  });

  it('a credit dated before the invoice does not reverse it', () => {
    expect(findReversals([orig, credit({ invoice_date: '2026-08-01' })])).toEqual([false, false]);
  });

  it('matches reference formats after normalization', () => {
    expect(findReversals([orig, credit({ invoice_ref: 'rv 100' })])).toEqual([true, true]);
  });

  it('credit lines are never compared as duplicates of each other or of invoices', () => {
    expect(detect([credit(), credit({ doc_number: 'D200' })])).toEqual([]);
    expect(detect([row({ ...orig, amount: 50000 }), credit({ invoice_date: '2026-08-02' })])).toEqual([]);
  });

  it('does not offer reversed invoices to the vendor matcher', () => {
    const a = row({ vendor_id: 'V1', vendor_name: 'Bosch Ltd', invoice_ref: 'X-1', amount: 900 });
    const b = row({ vendor_id: 'V2', vendor_name: 'BOSCH LIMITED', invoice_ref: 'X-1', amount: 900 });
    expect(findVendorCandidates([a, b])).toHaveLength(1);
    expect(findVendorCandidates([a, b, row({ ...a, amount: -900, invoice_date: '2026-09-30' })])).toHaveLength(0);
  });
});

describe('credit lines and reversal columns on upload', () => {
  const rec = (o: Record<string, string>) => ({ 'Company Code': '1000', Vendor: 'V1', Name: 'A', 'Invoice no': 'I-1', 'Invoice date': '2026-08-01', Amount: '100.00', 'Doc no': 'D1', ...o });
  const map = autoMap(['Company Code', 'Vendor', 'Name', 'Invoice no', 'Invoice date', 'Amount', 'Doc no', 'STBLG']);

  it('maps SAP synonyms for reversed with', () => {
    expect(map.reversed_with).toBe('STBLG');
    for (const h of ['Reversed with', 'reversed_with', 'Reversal doc', 'Reversal Document']) {
      expect(autoMap(['Vendor', 'Invoice no', 'Amount', h]).reversed_with).toBe(h);
    }
  });

  it('keeps negative amounts as credit lines and still skips zero lines', () => {
    const { rows, skipped } = toInvoiceRows([rec({}), rec({ Amount: '(100.00)', 'Doc no': 'D2' }), rec({ Amount: '100.00-', 'Doc no': 'D3' }), rec({ Amount: '0', 'Doc no': 'D4' })], map);
    expect(rows.map((r) => r.amount)).toEqual([100, -100, -100]);
    expect(skipped).toBe(1);
  });

  it('carries reversed_with through', () => {
    const { rows } = toInvoiceRows([rec({ STBLG: ' 5100000999 ' }), rec({ 'Doc no': 'D2' })], map);
    expect(rows.map((r) => r.reversed_with)).toEqual(['5100000999', '']);
  });
});

import { describe, it, expect } from 'vitest';
import { suggestedAction, detect, normalizeRef, normalizeVendor, jaroWinkler, vendorPairKey, findVendorCandidates, type InvoiceRow } from '@/lib/detect';

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
  it('needs AI confirmation before pairing different vendor IDs', () => {
    const rows = [row({}), row({ vendor_id: 'V2', vendor_name: 'Robert Bosch India', doc_number: 'D2', po_number: '' })];
    expect(detect(rows)).toHaveLength(0);
    const r = detect(rows, new Set([vendorPairKey('V1', 'V2')]));
    expect(r[0].type).toBe('Alternate vendor ID');
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
    expect(suggestedAction(['R1', 'R3', 'R5', 'R6'])).toBe('Block invoice B');
  });
  it('blocks a same-number pair with an amount within 1%', () => {
    expect(suggestedAction(['R1', 'R4', 'R5'])).toBe('Block invoice B');
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

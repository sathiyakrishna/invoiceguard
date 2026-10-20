import { describe, it, expect } from 'vitest';
import { detect, findVendorCandidates, isPlaceholderRef, vendorPairKey, type InvoiceRow } from '@/lib/detect';

const base: InvoiceRow = {
  company_code: '1000', vendor_id: 'V1', vendor_name: 'Kaveri Steel Ltd', invoice_ref: 'KS-100',
  invoice_date: '2026-09-02', amount: 125000, currency: 'INR', po_number: '4500012345', doc_number: 'D1'
};
const row = (o: Partial<InvoiceRow>): InvoiceRow => ({ ...base, ...o });

describe('currency', () => {
  it('does not flag the same number and figure in two currencies', () => {
    expect(detect([row({ doc_number: 'D1', currency: 'INR' }), row({ doc_number: 'D2', currency: 'USD' })])).toHaveLength(0);
  });
  it('still flags a repeat in the same currency, including non-INR', () => {
    expect(detect([row({ doc_number: 'D1', currency: 'USD' }), row({ doc_number: 'D2', currency: 'USD' })])).toHaveLength(1);
  });
  it('ignores case and treats a blank currency as unknown, not as a different currency', () => {
    const rows = [row({ doc_number: 'D1', currency: 'INR' }), row({ doc_number: 'D2', currency: 'inr' }), row({ doc_number: 'D3', currency: '' })];
    expect(detect(rows)).toHaveLength(3);
  });
  it('applies to near amounts and to typo pairs as well', () => {
    expect(detect([row({ doc_number: 'D1', amount: 100000 }), row({ doc_number: 'D2', amount: 100400, currency: 'USD' })])).toHaveLength(0);
    expect(detect([row({ doc_number: 'D1', invoice_ref: 'LT40417' }), row({ doc_number: 'D2', invoice_ref: 'LT40471', currency: 'EUR' })])).toHaveLength(0);
  });
  it('does not offer alias vendor accounts to the AI when the currencies differ', () => {
    const a = row({ doc_number: 'D1', vendor_id: 'V1', vendor_name: 'Kaveri Steel Ltd' });
    const b = row({ doc_number: 'D2', vendor_id: 'V2', vendor_name: 'KAVERI STEEL LIMITED' });
    expect(findVendorCandidates([a, b])).toHaveLength(1);
    expect(findVendorCandidates([a, { ...b, currency: 'USD' }])).toHaveLength(0);
    // and an alias pair in a different currency is not flagged even if the AI had confirmed it
    expect(detect([a, { ...b, currency: 'USD' }], new Set([vendorPairKey('V1', 'V2')]))).toHaveLength(0);
  });
});

describe('placeholder invoice numbers', () => {
  const placeholders = ['', ' ', '-', '--', '.', '/', '0', '00', '000', 'N/A', 'n/a', 'NA', 'N.A.', 'n.a', 'NIL', 'nil', 'None', 'NULL', 'TBD', 'tbd', 'TBC',
    'Not Available', 'NOT APPLICABLE', 'No Ref', 'No invoice', 'Unknown', 'XXXX', 'xx', 'TEST'];
  it.each(placeholders)('treats %j as a placeholder', (ref) => {
    expect(isPlaceholderRef(ref)).toBe(true);
  });

  const realRefs = ['NA-1001', 'NA1001', 'TBD-77', '0012', 'INV-0', 'A0', 'N1', 'X-1', 'KS-100', '10', 'REF-22', 'TESTA1'];
  it.each(realRefs)('keeps %j as a real invoice number', (ref) => {
    expect(isPlaceholderRef(ref)).toBe(false);
  });

  it.each(['N/A', 'NA', 'NIL', 'TBD', '-', '0', ''])('does not flag two invoices that both say %j', (ref) => {
    const rows = [row({ doc_number: 'D1', invoice_ref: ref }), row({ doc_number: 'D2', invoice_ref: ref, invoice_date: '2026-09-04' })];
    expect(detect(rows)).toHaveLength(0);
  });

  it('does not match a placeholder against a different placeholder spelling either', () => {
    expect(detect([row({ doc_number: 'D1', invoice_ref: 'N/A' }), row({ doc_number: 'D2', invoice_ref: 'n.a.' })])).toHaveLength(0);
  });

  it('still flags real numbers that merely start with a placeholder word', () => {
    expect(detect([row({ doc_number: 'D1', invoice_ref: 'NA-1001' }), row({ doc_number: 'D2', invoice_ref: 'NA1001' })])).toHaveLength(1);
    expect(detect([row({ doc_number: 'D1', invoice_ref: 'TBD-77' }), row({ doc_number: 'D2', invoice_ref: 'tbd 77' })])).toHaveLength(1);
  });

  it('does not offer alias vendor accounts to the AI on a placeholder number', () => {
    const a = row({ doc_number: 'D1', invoice_ref: 'N/A' });
    const b = row({ doc_number: 'D2', invoice_ref: 'N/A', vendor_id: 'V2', vendor_name: 'KAVERI STEEL LIMITED' });
    expect(findVendorCandidates([a, b])).toHaveLength(0);
  });
});

import type { InvoiceRow } from './detect';

export const FIELDS = [
  { key: 'company_code', label: 'Company code', required: false },
  { key: 'vendor_id', label: 'Vendor ID', required: true },
  { key: 'vendor_name', label: 'Vendor name', required: false },
  { key: 'invoice_ref', label: 'Invoice number', required: true },
  { key: 'invoice_date', label: 'Invoice date', required: false },
  { key: 'amount', label: 'Gross amount', required: true },
  { key: 'currency', label: 'Currency', required: false },
  { key: 'po_number', label: 'PO number', required: false },
  { key: 'doc_number', label: 'Document number', required: false },
  { key: 'reversed_with', label: 'Reversed with', required: false },
  { key: 'clearing_date', label: 'Clearing date', required: false },
  { key: 'clearing_document', label: 'Clearing document', required: false }
] as const;

export type FieldKey = (typeof FIELDS)[number]['key'];
export type Mapping = Partial<Record<FieldKey, string>>;

// Header synonyms, including SAP technical field names from FBL1N / BSIK exports
const SYNONYMS: Record<FieldKey, string[]> = {
  company_code: ['company_code', 'company code', 'cocd', 'co code', 'bukrs', 'cc'],
  vendor_id: ['vendor_id', 'vendor id', 'vendor', 'vendor no', 'vendor number', 'vendor code', 'supplier id', 'supplier code', 'lifnr', 'account'],
  vendor_name: ['vendor_name', 'vendor name', 'supplier name', 'name', 'name1', 'name 1'],
  invoice_ref: ['invoice_ref', 'invoice ref', 'invoice no', 'invoice number', 'invoice', 'reference', 'xblnr', 'ref', 'supplier invoice'],
  invoice_date: ['invoice_date', 'invoice date', 'document date', 'doc date', 'bldat', 'date'],
  amount: ['amount', 'gross amount', 'invoice amount', 'amount in dc', 'amount in lc', 'wrbtr', 'dmbtr', 'value'],
  currency: ['currency', 'curr', 'crcy', 'waers'],
  po_number: ['po_number', 'po number', 'po', 'purchase order', 'ebeln', 'purchasing document'],
  doc_number: ['doc_number', 'doc number', 'document number', 'document no', 'belnr', 'doc no', 'fi document'],
  reversed_with: ['reversed_with', 'reversed with', 'reversal doc', 'reversal document', 'stblg'],
  clearing_date: ['clearing_date', 'clearing date', 'clrng date', 'augdt'],
  clearing_document: ['clearing_document', 'clearing document', 'clearing doc', 'clrng doc', 'augbl']
};

const clean = (h: string) => h.toLowerCase().replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();

export function autoMap(headers: string[]): Mapping {
  const map: Mapping = {};
  const used = new Set<string>();
  for (const f of FIELDS) {
    const syn = SYNONYMS[f.key].map(clean);
    const hit = headers.find((h) => !used.has(h) && syn.includes(clean(h)));
    if (hit) {
      map[f.key] = hit;
      used.add(hit);
    }
  }
  return map;
}

export function parseAmount(v: unknown): number {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  let s = String(v ?? '').trim().replace(/[₹$€£\s]|INR|Rs\.?/gi, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234.567,89
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round((neg ? -n : n) * 100) / 100;
}

export function parseDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/); // Indian/SAP order: DD.MM.YYYY
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return iso(y, +m[2], +m[1]);
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return dt.toISOString().slice(0, 10);
}

export type RowError = { row: number; message: string };

export function toInvoiceRows(records: Record<string, unknown>[], map: Mapping): { rows: InvoiceRow[]; errors: RowError[]; skipped: number } {
  const rows: InvoiceRow[] = [];
  const errors: RowError[] = [];
  let skipped = 0;
  const get = (r: Record<string, unknown>, k: FieldKey) => (map[k] ? r[map[k] as string] : undefined);
  records.forEach((r, idx) => {
    const line = idx + 2; // header is line 1
    const vendor = String(get(r, 'vendor_id') ?? '').trim();
    const ref = String(get(r, 'invoice_ref') ?? '').trim();
    const rawAmount = get(r, 'amount');
    if (!vendor && !ref && (rawAmount === undefined || rawAmount === '')) { skipped++; return; }
    const amount = parseAmount(rawAmount);
    if (!vendor) { if (errors.length < 50) errors.push({ row: line, message: 'Vendor ID is empty' }); return; }
    if (!ref) { if (errors.length < 50) errors.push({ row: line, message: 'Invoice number is empty' }); return; }
    if (Number.isNaN(amount)) { if (errors.length < 50) errors.push({ row: line, message: `Amount "${String(rawAmount)}" is not a number` }); return; }
    if (amount === 0) { skipped++; return; } // zero lines carry nothing; negative amounts are kept as credit lines (never compared as duplicates)
    const rawDate = get(r, 'invoice_date');
    const date = parseDate(rawDate);
    if (rawDate && String(rawDate).trim() && !date && errors.length < 50) errors.push({ row: line, message: `Date "${String(rawDate)}" not recognised, row kept without a date` });
    const rawClearing = get(r, 'clearing_date');
    const clearingDate = parseDate(rawClearing);
    if (rawClearing && String(rawClearing).trim() && !clearingDate && errors.length < 50) errors.push({ row: line, message: `Clearing date "${String(rawClearing)}" not recognised, row kept as open` });
    rows.push({
      company_code: String(get(r, 'company_code') ?? '').trim().slice(0, 20),
      vendor_id: vendor.slice(0, 40),
      vendor_name: String(get(r, 'vendor_name') ?? '').trim().slice(0, 120),
      invoice_ref: ref.slice(0, 60),
      invoice_date: date,
      amount,
      currency: String(get(r, 'currency') ?? 'INR').trim().slice(0, 5) || 'INR',
      po_number: String(get(r, 'po_number') ?? '').trim().slice(0, 20),
      doc_number: String(get(r, 'doc_number') ?? '').trim().slice(0, 20),
      reversed_with: String(get(r, 'reversed_with') ?? '').trim().slice(0, 20),
      clearing_date: clearingDate,
      clearing_document: String(get(r, 'clearing_document') ?? '').trim().slice(0, 20)
    });
  });
  return { rows, errors, skipped };
}

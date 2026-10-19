// Generates public/sample_register.csv (2,000 invoices), public/sample_register.pdf (the same rows as a text PDF)
// and answer_key.csv (planted cases).
// Usage: npm run sample
import { writeFileSync } from 'fs';

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pad = (n, w) => String(n).padStart(w, '0');

const NAMES = ['Bosch Ltd', 'Tata Steel Ltd', 'Sundaram Fasteners Ltd', 'Minda Industries Ltd', 'Lucas TVS Ltd', 'Exide Industries Ltd', 'Wipro Ltd', 'Mahindra Logistics Ltd', 'Bharat Forge Ltd', 'Motherson Sumi Systems Ltd', 'Amara Raja Batteries Ltd', 'Endurance Technologies Ltd', 'Rane Brake Lining Ltd', 'Sona Comstar Ltd', 'Gabriel India Ltd', 'Subros Ltd', 'Jamna Auto Industries Ltd', 'Lumax Industries Ltd', 'Varroc Engineering Ltd', 'Schaeffler India Ltd', 'SKF India Ltd', 'Timken India Ltd', 'Asahi India Glass Ltd', 'Apollo Tyres Ltd', 'JK Tyre & Industries Ltd', 'Ceat Ltd', 'Hindalco Industries Ltd', 'JSW Steel Ltd', 'Castrol India Ltd', 'Gulf Oil Lubricants India Ltd', 'Blue Dart Express Ltd', 'Gati Ltd', 'TCI Freight', 'Prestige Estates Projects Ltd', 'Sodexo Food Solutions India Pvt Ltd', 'G4S Secure Solutions India Pvt Ltd', 'Infosys BPM Ltd', 'Tech Mahindra Ltd', 'HCL Infosystems Ltd', 'Siemens Ltd', 'ABB India Ltd', 'Cummins India Ltd', 'Kirloskar Pneumatic Co Ltd', 'Thermax Ltd', 'Graphite India Ltd', 'Carborundum Universal Ltd', 'Grindwell Norton Ltd', 'Supreme Industries Ltd', 'Finolex Cables Ltd', 'Polycab India Ltd'];
const PREFIX = (n) => n.replace(/[^A-Z]/g, '').slice(0, 2) || 'IN';

const vendors = [];
for (let i = 0; i < 160; i++) {
  const name = i < NAMES.length ? NAMES[i] : `${pick(['Shree', 'Sri', 'Om', 'Jai', 'Balaji', 'Ganesh', 'Lakshmi', 'Vinayak'])} ${pick(['Engineering', 'Precision', 'Auto Components', 'Castings', 'Packaging', 'Tools', 'Polymers', 'Electricals', 'Logistics', 'Forgings'])} ${pick(['Pvt Ltd', 'Ltd', 'LLP', 'Works'])}`;
  vendors.push({ id: `V${10000 + i * 7}`, name, prefix: PREFIX(name.toUpperCase()) + (i % 10), next: 1000 + Math.floor(rnd() * 8000) });
}

const start = Date.UTC(2026, 7, 1); // 1 Aug 2026
const day = 86_400_000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
let docFI = 5100000001, docMM = 1900000001, docClr = 2000000001;
const rows = [];

// Payment history: a paid invoice has a clearing date (10-30 days after the invoice date) and a clearing document.
// A payment date is never in the future (AS_OF is the sample's "today"). An ordinary invoice whose payment would land
// after AS_OF is simply still open. A planted original must be paid by design, so its date is capped at AS_OF instead.
const AS_OF = '2026-10-19';
const markPaid = (r, mustBePaid = false) => {
  const due = Date.parse(r.invoice_date) + (10 + Math.floor(rnd() * 21)) * day;
  if (due > Date.parse(AS_OF) && !mustBePaid) return r;
  r.clearing_date = iso(Math.min(due, Date.parse(AS_OF)));
  r.clearing_document = String(docClr++);
  return r;
};

function addRow(r) { rows.push(r); return r; }
function base(v, extra = {}) {
  const hasPO = rnd() < 0.7;
  const dateT = start + Math.floor(rnd() * 75) * day;
  const paid = rnd() < 0.88; // ~80% of these can be paid by AS_OF (later ones stay open), so about 70% of invoices end up paid
  const r = {
    company_code: rnd() < 0.8 ? '1000' : '2000',
    vendor_id: v.id,
    vendor_name: v.name,
    invoice_ref: `${v.prefix}-${v.next++}`,
    invoice_date: iso(dateT),
    amount: Math.round((5000 + rnd() * 900000) * 100) / 100,
    currency: 'INR',
    po_number: hasPO ? `45000${pad(Math.floor(rnd() * 99999), 5)}` : '',
    doc_number: String(hasPO ? docFI++ : docMM++),
    reversed_with: '',
    clearing_date: '',
    clearing_document: '',
    ...extra
  };
  return paid ? markPaid(r) : r;
}
const markOpen = (r) => { r.clearing_date = ''; r.clearing_document = ''; return r; };

const TARGET = 2000, PLANTED = 25, TRAPS = 5, REVERSED_TRAPS = 3;
for (let i = 0; i < TARGET - PLANTED - TRAPS * 2 - 3 - REVERSED_TRAPS * 3; i++) addRow(base(pick(vendors)));

const key = [];
const later = (d, n) => iso(Date.parse(d) + n * day);
// every planted duplicate: the original was paid in an earlier run, the duplicate is open in this one
const plant = (type, orig, dup) => { markPaid(orig, true); addRow(markOpen(dup)); key.push({ type, vendor: orig.vendor_id, original_ref: orig.invoice_ref, duplicate_ref: dup.invoice_ref, amount: dup.amount, expected: 'Yes' }); };
const sample = () => rows[Math.floor(rnd() * (rows.length - 1))];

for (let i = 0; i < 6; i++) { const o = sample(); plant('Reference format', o, { ...o, invoice_ref: o.invoice_ref.replace('-', pick(['', '/', ' '])), invoice_date: later(o.invoice_date, 2 + i), doc_number: String(docFI++) }); }
for (let i = 0; i < 4; i++) { const o = sample(); const r = o.invoice_ref; const t = r.slice(0, -2) + r.slice(-1) + r.slice(-2, -1); plant('Typo in reference', o, { ...o, invoice_ref: t === r ? r + 'A' : t, invoice_date: later(o.invoice_date, 5), doc_number: String(docFI++) }); }
for (let i = 0; i < 5; i++) { const o = sample(); plant('Cross company code', o, { ...o, company_code: o.company_code === '1000' ? '2000' : '1000', invoice_date: later(o.invoice_date, 1), doc_number: String(docFI++) }); }
for (let i = 0; i < 4; i++) { const o = sample(); plant('PO vs non-PO', o, { ...o, po_number: o.po_number ? '' : '4500099' + pad(i, 3), invoice_date: later(o.invoice_date, 3), doc_number: String(docMM++) }); }
for (let i = 0; i < 3; i++) { const o = sample(); plant('Near amount', o, { ...o, amount: Math.round(o.amount * 0.998 * 100) / 100, invoice_date: later(o.invoice_date, 4), doc_number: String(docFI++) }); }
// alternate vendor accounts (needs AI vendor matching)
const alts = [['Bosch Ltd', 'V90001', 'BOSCH LIMITED'], ['Tata Steel Ltd', 'V90002', 'TATA STEEL LIMITED'], ['Exide Industries Ltd', 'V90003', 'Exide Industries Limited']];
for (const [orig, id, alias] of alts) {
  const v = vendors.find((x) => x.name === orig);
  const o = addRow(base(v));
  plant('Alternate vendor account', o, { ...o, vendor_id: id, vendor_name: alias, invoice_date: later(o.invoice_date, 6), doc_number: String(docMM++) });
}
// traps: monthly rent and retainers, same amount, different months and references
for (let i = 0; i < TRAPS; i++) {
  const v = vendors[33 + i];
  const amt = [350000, 125000, 89000, 64000, 42000][i];
  const a = addRow(base(v, { invoice_ref: `${v.prefix}-RENT-AUG`, invoice_date: '2026-08-01', amount: amt, po_number: '' }));
  addRow(base(v, { invoice_ref: `${v.prefix}-RENT-SEP`, invoice_date: '2026-09-01', amount: amt, po_number: '' }));
  key.push({ type: 'Trap: recurring charge', vendor: v.id, original_ref: a.invoice_ref, duplicate_ref: a.invoice_ref.replace('AUG', 'SEP'), amount: amt, expected: 'No (should not be flagged, or dismiss)' });
}

// traps: booked, reversed and re-posted. Original invoice, its reversal credit, then the corrected re-posting
// with the same number and amount. None of the three may be flagged. Traps 1 and 2 carry reversed_with (SAP
// STBLG) on the original; trap 3 has only the offsetting credit.
for (let i = 0; i < REVERSED_TRAPS; i++) {
  const v = vendors[40 + i];
  const o = addRow(base(v));
  const creditDoc = String(docFI++);
  if (i < 2) o.reversed_with = creditDoc;
  // the invoice is cleared against its reversal credit on the credit's date; the re-posting is open
  const creditDate = later(o.invoice_date, 2);
  Object.assign(o, { clearing_date: creditDate, clearing_document: creditDoc });
  addRow({ ...o, amount: -o.amount, invoice_date: creditDate, doc_number: creditDoc, reversed_with: '' });
  addRow(markOpen({ ...o, invoice_date: later(o.invoice_date, 6), doc_number: String(docFI++), reversed_with: '' }));
  key.push({ type: 'Trap: booked, reversed and re-posted', vendor: v.id, original_ref: o.invoice_ref, duplicate_ref: o.invoice_ref, amount: o.amount, expected: i < 2 ? 'No (reversed_with on the original)' : 'No (offsetting credit only)' });
}

// shuffle
for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }

const cols = ['company_code', 'vendor_id', 'vendor_name', 'invoice_ref', 'invoice_date', 'amount', 'currency', 'po_number', 'doc_number', 'reversed_with', 'clearing_date', 'clearing_document'];
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
writeFileSync('public/sample_register.csv', [cols.join(','), ...rows.map((r) => cols.map((c) => esc(c === 'amount' ? r[c].toFixed(2) : (r[c] ?? ''))).join(','))].join('\n') + '\n');

// The same register as a text-based PDF: A4 landscape, one table, heading row repeated on every page, amounts right-aligned.
const PDF_COLS = [['company_code', 30], ['vendor_id', 90], ['vendor_name', 135], ['invoice_ref', 275], ['invoice_date', 340], ['amount', 440, 'right'], ['currency', 455], ['po_number', 500], ['doc_number', 555], ['reversed_with', 615], ['clearing_date', 680], ['clearing_document', 740]];
const PER_PAGE = 40, ROW_H = 12, SIZE = 7;
const pdfEsc = (s) => String(s).replace(/[\\()]/g, '\\$&');
const textWidth = (s) => [...s].reduce((w, ch) => w + (/\d/.test(ch) ? 0.556 : ch === '.' ? 0.278 : ch === '-' ? 0.333 : 0.5), 0) * SIZE; // Helvetica digit widths
const pdfRow = (values, y) => PDF_COLS.map(([, x, align], i) => {
  const v = String(values[i] ?? '');
  return v ? `BT /F1 ${SIZE} Tf ${(align === 'right' ? x - textWidth(v) : x).toFixed(1)} ${y} Td (${pdfEsc(v)}) Tj ET` : '';
}).filter(Boolean).join('\n');
const pages = [];
for (let i = 0; i < rows.length; i += PER_PAGE) pages.push(rows.slice(i, i + PER_PAGE));
const streams = pages.map((part, p) => [
  `BT /F1 10 Tf 30 560 Td (Vendor invoice register - payment run) Tj ET`,
  pdfRow(cols, 535),
  ...part.map((r, k) => pdfRow(cols.map((c) => (c === 'amount' ? r[c].toFixed(2) : (r[c] ?? ''))), 521 - k * ROW_H)),
  `BT /F1 7 Tf 30 20 Td (Page ${p + 1} of ${pages.length}) Tj ET`
].join('\n'));
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, p) => `${4 + 2 * p} 0 R`).join(' ')}] /Count ${pages.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
streams.forEach((s, p) => {
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * p} 0 R >>`);
  objects.push(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
});
let pdf = '%PDF-1.4\n';
const offsets = objects.map((o, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
if (/[^\x00-\x7f]/.test(pdf)) throw new Error('PDF content must be ASCII so string length equals byte length');
writeFileSync('public/sample_register.pdf', pdf, 'latin1');

const kc = ['type', 'vendor', 'original_ref', 'duplicate_ref', 'amount', 'expected'];
writeFileSync('answer_key.csv', [kc.join(','), ...key.map((k) => kc.map((c) => esc(k[c])).join(','))].join('\n') + '\n');
console.log(`sample_register.pdf: ${pages.length} pages, same rows`);
console.log(`sample_register.csv: ${rows.length} invoices, ${key.filter((k) => k.expected === 'Yes').length} planted duplicates, ${TRAPS} recurring traps, ${REVERSED_TRAPS} reversed-and-reposted traps`);

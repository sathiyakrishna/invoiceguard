// Generates public/sample_register.csv (2,000 invoices) and answer_key.csv (planted cases).
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
let docFI = 5100000001, docMM = 1900000001;
const rows = [];

function addRow(r) { rows.push(r); return r; }
function base(v, extra = {}) {
  const hasPO = rnd() < 0.7;
  const dateT = start + Math.floor(rnd() * 75) * day;
  return {
    company_code: rnd() < 0.8 ? '1000' : '2000',
    vendor_id: v.id,
    vendor_name: v.name,
    invoice_ref: `${v.prefix}-${v.next++}`,
    invoice_date: iso(dateT),
    amount: Math.round((5000 + rnd() * 900000) * 100) / 100,
    currency: 'INR',
    po_number: hasPO ? `45000${pad(Math.floor(rnd() * 99999), 5)}` : '',
    doc_number: String(hasPO ? docFI++ : docMM++),
    ...extra
  };
}

const TARGET = 2000, PLANTED = 25, TRAPS = 5;
for (let i = 0; i < TARGET - PLANTED - TRAPS * 2 - 3; i++) addRow(base(pick(vendors)));

const key = [];
const later = (d, n) => iso(Date.parse(d) + n * day);
const plant = (type, orig, dup) => { addRow(dup); key.push({ type, vendor: orig.vendor_id, original_ref: orig.invoice_ref, duplicate_ref: dup.invoice_ref, amount: dup.amount, expected: 'Yes' }); };
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

// shuffle
for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }

const cols = ['company_code', 'vendor_id', 'vendor_name', 'invoice_ref', 'invoice_date', 'amount', 'currency', 'po_number', 'doc_number'];
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
writeFileSync('public/sample_register.csv', [cols.join(','), ...rows.map((r) => cols.map((c) => esc(c === 'amount' ? r[c].toFixed(2) : r[c])).join(','))].join('\n') + '\n');
const kc = ['type', 'vendor', 'original_ref', 'duplicate_ref', 'amount', 'expected'];
writeFileSync('answer_key.csv', [kc.join(','), ...key.map((k) => kc.map((c) => esc(k[c])).join(','))].join('\n') + '\n');
console.log(`sample_register.csv: ${rows.length} invoices, ${key.filter((k) => k.expected === 'Yes').length} planted duplicates, ${TRAPS} traps`);

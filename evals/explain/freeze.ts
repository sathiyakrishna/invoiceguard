// Freezes the explanations from an eval run so the hand labels always refer to the same text.
// Cases above LABELLED (the extra flawed ones, #41 and up) are frozen too but get no row to label, because they are wrong by construction.
//   tsx evals/explain/freeze.ts [results.json] [--force]
// Writes explanations.json, labeling-sheet.md (what you read) and human-labels.csv (what you fill in).
// It refuses to overwrite existing files unless --force, because labels are tied to the frozen text.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { recordFromResult } from './judge-core';

const args = process.argv.slice(2);
const force = args.includes('--force');
const file = args.find((a) => !a.startsWith('--')) ?? 'evals/explain/results.json';
const LABELLED = 40;
const OUT = { json: 'evals/explain/explanations.json', sheet: 'evals/explain/labeling-sheet.md', csv: 'evals/explain/human-labels.csv' };
if (!force && [OUT.json, OUT.csv].some(existsSync)) {
  console.error('explanations.json or human-labels.csv already exists. They are tied together; pass --force to replace both (your labels will be lost).');
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, 'utf8'));
const rows: any[] = data.results?.results ?? data.results ?? [];
const frozen = rows.map((r) => recordFromResult(r))
  .sort((x, y) => x.n - y.n)
  .map((r) => ({ n: r.n, kind: r.kind, flaw: r.flaw, input: r.input, explanation: r.explanation }));
if (frozen.length !== 50) { console.error(`expected 50 cases, found ${frozen.length}`); process.exit(1); }
writeFileSync(OUT.json, JSON.stringify(frozen, null, 2));

const field = (s: Record<string, string>) => [`vendor ${s.vendor_name} (${s.vendor_id})`, `invoice ${s.invoice_no}`, `date ${s.invoice_date}`, `amount ${s.amount}`,
  `company code ${s.company_code}`, `PO ${s.po_number || '(none)'}`, `doc ${s.doc_number}`, s.cleared_on ? `PAID on ${s.cleared_on}` : 'open'].join(' · ');

const sheet: string[] = [
  '# Labelling sheet: 40 explanations',
  '',
  'Fill in `human-labels.csv`, one row per number below. For each check enter `P` (pass) or `F` (fail). `NA` is already filled where a check does not apply.',
  'Label from the pair data and the explanation only. Do not look at any judge output first.',
  '',
  '| Column | Pass (`P`) when |',
  '|---|---|',
  '| `a` | Every fact in the explanation (names, numbers, dates, causes) is in the pair data. Fail if anything is invented or changed. |',
  '| `b1` | High and Medium pairs only: the explanation never calls the pair uncertain, unclear or unsure, and never suggests it may be legitimate. Fail otherwise. |',
  '| `b2` | Low pairs only: the explanation does not claim certainty that it is a duplicate. Saying it could be legitimate and is worth a quick check is fine. Fail if it speaks as if it is certain. |',
  '| `c` | The conclusion fits the suggested action. "Block the open invoice": plainly the same invoice entered twice (or a repeat of one already paid). "Check with supplier": the duplicate evidence plus a reason the supplier should confirm first. |',
  '| `d` | The explanation does not claim InvoiceGuard blocks, holds, releases or pays anything, or acts in the ERP. |',
  ''
];
const csv: string[] = ['n,risk,action,a,b1,b2,c,d'];
for (const r of frozen.filter((x) => x.n <= LABELLED)) {
  const i = r.input;
  sheet.push(`## #${r.n} · ${i.risk} risk (score ${i.score}) · suggested action: ${i.action}`, '',
    `Rules: ${i.rules.join('; ')}`, `- A: ${field(i.a)}`, `- B: ${field(i.b)}`, '', `> ${r.explanation}`, '');
  const high = i.risk === 'High' || i.risk === 'Medium';
  csv.push([r.n, i.risk, `"${i.action}"`, '', high ? '' : 'NA', high ? 'NA' : '', '', ''].join(','));
}
writeFileSync(OUT.sheet, sheet.join('\n'));
writeFileSync(OUT.csv, csv.join('\n') + '\n');
console.log(`Wrote ${OUT.json}, ${OUT.sheet} and ${OUT.csv} (${frozen.length} explanations).`);

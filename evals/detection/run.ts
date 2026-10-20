// Detection eval: scores lib/detect.ts against labelled scenarios. Rules only, no AI, no network.
//   npm run eval:detection            prints the report, writes evals/detection/results.json, exits 1 below the thresholds
// Thresholds can be overridden with EVAL_MIN_PRECISION / EVAL_MIN_RECALL.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import Papa from 'papaparse';
import { detect, vendorPairKey, type Band, type SuggestedAction, suggestedAction } from '../../lib/detect';
import { autoMap, toInvoiceRows } from '../../lib/parse';
import { SCENARIOS, type Scenario } from './cases';

const MIN_PRECISION = Number(process.env.EVAL_MIN_PRECISION ?? 0.95);
const MIN_RECALL = Number(process.env.EVAL_MIN_RECALL ?? 0.95);

type Counts = { tp: number; fp: number; fn: number };
type Miss = { scenario: string; kind: 'missed' | 'false flag' | 'band' | 'action'; detail: string };

const key = (a: string, b: string) => [a, b].sort().join('+');
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
const ratio = (n: number, d: number) => (d ? n / d : null);

function run(s: Scenario) {
  const sameSupplier = new Set((s.sameSupplier ?? []).map(([a, b]) => vendorPairKey(a, b)));
  const found = detect(s.rows, sameSupplier).map((c) => ({
    docs: key(s.rows[c.a].doc_number, s.rows[c.b].doc_number), band: c.band as Band, rules: c.rules, action: suggestedAction(c.rules) as SuggestedAction
  }));
  const want = new Map(s.expect.map((e) => [key(...e.docs), e]));
  const c: Counts = { tp: 0, fp: 0, fn: 0 };
  const misses: Miss[] = [];
  let bandChecks = 0, bandOk = 0, actionChecks = 0, actionOk = 0;
  for (const f of found) {
    const e = want.get(f.docs);
    if (!e) { c.fp++; misses.push({ scenario: s.id, kind: 'false flag', detail: `${f.docs} flagged ${f.band} (${f.rules.join('+')})` }); continue; }
    c.tp++;
    if (e.band) { bandChecks++; if (e.band === f.band) bandOk++; else misses.push({ scenario: s.id, kind: 'band', detail: `${f.docs} expected ${e.band}, got ${f.band} (${f.rules.join('+')})` }); }
    if (e.action) { actionChecks++; if (e.action === f.action) actionOk++; else misses.push({ scenario: s.id, kind: 'action', detail: `${f.docs} expected "${e.action}", got "${f.action}"` }); }
  }
  for (const [docs] of want) if (!found.some((f) => f.docs === docs)) { c.fn++; misses.push({ scenario: s.id, kind: 'missed', detail: `${docs} not flagged` }); }
  return { c, misses, bandChecks, bandOk, actionChecks, actionOk, pass: c.fp === 0 && c.fn === 0 && bandOk === bandChecks && actionOk === actionChecks };
}

const add = (t: Counts, c: Counts) => { t.tp += c.tp; t.fp += c.fp; t.fn += c.fn; };
const prec = (c: Counts) => ratio(c.tp, c.tp + c.fp);
const rec = (c: Counts) => ratio(c.tp, c.tp + c.fn);
const f1 = (c: Counts) => { const p = prec(c), r = rec(c); return p !== null && r !== null && p + r > 0 ? (2 * p * r) / (p + r) : null; };
const show = (x: number | null) => (x === null ? 'n/a' : `${(100 * x).toFixed(1)}%`);

const byCategory = new Map<string, { c: Counts; scenarios: number; passed: number }>();
const gated: Counts = { tp: 0, fp: 0, fn: 0 };
const everything: Counts = { tp: 0, fp: 0, fn: 0 };
const failures: Miss[] = [];
const gaps: Array<{ id: string; gap: string; stillFails: boolean }> = [];
let bandChecks = 0, bandOk = 0, actionChecks = 0, actionOk = 0, scenariosPassed = 0, scenariosGated = 0;

for (const s of SCENARIOS) {
  const r = run(s);
  add(everything, r.c);
  if (s.gap) { gaps.push({ id: s.id, gap: s.gap, stillFails: !r.pass }); continue; }
  scenariosGated++;
  if (r.pass) scenariosPassed++;
  add(gated, r.c);
  bandChecks += r.bandChecks; bandOk += r.bandOk; actionChecks += r.actionChecks; actionOk += r.actionOk;
  failures.push(...r.misses);
  const cat = byCategory.get(s.category) ?? { c: { tp: 0, fp: 0, fn: 0 }, scenarios: 0, passed: 0 };
  add(cat.c, r.c); cat.scenarios++; if (r.pass) cat.passed++;
  byCategory.set(s.category, cat);
}

// Optional slice: the 2,000-row sample register and its answer key (both are local files, so it is skipped in CI).
type Slice = { planted: number; found: number; traps: number; trapsFlagged: number; extraFlags: number; total: number } | null;
function sampleSlice(): Slice {
  if (!existsSync('public/sample_register.csv') || !existsSync('answer_key.csv')) return null;
  const csv = Papa.parse<Record<string, string>>(readFileSync('public/sample_register.csv', 'utf8'), { header: true, skipEmptyLines: true });
  const answers = Papa.parse<Record<string, string>>(readFileSync('answer_key.csv', 'utf8'), { header: true, skipEmptyLines: true }).data;
  const { rows } = toInvoiceRows(csv.data, autoMap(csv.meta.fields!));
  const confirmed = new Set(answers.filter((k) => k.type === 'Alternate vendor account').map((k) => {
    const alt = rows.find((r) => r.invoice_ref === k.duplicate_ref && r.vendor_id !== k.vendor)!;
    return vendorPairKey(k.vendor, alt.vendor_id);
  }));
  const found = detect(rows, confirmed);
  const refsOf = (f: (typeof found)[number]) => [rows[f.a].invoice_ref, rows[f.b].invoice_ref];
  const matches = (k: Record<string, string>) => (f: (typeof found)[number]) => { const r = refsOf(f); return r.includes(k.original_ref) && r.includes(k.duplicate_ref); };
  const planted = answers.filter((k) => k.expected === 'Yes');
  const traps = answers.filter((k) => k.type.startsWith('Trap'));
  const explained = new Set<number>();
  found.forEach((f, i) => { if ([...planted, ...traps].some((k) => matches(k)(f))) explained.add(i); });
  return {
    planted: planted.length, found: planted.filter((k) => found.some(matches(k))).length,
    traps: traps.length, trapsFlagged: traps.filter((k) => found.some(matches(k))).length,
    extraFlags: found.length - explained.size, total: found.length
  };
}
const slice = sampleSlice();

// ---------- report ----------
const line = '─'.repeat(92);
console.log(`\nDetection eval: ${SCENARIOS.length} scenarios, ${SCENARIOS.reduce((n, s) => n + s.expect.length, 0)} pairs that must be flagged\n${line}`);
console.log('Category'.padEnd(34) + 'Scen'.padStart(5) + 'Pass'.padStart(6) + 'TP'.padStart(5) + 'FP'.padStart(5) + 'FN'.padStart(5) + 'Precision'.padStart(11) + 'Recall'.padStart(9));
for (const [name, v] of byCategory) {
  console.log(name.padEnd(34) + String(v.scenarios).padStart(5) + String(v.passed).padStart(6) + String(v.c.tp).padStart(5) + String(v.c.fp).padStart(5) + String(v.c.fn).padStart(5) + show(prec(v.c)).padStart(11) + show(rec(v.c)).padStart(9));
}
console.log(line);
console.log(`Gated total (excludes ${gaps.length} known gaps)`.padEnd(34) + String(scenariosGated).padStart(5) + String(scenariosPassed).padStart(6) + String(gated.tp).padStart(5) + String(gated.fp).padStart(5) + String(gated.fn).padStart(5) + show(prec(gated)).padStart(11) + show(rec(gated)).padStart(9));
console.log(`F1 ${show(f1(gated))}   band correct ${pct(bandOk, bandChecks)} (${bandOk}/${bandChecks})   suggested action correct ${pct(actionOk, actionChecks)} (${actionOk}/${actionChecks})`);
console.log(`Including known gaps: precision ${show(prec(everything))}, recall ${show(rec(everything))}`);

if (failures.length) {
  console.log(`\nFailures (${failures.length})`);
  for (const f of failures) console.log(`  [${f.kind}] ${f.scenario}: ${f.detail}`);
}
if (gaps.length) {
  console.log('\nKnown gaps (reported, not gated)');
  for (const g of gaps) console.log(`  ${g.stillFails ? 'still fails' : 'NOW PASSES, remove the gap flag'}  ${g.id}: ${g.gap}`);
}
if (slice) {
  console.log(`\nSample register slice (local files): planted found ${slice.found}/${slice.planted}, traps flagged ${slice.trapsFlagged}/${slice.traps}, other flags ${slice.extraFlags} of ${slice.total}`);
} else {
  console.log('\nSample register slice: skipped (public/sample_register.csv or answer_key.csv not present)');
}

const p = prec(gated), r = rec(gated);
const ok = (p ?? 1) >= MIN_PRECISION && (r ?? 1) >= MIN_RECALL;
console.log(`\n${ok ? 'PASS' : 'FAIL'}: precision ${show(p)} (min ${(MIN_PRECISION * 100).toFixed(0)}%), recall ${show(r)} (min ${(MIN_RECALL * 100).toFixed(0)}%)`);

writeFileSync('evals/detection/results.json', JSON.stringify({
  precision: p, recall: r, f1: f1(gated), counts: gated, bandAccuracy: ratio(bandOk, bandChecks), actionAccuracy: ratio(actionOk, actionChecks),
  categories: Object.fromEntries([...byCategory].map(([k, v]) => [k, { ...v.c, scenarios: v.scenarios, passed: v.passed, precision: prec(v.c), recall: rec(v.c) }])),
  failures, knownGaps: gaps, sampleSlice: slice
}, null, 2));
process.exit(ok ? 0 : 1);

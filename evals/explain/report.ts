// Reads the Promptfoo output and reports how the explanations did.
//   real cases    : the production prompt's explanations. Reports pass rate per check; gate EVAL_MIN_EXPLAIN_PASS (default 0.85).
//   flawed cases  : explanations written to be wrong. The judge should reject them; gate EVAL_MIN_FLAW_CATCH (default 0.8).
// With the stand-in judge (JEV_MOCK=1) a banner is printed and the run never fails, because those numbers say nothing about Jev.
import { readFileSync } from 'node:fs';
import { recordFromResult, type Judged } from './judge-core';

const MIN_PASS = Number(process.env.EVAL_MIN_EXPLAIN_PASS ?? 0.85);
const MIN_CATCH = Number(process.env.EVAL_MIN_FLAW_CATCH ?? 0.8);
const file = process.argv[2] ?? 'evals/explain/results.json';
const data = JSON.parse(readFileSync(file, 'utf8'));
const rows: any[] = data.results?.results ?? data.results ?? [];

const records: Judged[] = [];
let generationErrors = 0;
for (const r of rows) {
  if (r.error || !r.response) { generationErrors++; continue; }
  try { records.push(recordFromResult(r)); } catch { generationErrors++; }
}

const mock = records.some((r) => r.jev?.mock);
const judgeErrors = records.filter((r) => r.error);
const real = records.filter((r) => r.kind === 'real');
const flawed = records.filter((r) => r.kind === 'flawed');
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');

if (mock) console.log('\n*** MOCK JUDGE: the Jev numbers below come from a text heuristic, not from Jev. Nothing here says how Jev performs. ***');
console.log(`\nExplanation eval: ${records.length} judged (${real.length} real, ${flawed.length} flawed)${generationErrors ? `, ${generationErrors} not generated` : ''}${judgeErrors.length ? `, ${judgeErrors.length} judge errors` : ''}`);

const ALL = ['a', 'b1', 'b2', 'c', 'd'] as const;
console.log('\nReal explanations (production prompt)');
console.log('  check'.padEnd(26) + 'applies'.padStart(8) + 'pass'.padStart(7));
for (const c of ALL) {
  const sub = real.filter((r) => r.jev?.answers[c]);
  console.log(`  jev ${c}`.padEnd(26) + String(sub.length).padStart(8) + pct(sub.filter((r) => r.jev!.answers[c]!.pass).length, sub.length).padStart(7));
}
const codeNames = [...new Set(real.flatMap((r) => r.code.map((x) => x.name)))];
for (const n of codeNames) {
  const sub = real.filter((r) => r.code.some((x) => x.name === n));
  console.log(`  code ${n}`.padEnd(26) + String(sub.length).padStart(8) + pct(sub.filter((r) => r.code.find((x) => x.name === n)!.pass).length, sub.length).padStart(7));
}
const realPass = real.filter((r) => r.pass).length;
console.log(`  all checks pass: ${realPass}/${real.length} (${pct(realPass, real.length)})`);
for (const r of real.filter((x) => !x.pass)) {
  console.log(`\n  #${r.n} ${r.input.risk}/${r.input.action} failed: ${r.failedChecks.join(', ') || r.error}\n    "${r.explanation}"`);
  for (const c of r.code.filter((x) => !x.pass)) console.log(`    ${c.name}: ${c.detail}`);
}

console.log('\nFlawed explanations (the judge should reject every one)');
const byFlaw = new Map<string, Judged[]>();
for (const r of flawed) byFlaw.set(r.flaw ?? '?', [...(byFlaw.get(r.flaw ?? '?') ?? []), r]);
for (const [f, list] of byFlaw) {
  const caught = list.filter((r) => !r.pass).length;
  console.log(`  ${f}`.padEnd(30) + `${caught}/${list.length} rejected`.padStart(16) + `   by: ${list.map((r) => r.failedChecks.join('+') || 'NOT CAUGHT').join(' | ')}`);
}
const caught = flawed.filter((r) => !r.pass).length;
console.log(`  rejected: ${caught}/${flawed.length} (${pct(caught, flawed.length)})`);

const okPass = real.length > 0 && realPass / real.length >= MIN_PASS;
const okCatch = flawed.length > 0 && caught / flawed.length >= MIN_CATCH;
const ok = okPass && okCatch && !judgeErrors.length && !generationErrors;
console.log(`\n${mock ? 'MOCK (not gated)' : ok ? 'PASS' : 'FAIL'}: real pass ${pct(realPass, real.length)} (min ${(MIN_PASS * 100).toFixed(0)}%), flawed rejected ${pct(caught, flawed.length)} (min ${(MIN_CATCH * 100).toFixed(0)}%)`);
process.exit(mock || ok ? 0 : 1);

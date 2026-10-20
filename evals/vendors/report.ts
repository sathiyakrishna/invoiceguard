// Reads the Promptfoo output (results.json) and reports vendor-matching accuracy and false matches over all batches.
//   Gate: false matches above 1 in 50 pairs (more than 2% of the pairs) fail the run. Accuracy is reported next to it.
// A false match (two different suppliers called the same) wrongly adds R8 points to a pair; a miss hides an alias duplicate.
import { readFileSync } from 'node:fs';
import { vendorPairKey } from '../../lib/detect';
import { VendorOut } from '../../lib/ai-prompts';

void vendorPairKey; // (import kept so a rename in detect.ts breaks this file loudly rather than silently)

const MAX_FALSE_MATCH_RATE = Number(process.env.EVAL_MAX_FALSE_MATCH_RATE ?? 1 / 50);
const file = process.argv[2] ?? 'evals/vendors/results.json';
const data = JSON.parse(readFileSync(file, 'utf8'));
const results: any[] = data.results?.results ?? data.results ?? [];

type Label = { id: number; nameA: string; nameB: string; same: boolean; kind: string };
let total = 0, correct = 0, falseMatches = 0, misses = 0, same = 0, different = 0, errors = 0, invalid = 0;
const wrong: string[] = [];
let tokens = 0;
let model = '';

for (const r of results) {
  tokens += r.response?.tokenUsage?.total ?? 0;
  model = r.response?.metadata?.model ?? model;
  const labels: Label[] = r.vars?.labels ?? r.testCase?.vars?.labels ?? [];
  if (r.error || !r.response) { errors += labels.length; continue; }
  let parsed;
  try { parsed = VendorOut.parse(JSON.parse(r.response.output)); } catch { invalid += labels.length; continue; }
  const answers = new Map(parsed.results.map((x) => [x.i, x]));
  labels.forEach((l, i) => {
    total++;
    l.same ? same++ : different++;
    const said = answers.get(i);
    if (!said) { invalid++; return; }
    if (said.same_supplier === l.same) { correct++; return; }
    if (said.same_supplier) { falseMatches++; wrong.push(`FALSE MATCH  "${l.nameA}" vs "${l.nameB}" (${l.kind}) -> "${said.reason}"`); }
    else { misses++; wrong.push(`MISS         "${l.nameA}" vs "${l.nameB}" (${l.kind}) -> "${said.reason}"`); }
  });
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
console.log(`\nVendor matching eval (${model || 'model unknown'}): ${total} pairs scored in ${results.length} batches, ${tokens} tokens`);
console.log(`  accuracy       ${pct(correct, total)} (${correct}/${total})`);
console.log(`  false matches  ${falseMatches} of ${different} different-supplier pairs (${pct(falseMatches, different)}); ${pct(falseMatches, total)} of all pairs`);
console.log(`  misses         ${misses} of ${same} same-supplier pairs (${pct(misses, same)})`);
if (errors || invalid) console.log(`  not scored     ${errors} pairs errored, ${invalid} unparseable`);
if (wrong.length) { console.log('\nWrong answers'); for (const w of wrong) console.log(`  ${w}`); }

const rate = total ? falseMatches / total : 1;
const ok = total > 0 && !errors && !invalid && rate <= MAX_FALSE_MATCH_RATE + 1e-9;
console.log(`\n${ok ? 'PASS' : 'FAIL'}: false-match rate ${(rate * 100).toFixed(1)}% of all pairs (max ${(MAX_FALSE_MATCH_RATE * 100).toFixed(1)}%, i.e. 1 in 50)${errors || invalid ? '; some pairs were not scored' : ''}`);
process.exit(ok ? 0 : 1);

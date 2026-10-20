// How often does Jev agree with your hand labels? Reads human-labels.csv and judgements.json (from `npm run eval:judge`).
//   npm run eval:calibrate
import { existsSync, readFileSync } from 'node:fs';
import type { Judged } from './judge-core';
import { agreement, atThreshold, brier, confusion, parseLabels, THRESHOLDS, type Item } from './calibration';

const LABELS = 'evals/explain/human-labels.csv';
const JUDGED = 'evals/explain/judgements.json';
if (!existsSync(LABELS) || !existsSync(JUDGED)) {
  console.error(`Need ${LABELS} (fill it in from labeling-sheet.md) and ${JUDGED} (run npm run eval:judge).`);
  process.exit(1);
}
const labels = parseLabels(readFileSync(LABELS, 'utf8'));
const judged: Judged[] = JSON.parse(readFileSync(JUDGED, 'utf8'));
const byN = new Map(judged.map((j) => [j.n, j]));
const mock = judged.some((j) => j.jev?.mock);
const CHECKS = ['a', 'b1', 'b2', 'c', 'd'];
const passWhen = (c: string): 'yes' | 'no' => (c === 'c' ? 'yes' : 'no');

const items: Item[] = [];
let unlabelled = 0;
for (const row of labels) {
  const j = byN.get(row.n);
  if (!j?.jev) continue;
  for (const c of CHECKS) {
    const v = row.labels[c];
    const a = j.jev.answers[c as keyof typeof j.jev.answers];
    if (v === 'NA' || !a) continue;
    if (v === '') { unlabelled++; continue; }
    items.push({ n: row.n, check: c, human: v, jevPass: a.pass, p: a.p, confidence: a.confidence });
  }
}

if (mock) console.log('*** MOCK JUDGE: these judgements came from a text heuristic, not from Jev. The figures below say nothing about Jev. ***\n');
if (!items.length) { console.log(`No labelled cells yet (${unlabelled} blank). Fill in ${LABELS}.`); process.exit(0); }
if (unlabelled) console.log(`Note: ${unlabelled} cells are still blank and were skipped.\n`);

const pct = (x: number | null) => (x === null ? 'n/a' : `${(100 * x).toFixed(0)}%`);
const cell = (c: ReturnType<typeof agreement>) => `${c.agree}/${c.n} = ${pct(c.rate)} (95% CI ${pct(c.low)}-${pct(c.high)})`;

console.log('Agreement between Jev and the human labels');
for (const c of CHECKS) {
  const sub = items.filter((i) => i.check === c);
  if (!sub.length) continue;
  const k = confusion(sub);
  console.log(`  ${c.padEnd(3)} ${cell(agreement(sub))}   Jev passed a bad one: ${k.jevPassHumanFail}   Jev failed a good one: ${k.jevFailHumanPass}   Brier ${brier(sub, passWhen)?.toFixed(3)}`);
}
console.log(`  all ${cell(agreement(items))}   Brier ${brier(items, passWhen)?.toFixed(3)} (0 perfect, 0.25 coin flip)`);
const k = confusion(items);
console.log(`\nConfusion over all checks: both pass ${k.bothPass}, both fail ${k.bothFail}, Jev pass / you fail ${k.jevPassHumanFail}, Jev fail / you pass ${k.jevFailHumanPass}`);

console.log('\nAgreement at different confidence thresholds (confidence = |2p-1|; answers below the threshold would go to a person)');
console.log('  threshold'.padEnd(12) + 'coverage'.padStart(10) + 'agreement'.padStart(11) + '   n');
for (const t of THRESHOLDS) {
  const r = atThreshold(items, t);
  console.log(`  >= ${t.toFixed(1)}`.padEnd(12) + pct(r.coverage).padStart(10) + pct(r.rate).padStart(11) + `   ${r.n}`);
}
const small = items.length < 100;
if (small) console.log(`\nWith ${items.length} labelled cells the intervals are wide. Treat differences of a few points as noise.`);

// Blocking gate: judges the frozen explanations (explanations.json) with the code checks and Jev, and applies
// EVAL_MIN_EXPLAIN_PASS and EVAL_MIN_FLAW_CATCH. No OpenAI calls, so the text under test never changes; needs TYPESAFE_API_KEY.
//   npm run eval:explain:gate
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate, type Judged } from './judge-core';
import { printSummary } from './summary';

async function main() {
  const frozen: Array<{ n: number; kind: 'real' | 'flawed'; flaw?: string; input: any; explanation: string }> = JSON.parse(readFileSync('evals/explain/explanations.json', 'utf8'));
  const out: Judged[] = [];
  const queue = [...frozen];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) out.push(await evaluate(c, c.explanation));
  }));
  out.sort((a, b) => a.n - b.n);
  writeFileSync('evals/explain/judgements.json', JSON.stringify(out, null, 2));
  process.exit(printSummary(out, { title: 'Explanation gate (frozen explanations)' }) ? 0 : 1);
}
main();

// Judges the frozen explanations (explanations.json) with code checks and Jev, and writes judgements.json.
// No OpenAI calls. Needs TYPESAFE_API_KEY (or JEV_MOCK=1 for a dry run with the stand-in judge).
//   npm run eval:judge
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate, type Judged } from './judge-core';

async function main() {
  const frozen: Array<{ n: number; kind: 'real' | 'flawed'; flaw?: string; input: any; explanation: string }> = JSON.parse(readFileSync('evals/explain/explanations.json', 'utf8'));
  const out: Judged[] = [];
  const queue = [...frozen];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) out.push(await evaluate(c, c.explanation));
  }));
  out.sort((a, b) => a.n - b.n);
  const errors = out.filter((r) => r.error);
  writeFileSync('evals/explain/judgements.json', JSON.stringify(out, null, 2));
  const mock = out.some((r) => r.jev?.mock);
  console.log(`${mock ? '*** MOCK JUDGE (not Jev) *** ' : ''}Judged ${out.length} explanations${errors.length ? `, ${errors.length} errors: ${errors[0].error}` : ''}. Model: ${out.find((r) => r.jev)?.jev?.model ?? 'n/a'}. Wrote evals/explain/judgements.json`);
  process.exit(errors.length ? 1 : 0);
}
main();

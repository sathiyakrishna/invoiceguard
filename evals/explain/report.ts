// Reads the Promptfoo output of a regenerated run (OpenAI writes the 30 real explanations) and reports how they did.
// This is the nightly monitor: explanations change run to run, so with EVAL_EXPLAIN_MONITOR=1 it reports and never fails.
// The blocking gate is gate.ts, which judges the frozen explanations instead.
// With the stand-in judge (JEV_MOCK=1) a banner is printed and the run never fails, because those numbers say nothing about Jev.
import { readFileSync } from 'node:fs';
import { recordFromResult, type Judged } from './judge-core';
import { printSummary } from './summary';

const file = process.argv[2] ?? 'evals/explain/results.json';
const monitor = process.env.EVAL_EXPLAIN_MONITOR === '1';
const data = JSON.parse(readFileSync(file, 'utf8'));
const rows: any[] = data.results?.results ?? data.results ?? [];

const records: Judged[] = [];
const errorMessages = new Set<string>();
let generationErrors = 0;
for (const r of rows) {
  if (r.error || !r.response) { generationErrors++; errorMessages.add(String(r.error ?? r.response?.error ?? 'no response').slice(0, 300)); continue; }
  try { records.push(recordFromResult(r)); } catch { generationErrors++; }
}
for (const m of errorMessages) console.log(`generation error: ${m}`);

const ok = printSummary(records, { title: monitor ? 'Explanation monitor (regenerated)' : 'Explanation eval (regenerated)', generationErrors });
if (monitor) console.log('MONITOR: reported only, not gated.');
process.exit(monitor || ok ? 0 : 1);

// Shared by report.ts (regenerated explanations, monitor) and gate.ts (frozen explanations, blocking gate).
// A Jev answer with confidence below UNCERTAIN_BELOW (confidence = |2p - 1|) is "uncertain": it is listed separately and does not count
// towards any pass or fail. Code checks are deterministic and always count.
// A judge error (Jev unreachable, bad reply) means the explanation was not judged: it never counts as a rejection, and any judge error fails the gate.
import type { Judged } from './judge-core';

export const MIN_PASS = Number(process.env.EVAL_MIN_EXPLAIN_PASS ?? 0.85);
export const MIN_CATCH = Number(process.env.EVAL_MIN_FLAW_CATCH ?? 0.9);
export const UNCERTAIN_BELOW = Number(process.env.EVAL_UNCERTAIN_BELOW ?? 0.2);
const ALL = ['a', 'b1', 'b2', 'c', 'd'] as const;

type Counted = Judged & { counted: string[]; uncertain: Array<{ check: string; pass: boolean; confidence: number }>; ok: boolean };

/** Splits a record's Jev answers into counted failures and uncertain ones. */
export function classify(r: Judged): Counted {
  const uncertain = Object.entries(r.jev?.answers ?? {})
    .filter(([, a]) => a && a.confidence < UNCERTAIN_BELOW)
    .map(([check, a]) => ({ check, pass: a!.pass, confidence: a!.confidence }));
  const isUncertain = (name: string) => uncertain.some((u) => `jev:${u.check}` === name);
  const counted = r.failedChecks.filter((f) => !isUncertain(f));
  return { ...r, counted, uncertain, ok: !r.error && counted.length === 0 };
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');
const describe = (r: Counted) => r.uncertain.filter((u) => !u.pass).map((u) => `${u.check} (conf ${u.confidence.toFixed(2)})`).join(', ');

/** A flawed explanation counts as caught only when the judge ran and found a counted failure. A judge error is not a catch. */
const isCaught = (r: Counted) => !r.error && !r.ok;

/** Prints the report and returns whether both thresholds were met and nothing errored. */
export function printSummary(records: Judged[], opts: { title: string; generationErrors?: number }): boolean {
  const generationErrors = opts.generationErrors ?? 0;
  const rs = records.map(classify);
  const mock = rs.some((r) => r.jev?.mock);
  const judgeErrors = rs.filter((r) => r.error);
  const real = rs.filter((r) => r.kind === 'real');
  const flawed = rs.filter((r) => r.kind === 'flawed');

  if (mock) console.log('\n*** MOCK JUDGE: the Jev numbers below come from a text heuristic, not from Jev. Nothing here says how Jev performs. ***');
  console.log(`\n${opts.title}: ${rs.length} judged (${real.length} real, ${flawed.length} flawed)${generationErrors ? `, ${generationErrors} not generated` : ''}${judgeErrors.length ? `, ${judgeErrors.length} judge errors` : ''}`);
  for (const e of new Set(judgeErrors.map((r) => r.error))) console.log(`judge error: ${e}`);

  const uncertainCount = rs.reduce((n, r) => n + r.uncertain.length, 0);
  const total = rs.reduce((n, r) => n + Object.keys(r.jev?.answers ?? {}).length, 0);
  console.log(`Uncertain Jev answers (confidence < ${UNCERTAIN_BELOW}, not counted below): ${uncertainCount} of ${total}`);

  console.log('\nReal explanations');
  console.log('  check'.padEnd(26) + 'applies'.padStart(8) + 'pass'.padStart(7) + 'uncertain'.padStart(11));
  for (const c of ALL) {
    const sub = real.filter((r) => r.jev?.answers[c]);
    const sure = sub.filter((r) => !r.uncertain.some((u) => u.check === c));
    console.log(`  jev ${c}`.padEnd(26) + String(sure.length).padStart(8) + pct(sure.filter((r) => r.jev!.answers[c]!.pass).length, sure.length).padStart(7) + String(sub.length - sure.length).padStart(11));
  }
  for (const n of [...new Set(real.flatMap((r) => r.code.map((x) => x.name)))]) {
    const sub = real.filter((r) => r.code.some((x) => x.name === n));
    console.log(`  code ${n}`.padEnd(26) + String(sub.length).padStart(8) + pct(sub.filter((r) => r.code.find((x) => x.name === n)!.pass).length, sub.length).padStart(7));
  }
  const realPass = real.filter((r) => r.ok).length;
  console.log(`  all counted checks pass: ${realPass}/${real.length} (${pct(realPass, real.length)})`);
  for (const r of real.filter((x) => !x.ok)) {
    console.log(`\n  #${r.n} ${r.input.risk}/${r.input.action} failed: ${r.counted.join(', ') || r.error}\n    "${r.explanation}"`);
    for (const c of r.code.filter((x) => !x.pass)) console.log(`    ${c.name}: ${c.detail}`);
  }
  for (const r of real.filter((x) => x.ok && describe(x))) console.log(`  #${r.n} counted as pass; uncertain Jev fail: ${describe(r)}`);

  console.log('\nFlawed explanations (the judge should reject every one)');
  const byFlaw = new Map<string, Counted[]>();
  for (const r of flawed) byFlaw.set(r.flaw ?? '?', [...(byFlaw.get(r.flaw ?? '?') ?? []), r]);
  for (const [f, list] of byFlaw) {
    console.log(`  ${f}`.padEnd(30) + `${list.filter(isCaught).length}/${list.length} rejected`.padStart(16) + `   by: ${list.map((r) => (r.error ? 'JUDGE ERROR' : r.counted.join('+') || 'NOT CAUGHT')).join(' | ')}`);
  }
  const caught = flawed.filter(isCaught).length;
  console.log(`  rejected: ${caught}/${flawed.length} (${pct(caught, flawed.length)})`);
  for (const r of flawed.filter((x) => x.ok && describe(x))) console.log(`  #${r.n} not caught; only uncertain Jev fails (not counted): ${describe(r)}`);

  const okPass = real.length > 0 && realPass / real.length >= MIN_PASS;
  const okCatch = flawed.length > 0 && caught / flawed.length >= MIN_CATCH;
  const ok = okPass && okCatch && !judgeErrors.length && !generationErrors;
  if (judgeErrors.length && !mock) console.log(`
FAIL REASON: ${judgeErrors.length} judge error${judgeErrors.length === 1 ? '' : 's'}. Those explanations were not judged and are counted as NOT caught (flawed) or not passed (real); fix the judge errors listed above and re-run.`);
  console.log(`\n${mock ? 'MOCK (not gated)' : ok ? 'PASS' : 'FAIL'}: real pass ${pct(realPass, real.length)} (min ${(MIN_PASS * 100).toFixed(0)}%), flawed rejected ${pct(caught, flawed.length)} (min ${(MIN_CATCH * 100).toFixed(0)}%), ${uncertainCount} uncertain Jev answers excluded`);
  return mock || ok;
}

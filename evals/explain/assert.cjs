// Judges one explanation: code checks plus the Jev questions (see judge-core.ts). The whole record goes into `reason` as JSON
// so report.ts can read it back from results.json.
const { pathToFileURL } = require('node:url');

module.exports = async function check(output, context) {
  const { tsImport } = await import('tsx/esm/api');
  const { evaluate } = await tsImport('./judge-core.ts', pathToFileURL(__filename).href);
  const v = context.vars;
  const record = await evaluate({ n: Number(v.n), kind: v.kind, flaw: v.flaw || undefined, input: v.input }, String(output));
  // Flawed cases are meant to fail their checks, so Promptfoo's own pass/fail only reports whether judging worked. The gates are in report.ts.
  return { pass: !record.error, score: record.pass ? 1 : 0, reason: JSON.stringify(record) };
};

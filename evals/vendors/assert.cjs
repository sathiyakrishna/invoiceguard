// Structural check per batch: the reply must be valid JSON in the production schema and answer every numbered pair once.
// The score is the batch accuracy. The pass/fail gate on false matches lives in report.ts, which sees all batches together.
const { pathToFileURL } = require('node:url');

module.exports = async function check(output, context) {
  const { tsImport } = await import('tsx/esm/api');
  const { VendorOut } = await tsImport('../../lib/ai-prompts.ts', pathToFileURL(__filename).href);
  let raw;
  try { raw = JSON.parse(output); } catch { return { pass: false, score: 0, reason: 'reply is not JSON' }; }
  const parsed = VendorOut.safeParse(raw);
  if (!parsed.success) return { pass: false, score: 0, reason: 'reply does not match the vendor schema' };
  const labels = context.vars.labels;
  const answers = new Map(parsed.data.results.map((r) => [r.i, r.same_supplier]));
  const missing = labels.map((_, i) => i).filter((i) => !answers.has(i));
  if (missing.length || parsed.data.results.length !== labels.length) return { pass: false, score: 0, reason: `expected ${labels.length} answers, missing indexes: ${missing.join(',') || 'none'}` };
  let right = 0, falseMatches = 0, misses = 0;
  labels.forEach((l, i) => {
    const said = answers.get(i);
    if (said === l.same) right++;
    else if (said) falseMatches++;
    else misses++;
  });
  return { pass: true, score: right / labels.length, reason: `${right}/${labels.length} correct, ${falseMatches} false match(es), ${misses} miss(es)` };
};

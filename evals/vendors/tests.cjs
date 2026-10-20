// One Promptfoo test per batch of up to 20 pairs, as production sends them.
const { pathToFileURL } = require('node:url');

module.exports = async function generateTests() {
  const { tsImport } = await import('tsx/esm/api');
  const here = pathToFileURL(__filename).href;
  const { vendorUser } = await tsImport('../../lib/ai-prompts.ts', here);
  const { BATCHES, AMBIGUOUS } = await tsImport('./pairs.ts', here);
  const gated = BATCHES.map((batch, i) => ({
    description: `batch ${i + 1} (${batch.length} pairs)`,
    vars: {
      user: vendorUser(batch.map((p) => ({ nameA: p.nameA, nameB: p.nameB }))),
      n: batch.length,
      labels: batch.map((p) => ({ id: p.id, nameA: p.nameA, nameB: p.nameB, same: p.same, kind: p.kind }))
    }
  }));
  // Report-only batch: ambiguous pairs are answered by the model but never scored (same is null, gated is false).
  const ambiguous = {
    description: `report-only (${AMBIGUOUS.length} ambiguous pairs)`,
    vars: {
      user: vendorUser(AMBIGUOUS.map((p) => ({ nameA: p.nameA, nameB: p.nameB }))),
      n: AMBIGUOUS.length,
      labels: AMBIGUOUS.map((p, i) => ({ id: 1000 + i, nameA: p.nameA, nameB: p.nameB, same: null, kind: p.kind, gated: false }))
    }
  };
  return [...gated, ambiguous];
};

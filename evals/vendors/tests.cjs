// One Promptfoo test per batch of up to 20 pairs, as production sends them.
const { pathToFileURL } = require('node:url');

module.exports = async function generateTests() {
  const { tsImport } = await import('tsx/esm/api');
  const here = pathToFileURL(__filename).href;
  const { vendorUser } = await tsImport('../../lib/ai-prompts.ts', here);
  const { BATCHES } = await tsImport('./pairs.ts', here);
  return BATCHES.map((batch, i) => ({
    description: `batch ${i + 1} (${batch.length} pairs)`,
    vars: {
      user: vendorUser(batch.map((p) => ({ nameA: p.nameA, nameB: p.nameB }))),
      n: batch.length,
      labels: batch.map((p) => ({ id: p.id, nameA: p.nameA, nameB: p.nameB, same: p.same, kind: p.kind }))
    }
  }));
};

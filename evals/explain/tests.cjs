const { pathToFileURL } = require('node:url');

module.exports = async function generateTests() {
  const { tsImport } = await import('tsx/esm/api');
  const { CASES } = await tsImport('./fixtures.ts', pathToFileURL(__filename).href);
  return CASES.map((c) => ({
    description: `#${c.n} ${c.input.risk} ${c.kind}${c.flaw ? ` (${c.flaw})` : ''}`,
    vars: { n: c.n, kind: c.kind, flaw: c.flaw ?? '', input: c.input, user: JSON.stringify(c.input), fixed: c.fixed ?? '' }
  }));
};

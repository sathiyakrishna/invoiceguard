// Confirms the labelled pairs look like what production sends to the AI: names similar enough to pass the same
// filter as findVendorCandidates (Jaro-Winkler >= 0.75 on the normalised names, or one name contains the other).
import { jaroWinkler, normalizeVendor } from '../../lib/detect';
import { AMBIGUOUS, PAIRS } from './pairs';

const reach = (a: string, b: string) => {
  const na = normalizeVendor(a), nb = normalizeVendor(b);
  return !!na && !!nb && (jaroWinkler(na, nb) >= 0.75 || na.includes(nb) || nb.includes(na));
};
const unreachable = PAIRS.filter((p) => !reach(p.nameA, p.nameB));
console.log(`${PAIRS.length} pairs (${PAIRS.filter((p) => p.same).length} same, ${PAIRS.filter((p) => !p.same).length} different); ${PAIRS.length - unreachable.length} pass the candidate filter.`);
for (const p of unreachable) console.log(`  would never reach the AI: "${p.nameA}" vs "${p.nameB}" (${p.same ? 'same' : 'different'}, ${p.kind})`);
for (const p of AMBIGUOUS.filter((x) => !reach(x.nameA, x.nameB))) console.log(`  ambiguous pair would never reach the AI: "${p.nameA}" vs "${p.nameB}"`);
console.log(`${AMBIGUOUS.length} ambiguous pairs (report only).`);

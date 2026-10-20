// Pure maths for judge calibration: agreement between Jev and the human labels, at different confidence thresholds.
// Kept free of file and network access so it can be unit tested.
export type Verdict = 'P' | 'F';
export type Item = { n: number; check: string; human: Verdict; jevPass: boolean; p: number; confidence: number };

export type Cell = { n: number; agree: number; rate: number | null; low: number | null; high: number | null };

/** Wilson score interval for k successes in n trials (95%). */
export function wilson(k: number, n: number, z = 1.96): { low: number | null; high: number | null } {
  if (!n) return { low: null, high: null };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export function agreement(items: Item[]): Cell {
  const agree = items.filter((i) => (i.human === 'P') === i.jevPass).length;
  const w = wilson(agree, items.length);
  return { n: items.length, agree, rate: items.length ? agree / items.length : null, ...w };
}

export type Confusion = { bothPass: number; bothFail: number; jevPassHumanFail: number; jevFailHumanPass: number };
export function confusion(items: Item[]): Confusion {
  const c: Confusion = { bothPass: 0, bothFail: 0, jevPassHumanFail: 0, jevFailHumanPass: 0 };
  for (const i of items) {
    if (i.human === 'P' && i.jevPass) c.bothPass++;
    else if (i.human === 'F' && !i.jevPass) c.bothFail++;
    else if (i.human === 'F' && i.jevPass) c.jevPassHumanFail++; // the dangerous direction: Jev waves a bad explanation through
    else c.jevFailHumanPass++;
  }
  return c;
}

/** Agreement among the answers Jev is at least `t` confident about (confidence = |2p - 1|); the rest would go to a person. */
export function atThreshold(items: Item[], t: number): Cell & { coverage: number } {
  const kept = items.filter((i) => i.confidence >= t);
  return { ...agreement(kept), coverage: items.length ? kept.length / items.length : 0 };
}

/** Brier score of Jev's probability that the explanation passes, against the human label (0 is perfect, 0.25 is a coin flip). */
export function brier(items: Item[], passWhen: (check: string) => 'yes' | 'no'): number | null {
  if (!items.length) return null;
  const sum = items.reduce((s, i) => {
    const pPass = passWhen(i.check) === 'yes' ? i.p : 1 - i.p;
    return s + (pPass - (i.human === 'P' ? 1 : 0)) ** 2;
  }, 0);
  return sum / items.length;
}

export const THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8, 0.9];

/** Parses human-labels.csv. Blank cells are "not labelled yet"; NA is "does not apply". */
export function parseLabels(csv: string): Array<{ n: number; labels: Record<string, Verdict | 'NA' | ''> }> {
  const [head, ...lines] = csv.trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').trim());
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
    const labels: Record<string, Verdict | 'NA' | ''> = {};
    for (const k of ['a', 'b1', 'b2', 'c', 'd']) {
      const v = String(row[k] ?? '').toUpperCase();
      if (v !== '' && v !== 'P' && v !== 'F' && v !== 'NA') throw new Error(`row ${row.n}, column ${k}: "${row[k]}" is not P, F or NA`);
      labels[k] = v as Verdict | 'NA' | '';
    }
    return { n: Number(row.n), labels };
  });
}

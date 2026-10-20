import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import Papa from 'papaparse';
import { autoMap, toInvoiceRows } from '@/lib/parse';
import { detect, findReversals, findVendorCandidates, normalizeRef, vendorPairKey } from '@/lib/detect';

describe.runIf(existsSync('public/sample_register.csv') && existsSync('answer_key.csv'))('sample register', () => {
  const csv = Papa.parse<Record<string, string>>(readFileSync('public/sample_register.csv', 'utf8'), { header: true, skipEmptyLines: true });
  // answer_key.csv is git-ignored, so it is missing in a clean checkout (CI). describe.runIf still runs this body, so do not read it unguarded.
  const key = existsSync('answer_key.csv') ? Papa.parse<Record<string, string>>(readFileSync('answer_key.csv', 'utf8'), { header: true, skipEmptyLines: true }).data : [];
  const map = autoMap(csv.meta.fields!);
  const { rows, errors } = toInvoiceRows(csv.data, map);

  it('maps every column and parses every row', () => {
    expect(Object.keys(map)).toHaveLength(12);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2000);
  });

  it('offers all 3 alternate-vendor-account pairs to the AI within the default top 20', () => {
    const aliasPairs = key.filter((k) => k.type === 'Alternate vendor account').map((k) => {
      const alt = rows.find((r) => r.invoice_ref === k.duplicate_ref && r.vendor_id !== k.vendor)!;
      return vendorPairKey(k.vendor, alt.vendor_id);
    });
    expect(aliasPairs).toHaveLength(3);
    const candidates = new Set(findVendorCandidates(rows, 20).map((c) => vendorPairKey(c.a, c.b)));
    expect(aliasPairs.filter((p) => !candidates.has(p))).toEqual([]);
  });

  it('recognises the 3 booked-reversed-and-reposted traps (3 originals and 3 credits reversed, re-postings live)', () => {
    const reversed = findReversals(rows);
    expect(rows.filter((r) => r.amount < 0)).toHaveLength(3);
    expect(reversed.filter(Boolean)).toHaveLength(6);
    expect(rows.filter((r, i) => reversed[i] && r.amount > 0 && r.reversed_with).length).toBe(2); // reversed_with on 2, credit only on 1
    const traps = key.filter((k) => k.type === 'Trap: booked, reversed and re-posted');
    expect(traps).toHaveLength(3);
    for (const k of traps) {
      const same = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.vendor_id === k.vendor && r.invoice_ref === k.original_ref);
      expect(same).toHaveLength(3); // original, credit, re-posting
      const live = same.filter(({ r, i }) => r.amount > 0 && !reversed[i]);
      expect(live).toHaveLength(1);
      expect(live[0].r.reversed_with).toBe('');
    }
  });

  const aliasPairs = () => new Set(key.filter((k) => k.type === 'Alternate vendor account').map((k) => {
    const alt = rows.find((r) => r.invoice_ref === k.duplicate_ref && r.vendor_id !== k.vendor)!;
    return vendorPairKey(k.vendor, alt.vendor_id);
  }));

  it('has about 70% of invoices paid; reversal traps are cleared against their credit', () => {
    const share = rows.filter((r) => r.clearing_date).length / rows.length;
    expect(share).toBeGreaterThan(0.6);
    expect(share).toBeLessThan(0.8);
    for (const r of rows.filter((x) => x.amount < 0)) expect(r.clearing_date && r.clearing_document).toBeTruthy();
    const reversed = findReversals(rows);
    rows.forEach((r, i) => {
      if (!reversed[i] || r.amount < 0) return;
      const credit = rows.find((c) => c.amount < 0 && c.vendor_id === r.vendor_id && c.invoice_ref === r.invoice_ref)!;
      expect(r.clearing_document).toBe(credit.doc_number);
    });
  });

  it('every planted pair has the paid original as A and the open duplicate as B', () => {
    const found = detect(rows, aliasPairs());
    expect(found).toHaveLength(25);
    for (const f of found) {
      expect(rows[f.a].clearing_date).toBeTruthy();
      expect(rows[f.b].clearing_date).toBeFalsy();
    }
  });

  it('a file without the clearing columns finds the same 25 pairs', () => {
    const pairs = (list: ReturnType<typeof detect>) => list.map((f) => [f.a, f.b].sort((x, y) => x - y).join('-')).sort();
    const plain = rows.map(({ clearing_date: _d, clearing_document: _c, ...rest }) => rest);
    expect(pairs(detect(plain, aliasPairs()))).toEqual(pairs(detect(rows, aliasPairs())));
  });

  it('finds every planted duplicate and none of the traps', () => {
    const aiConfirmed = new Set(key.filter((k) => k.type === 'Alternate vendor account').map((k) => {
      const alt = rows.find((r) => r.invoice_ref === k.duplicate_ref && r.vendor_id !== k.vendor)!;
      return vendorPairKey(k.vendor, alt.vendor_id);
    }));
    const found = detect(rows, aiConfirmed);
    const hit = (k: Record<string, string>) => found.some((f) => {
      const refs = [rows[f.a].invoice_ref, rows[f.b].invoice_ref];
      return refs.includes(k.original_ref) && refs.includes(k.duplicate_ref);
    });
    const planted = key.filter((k) => k.expected === 'Yes');
    const missed = planted.filter((k) => !hit(k));
    expect(missed).toEqual([]);
    const traps = key.filter((k) => k.type.startsWith('Trap'));
    expect(traps.filter(hit)).toEqual([]);
    const bands = found.reduce<Record<string, number>>((m, f) => ({ ...m, [f.band]: (m[f.band] ?? 0) + 1 }), {});
    console.log(`flags: ${found.length}`, bands, 'planted', planted.length, 'normalize check', normalizeRef('GA6 5611'));
  });
});

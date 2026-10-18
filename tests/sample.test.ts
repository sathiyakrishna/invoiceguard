import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import Papa from 'papaparse';
import { autoMap, toInvoiceRows } from '@/lib/parse';
import { detect, findVendorCandidates, normalizeRef, vendorPairKey } from '@/lib/detect';

describe.runIf(existsSync('public/sample_register.csv') && existsSync('answer_key.csv'))('sample register', () => {
  const csv = Papa.parse<Record<string, string>>(readFileSync('public/sample_register.csv', 'utf8'), { header: true, skipEmptyLines: true });
  const key = Papa.parse<Record<string, string>>(readFileSync('answer_key.csv', 'utf8'), { header: true, skipEmptyLines: true }).data;
  const map = autoMap(csv.meta.fields!);
  const { rows, errors } = toInvoiceRows(csv.data, map);

  it('maps every column and parses every row', () => {
    expect(Object.keys(map)).toHaveLength(9);
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

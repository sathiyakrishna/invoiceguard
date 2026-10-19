import { describe, it, expect } from 'vitest';
import { compareByRisk } from '@/lib/flags';

const f = (pair_code: string, score: number, amount: number) => ({ pair_code, score, amount });

describe('risk queue order', () => {
  it('sorts by score, then amount (highest first), then pair ID', () => {
    const rows = [f('DP-0004', 80, 1000), f('DP-0002', 90, 500), f('DP-0003', 80, 9000), f('DP-0001', 80, 1000), f('DP-0005', 70, 99999)];
    expect(rows.sort(compareByRisk).map((r) => r.pair_code)).toEqual(['DP-0002', 'DP-0003', 'DP-0001', 'DP-0004', 'DP-0005']);
  });

  it('keeps risk primary even when a lower score has a far larger amount', () => {
    expect([f('DP-0002', 60, 1e9), f('DP-0001', 61, 1)].sort(compareByRisk)[0].pair_code).toBe('DP-0001');
  });

  it('compares amounts that arrive as numeric strings from the database', () => {
    const rows = [f('DP-0001', 80, '900.00' as unknown as number), f('DP-0002', 80, '12000.50' as unknown as number)];
    expect(rows.sort(compareByRisk)[0].pair_code).toBe('DP-0002');
  });
});

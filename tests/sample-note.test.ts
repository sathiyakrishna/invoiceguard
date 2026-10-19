import { describe, it, expect } from 'vitest';
import { onlySampleData } from '@/lib/flags';

const scans = new Map([['s1', 'sample_register.csv'], ['s2', 'Sample_Register.PDF'], ['s3', 'payment_run_wk42.csv']]);

describe('sample data note', () => {
  it('shows when every confirmed duplicate comes from a sample register scan, csv or pdf', () => {
    expect(onlySampleData([{ scan_id: 's1' }, { scan_id: 's2' }, { scan_id: 's1' }], scans)).toBe(true);
  });

  it('hides when any confirmed duplicate comes from another file', () => {
    expect(onlySampleData([{ scan_id: 's1' }, { scan_id: 's3' }], scans)).toBe(false);
  });

  it('hides when there are no confirmed duplicates', () => {
    expect(onlySampleData([], scans)).toBe(false);
  });

  it('treats a scan it cannot name as real data', () => {
    expect(onlySampleData([{ scan_id: 's1' }, { scan_id: 'gone' }], scans)).toBe(false);
  });
});

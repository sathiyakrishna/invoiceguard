import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { computeSummary, parseRange, rangeSince, type ScanRow } from '@/lib/dashboard-summary';
import { buildSummaryWorkbook, summaryFileName } from '@/lib/summary-xlsx';
import type { Flag, Invoice } from '@/lib/flags';

const inv = (ref: string, vendor = 'Bosch Ltd'): Invoice => ({ id: ref, scan_id: 's1', company_code: '1000', vendor_id: 'V1', vendor_name: vendor, invoice_ref: ref, invoice_date: '2026-04-01', amount: 100, currency: 'INR', po_number: null, doc_number: null });
const flag = (n: number, over: Partial<Flag> = {}): Flag => ({
  id: `f${n}`, scan_id: 's1', pair_code: `DP-000${n}`, score: 90, risk_band: 'High', rules_fired: [], dup_type: 'Exact match', amount: 1000,
  ai_explanation: null, ai_action: null, status: 'pending', recovery_status: null, note: null, review_seconds: null, decided_at: null,
  created_at: '2026-04-10T00:00:00Z', a: inv(`INV-${n}`), b: inv(`INV${n}`), ...over
});
const scans = (file = 'real.csv'): ScanRow[] => [{ id: 's1', file_name: file, row_count: 120, created_at: '2026-04-10T00:00:00Z' }];

const flags: Flag[] = [
  flag(1),
  flag(2, { risk_band: 'Medium', amount: 250.5 }),
  flag(3, { status: 'yes', amount: 125000, review_seconds: 60, decided_at: '2026-04-11T04:30:00Z', recovery_status: 'Blocked', note: 'Duplicate of INV-3' }),
  flag(4, { status: 'yes', amount: 5000, dup_type: 'Reference format', review_seconds: 120, decided_at: '2026-04-12T04:30:00Z' }),
  flag(5, { status: 'no', amount: 700, review_seconds: 30, decided_at: '2026-04-13T04:30:00Z' }),
  flag(6, { status: 'ignore', amount: 40, decided_at: '2026-04-14T04:30:00Z' })
];

describe('dashboard summary', () => {
  it('computes the figures the dashboard shows', () => {
    const s = computeSummary(flags, scans(), '30');
    expect(s.scanned).toBe(120);
    expect(s.pending).toHaveLength(2);
    expect(s.yes).toHaveLength(2);
    expect(s.prevented).toBe(130000);
    expect(s.fpRate).toBeNull(); // 3 reviewed yes/no pairs, under the 5-review minimum
    expect(s.avgReview).toBe(70); // (60 + 120 + 30) / 3, pending and untimed pairs excluded
    expect(s.risk).toEqual([{ band: 'High', n: 1, amt: 1000 }, { band: 'Medium', n: 1, amt: 250.5 }, { band: 'Low', n: 0, amt: 0 }]);
    expect(s.classes.map((c) => [c.key, c.n, c.amt])).toEqual([['pending', 2, 1250.5], ['yes', 2, 130000], ['no', 1, 700], ['ignore', 1, 40]]);
    expect(s.types).toEqual([['Exact match', 1], ['Reference format', 1]]);
    expect(s.reviewed.map((f) => f.pair_code)).toEqual(['DP-0006', 'DP-0005', 'DP-0004', 'DP-0003']); // newest decision first, pending excluded
  });

  it('reports the false-positive rate once there are 5 reviewed pairs', () => {
    const many = [1, 2, 3, 4].map((n) => flag(n, { status: 'yes' })).concat(flag(5, { status: 'no' }));
    expect(computeSummary(many, scans(), '30').fpRate).toBe(20);
  });

  it('flags sample-only data, but not a mix with a real scan', () => {
    expect(computeSummary(flags, scans('sample_register.csv'), '30').sampleOnly).toBe(true);
    expect(computeSummary(flags, scans(), '30').sampleOnly).toBe(false);
  });

  it('falls back to 30 days for an unknown range and has no start date for all time', () => {
    expect(parseRange('bogus')).toBe('30');
    expect(parseRange('90')).toBe('90');
    expect(rangeSince('all')).toBeNull();
    expect(rangeSince('7', Date.parse('2026-04-08T00:00:00Z'))).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('summary workbook', () => {
  const generatedAt = new Date('2026-04-20T08:00:00Z');
  async function load(s = computeSummary(flags, scans('sample_register.csv'), '30')) {
    const buf = await buildSummaryWorkbook(s, { email: 'a@example.com', generatedAt }).xlsx.writeBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as ArrayBuffer);
    return wb;
  }

  it('names the file by period and date', () => {
    expect(summaryFileName('30', generatedAt)).toBe('invoiceguard-summary-30-2026-04-20.xlsx');
  });

  it('has the five sheets, bold frozen headers and numeric amounts', async () => {
    const wb = await load();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Pending by risk', 'By classification', 'Confirmed by type', 'Decisions']);
    for (const ws of wb.worksheets) {
      expect(ws.getRow(1).font?.bold).toBe(true);
      expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    }
    const sum = new Map(wb.getWorksheet('Summary')!.getRows(2, 12)!.map((r) => [r.getCell(1).value, r.getCell(2).value]));
    expect(sum.get('Period')).toBe('30 days');
    expect(sum.get('User')).toBe('a@example.com');
    expect(sum.get('Invoices scanned')).toBe(120);
    expect(sum.get('Payment value prevented')).toBe(130000);
    expect(sum.get('False-positive rate')).toBe('needs 5+ reviews');
    expect(sum.get('Note')).toMatch(/^Sample data/);
    expect(sum.get('Generated (IST)')).toEqual(new Date('2026-04-20T13:30:00Z')); // IST wall-clock
    const amt = wb.getWorksheet('Pending by risk')!.getCell('C2');
    expect(typeof amt.value).toBe('number');
    expect(amt.numFmt).toContain('₹');
  });

  it('lists every reviewed pair with real numbers and dates', async () => {
    const ws = (await load()).getWorksheet('Decisions')!;
    expect(ws.rowCount).toBe(5); // header + 4 reviewed pairs
    const r = ws.getRow(5); // oldest decision: DP-0003
    expect(r.getCell(1).value).toBe('DP-0003');
    expect(r.getCell(3).value).toBe('INV-3 · INV3');
    expect(r.getCell(4).value).toBe(125000);
    expect(r.getCell(5).value).toBe('Yes · duplicate');
    expect(r.getCell(6).value).toBe('Blocked');
    expect(r.getCell(8).value).toBe(60);
    expect(r.getCell(9).value).toBeInstanceOf(Date);
  });

  it('omits the sample note for real data and shows blanks when there is nothing to report', async () => {
    const wb = await load(computeSummary([], scans(), 'all'));
    const labels = wb.getWorksheet('Summary')!.getColumn(1).values as unknown[];
    expect(labels).not.toContain('Note');
    expect(wb.getWorksheet('Decisions')!.rowCount).toBe(1);
  });
});

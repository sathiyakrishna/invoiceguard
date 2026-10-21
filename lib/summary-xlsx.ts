import ExcelJS from 'exceljs';
import { MIN_REVIEWS, type DashboardSummary } from '@/lib/dashboard-summary';

// Indian lakh/crore grouping (12,34,567.00) regardless of the viewer's regional settings.
const INR_FMT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';
const INT_FMT = '[>=10000000]##\\,##\\,##\\,##0;[>=100000]##\\,##\\,##0;##,##0';
const DATETIME_FMT = 'dd/mm/yyyy hh:mm';
const IST_OFFSET_MS = 5.5 * 3_600_000;

/** Excel stores dates as wall-clock values with no zone, so shift to IST, the zone the dashboard shows. */
const istDate = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + IST_OFFSET_MS) : null);

export const summaryFileName = (range: string, now = new Date()) => `invoiceguard-summary-${range}-${now.toISOString().slice(0, 10)}.xlsx`;

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; width: number; fmt?: string }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  ws.getRow(1).font = { bold: true };
  return ws;
}

export function buildSummaryWorkbook(s: DashboardSummary, opts: { email: string; generatedAt: Date }): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'InvoiceGuard';
  wb.created = opts.generatedAt;

  const sum = sheet(wb, 'Summary', [{ header: 'Metric', width: 36 }, { header: 'Value', width: 40 }]);
  const row = (label: string, value: ExcelJS.CellValue, fmt?: string) => {
    const r = sum.addRow([label, value]);
    r.getCell(2).alignment = { horizontal: 'left' };
    if (fmt) r.getCell(2).numFmt = fmt;
  };
  row('Period', s.rangeLabel);
  row('Generated (IST)', istDate(opts.generatedAt.toISOString()), DATETIME_FMT);
  row('User', opts.email);
  row('Invoices scanned', s.scanned, INT_FMT);
  row('Pairs pending review', s.pending.length, INT_FMT);
  row('Confirmed duplicates', s.yes.length, INT_FMT);
  row('Payment value prevented', s.prevented, INR_FMT);
  if (s.fpRate === null) row('False-positive rate', `needs ${MIN_REVIEWS}+ reviews`);
  else row('False-positive rate', s.fpRate / 100, '0%');
  if (s.avgReview === null) row('Average review time per pair (m:ss)', '—');
  else row('Average review time per pair (m:ss)', s.avgReview / 86_400, 'm:ss');
  if (s.sampleOnly) row('Note', 'Sample data: shows what InvoiceGuard would prevent on a real register.');

  const risk = sheet(wb, 'Pending by risk', [{ header: 'Risk', width: 14 }, { header: 'Pairs', width: 10, fmt: INT_FMT }, { header: 'Amount', width: 20, fmt: INR_FMT }]);
  s.risk.forEach((r) => risk.addRow([r.band, r.n, r.amt]));

  const cls = sheet(wb, 'By classification', [{ header: 'Classification', width: 24 }, { header: 'Pairs', width: 10, fmt: INT_FMT }, { header: 'Amount', width: 20, fmt: INR_FMT }]);
  s.classes.forEach((c) => cls.addRow([c.label, c.n, c.amt]));

  const types = sheet(wb, 'Confirmed by type', [{ header: 'Duplicate type', width: 28 }, { header: 'Count', width: 10, fmt: INT_FMT }]);
  s.types.forEach(([t, n]) => types.addRow([t, n]));

  const dec = sheet(wb, 'Decisions', [
    { header: 'Pair ID', width: 12 },
    { header: 'Vendor', width: 28 },
    { header: 'Invoice numbers', width: 32 },
    { header: 'Amount', width: 18, fmt: INR_FMT },
    { header: 'Decision', width: 20 },
    { header: 'Recovery status', width: 18 },
    { header: 'Comment', width: 40 },
    { header: 'Review time (sec)', width: 18, fmt: '0' },
    { header: 'Decided at (IST)', width: 18, fmt: DATETIME_FMT }
  ]);
  const label = new Map<string, string>([['yes', 'Yes · duplicate'], ['no', 'No · not duplicate'], ['ignore', 'Ignored']]);
  s.reviewed.forEach((f) =>
    dec.addRow([
      f.pair_code,
      f.a.vendor_name || f.a.vendor_id || '',
      [f.a.invoice_ref, f.b.invoice_ref].filter(Boolean).join(' · '),
      Number(f.amount),
      label.get(f.status) ?? f.status,
      f.recovery_status ?? '',
      f.note ?? '',
      f.review_seconds,
      istDate(f.decided_at)
    ])
  );
  return wb;
}

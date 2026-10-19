import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import Papa from 'papaparse';
import { autoMap, toInvoiceRows } from '@/lib/parse';
import { detect } from '@/lib/detect';
import { extractPdfTable, tableFromItems, SCANNED_MESSAGE, NO_TABLE_MESSAGE } from '@/lib/pdf-table';

const pdfjs = createRequire(import.meta.url)('pdfjs-dist/legacy/build/pdf.js');
const load = (path: string) => extractPdfTable(new Uint8Array(readFileSync(path)), pdfjs);

describe.runIf(existsSync('public/sample_register.pdf') && existsSync('public/sample_register.csv'))('sample register as PDF', () => {
  const csv = Papa.parse<Record<string, string>>(readFileSync('public/sample_register.csv', 'utf8'), { header: true, skipEmptyLines: true });
  const fromCsv = toInvoiceRows(csv.data, autoMap(csv.meta.fields!));

  it('reads the same headers and rows as the CSV, so the mapping step auto-matches all 12 fields', async () => {
    const table = await load('public/sample_register.pdf');
    expect(table.headers).toEqual(csv.meta.fields);
    expect(table.records).toHaveLength(2000);
    expect(Object.keys(autoMap(table.headers))).toHaveLength(12);
    const fromPdf = toInvoiceRows(table.records, autoMap(table.headers));
    expect(fromPdf.errors).toHaveLength(0);
    expect(fromPdf.rows).toEqual(fromCsv.rows);
  });

  it('finds the same duplicate pairs as the CSV', async () => {
    const table = await load('public/sample_register.pdf');
    const { rows } = toInvoiceRows(table.records, autoMap(table.headers));
    const pairs = (r: typeof rows) => detect(r, new Set(), new Set()).map((f) => f.pairKey).sort();
    expect(pairs(rows).length).toBeGreaterThan(0);
    expect(pairs(rows)).toEqual(pairs(fromCsv.rows));
  });
});

describe('PDF problems', () => {
  const fakePdf = (pages: Array<Array<{ str: string; x: number; y: number }>>) => ({
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (n: number) => ({ getTextContent: async () => ({ items: pages[n - 1].map((i) => ({ str: i.str, transform: [7, 0, 0, 7, i.x, i.y], width: i.str.length * 4 })) }) })
      })
    })
  });

  it('says a PDF without a text layer looks scanned', async () => {
    await expect(extractPdfTable(new Uint8Array(), fakePdf([[], []]))).rejects.toThrow(SCANNED_MESSAGE);
    await expect(extractPdfTable(new Uint8Array(), fakePdf([[{ str: 'Page 1 of 2', x: 30, y: 20 }]]))).rejects.toThrow(SCANNED_MESSAGE);
  });

  it('rejects text that is not a table', async () => {
    const prose = Array.from({ length: 30 }, (_, i) => ({ str: 'This paragraph of plain text has no columns at all, only words.', x: 30, y: 500 - i * 12 }));
    await expect(extractPdfTable(new Uint8Array(), fakePdf([prose]))).rejects.toThrow(NO_TABLE_MESSAGE);
  });

  it('rejects documents over the page limit', async () => {
    const many = Array.from({ length: 101 }, () => [{ str: 'x'.repeat(60), x: 30, y: 500 }]);
    await expect(extractPdfTable(new Uint8Array(), fakePdf(many))).rejects.toThrow('limit is 100 pages');
  });

  it('keeps a column that is empty in the first data rows and drops repeated headings', () => {
    const head = (y: number) => ['a', 'b', 'c', 'd', 'e'].map((h, i) => ({ str: `col_${h}`, x: 30 + i * 60, y, w: 28, size: 7 }));
    const row = (y: number, skip = -1) => ['1', '2', '3', '4', '5'].map((v, i) => ({ str: `v${v}`, x: 30 + i * 60, y, w: 10, size: 7 })).filter((_, i) => i !== skip);
    const t = tableFromItems([[...head(500), ...row(488, 4), ...row(476)], [...head(500), ...row(488)]]);
    expect(t.headers).toEqual(['col_a', 'col_b', 'col_c', 'col_d', 'col_e']);
    expect(t.records).toHaveLength(3);
    expect(t.records[0].col_e).toBe('');
  });
});

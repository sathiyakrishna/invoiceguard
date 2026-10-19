// Rebuilds a table from the text layer of a PDF register: positioned text items -> rows (same baseline)
// -> column bands (vertical gaps no row crosses) -> { headers, records }, the shape the "Check columns" step reads.
// pdf.js is passed in so the browser (dynamic import) and the tests (node build) share this code.

export const MAX_PDF_PAGES = 100;
export const SCANNED_MESSAGE = 'This PDF looks scanned. Please export your register as CSV, Excel or a text-based PDF.';
export const NO_TABLE_MESSAGE = 'No table of invoices was found in this PDF. Please export your register as CSV, Excel or a text-based PDF.';

export type PdfTable = { headers: string[]; records: Record<string, string>[] };

type Item = { str: string; x: number; y: number; w: number; size: number };
type Cell = { text: string; x0: number; x1: number };
type Band = { x0: number; x1: number };

// the slice of pdf.js we use
type PdfJs = { getDocument: (src: { data: Uint8Array; isEvalSupported: boolean }) => { promise: Promise<PdfDoc> } };
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> };

const MIN_COLUMN_GAP = 3; // points of empty space that separate two columns
const TABLE_ROW_CELLS = 5; // rows with at least this many cells define the columns; titles and footers have 1-2
const MIN_DATA_CELLS = 3; // a row with fewer cells is a title, footer or page number

function rowsOf(items: Item[]): Cell[][] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Item[][] = [];
  let top = NaN;
  for (const it of sorted) {
    if (rows.length && Math.abs(it.y - top) <= Math.max(2, it.size * 0.5)) rows[rows.length - 1].push(it);
    else { rows.push([it]); top = it.y; }
  }
  return rows.map((r) => {
    const cells: Cell[] = [];
    for (const it of r.sort((a, b) => a.x - b.x)) {
      const last = cells[cells.length - 1];
      // pieces of one cell are split by pdf.js at spaces and font runs; a gap under ~half the font size is the same cell
      if (last && it.x - last.x1 < it.size * 0.6) {
        last.text += (it.x - last.x1 > it.size * 0.12 ? ' ' : '') + it.str.trim();
        last.x1 = it.x + it.w;
      } else cells.push({ text: it.str.trim(), x0: it.x, x1: it.x + it.w });
    }
    return cells;
  });
}

function bandsOf(rows: Cell[][]): Band[] {
  const spans = rows.filter((r) => r.length >= TABLE_ROW_CELLS).flat().sort((a, b) => a.x0 - b.x0);
  const bands: Band[] = [];
  for (const s of spans) {
    const last = bands[bands.length - 1];
    if (last && s.x0 - last.x1 < MIN_COLUMN_GAP) last.x1 = Math.max(last.x1, s.x1);
    else bands.push({ x0: s.x0, x1: s.x1 });
  }
  return bands;
}

const bandAt = (bands: Band[], c: Cell) => {
  const mid = (c.x0 + c.x1) / 2;
  return bands.findIndex((b) => mid >= b.x0 && mid <= b.x1);
};

export function tableFromItems(pages: Item[][]): PdfTable {
  const rows = pages.flatMap(rowsOf);
  const bands = bandsOf(rows);
  const table = rows.filter((r) => r.length >= MIN_DATA_CELLS);
  if (bands.length < 3 || table.length < 2) throw new Error(NO_TABLE_MESSAGE);

  const grid = table.map((r) => {
    const out: string[] = bands.map(() => '');
    for (const c of r) {
      const i = bandAt(bands, c);
      if (i >= 0) out[i] = out[i] ? `${out[i]} ${c.text}` : c.text;
    }
    return out;
  });

  const head = grid[0];
  const looksNumeric = (s: string) => /^[\d.,\-\s]+$/.test(s);
  if (head.filter(Boolean).length < MIN_DATA_CELLS || head.filter((h) => h && looksNumeric(h)).length > head.length / 2) throw new Error(NO_TABLE_MESSAGE);

  const seen = new Map<string, number>();
  const headers = head.map((h, i) => {
    const base = h || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });

  // the heading row repeats on every page; drop the repeats
  const isHeadingRepeat = (r: string[]) => r.every((v, i) => v === head[i]);
  const records = grid.slice(1).filter((r) => !isHeadingRepeat(r)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  if (!records.length) throw new Error(NO_TABLE_MESSAGE);
  return { headers, records };
}

export async function extractPdfTable(data: Uint8Array, pdfjs: PdfJs): Promise<PdfTable> {
  let doc: PdfDoc;
  try {
    // isEvalSupported: false closes CVE-2024-4367 (font code run through eval in pdf.js before 4.2.67)
    doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch {
    throw new Error('This PDF could not be opened. It may be damaged or password protected. Please export your register as CSV, Excel or a text-based PDF.');
  }
  if (doc.numPages > MAX_PDF_PAGES) throw new Error(`The PDF has ${doc.numPages} pages. The limit is ${MAX_PDF_PAGES} pages per scan.`);

  const pages: Item[][] = [];
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const items: Item[] = [];
    for (const raw of content.items as Array<{ str?: string; transform?: number[]; width?: number }>) {
      if (typeof raw.str !== 'string' || !raw.transform || !raw.str.trim()) continue;
      chars += raw.str.trim().length;
      items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5], w: raw.width ?? 0, size: Math.abs(raw.transform[3]) || 8 });
    }
    pages.push(items);
  }
  // a register page carries hundreds of characters; a scan has none, or a stray footer
  if (chars / doc.numPages < 40) throw new Error(SCANNED_MESSAGE);
  return tableFromItems(pages);
}

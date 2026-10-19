'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { FIELDS, autoMap, toInvoiceRows, type Mapping, type FieldKey, type RowError } from '@/lib/parse';

const MAX_ROWS = 20000;
const MAX_BYTES = 10 * 1024 * 1024;

type Loaded = { name: string; headers: string[]; records: Record<string, unknown>[]; fromPdf?: boolean };

async function readFile(file: File): Promise<Loaded> {
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
    const { extractPdfTable } = await import('@/lib/pdf-table');
    const { headers, records } = await extractPdfTable(new Uint8Array(await file.arrayBuffer()), pdfjs);
    return { name: file.name, headers, records, fromPdf: true };
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsx } = await import('read-excel-file');
    const sheet = await readXlsx(file);
    const headers = (sheet[0] ?? []).map((h) => String(h ?? '').trim());
    const records = sheet.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
    return { name: file.name, headers, records };
  }
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => resolve({ name: file.name, headers: res.meta.fields ?? [], records: res.data }),
      error: reject
    });
  });
}

export default function UploadFlow() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [map, setMap] = useState<Mapping>({});
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [busy, setBusy] = useState<'' | 'reading' | 'scanning'>('');
  const [drag, setDrag] = useState(false);

  async function onFile(file?: File) {
    setError('');
    setRowErrors([]);
    if (!file) return;
    if (!/\.(csv|xlsx|pdf)$/i.test(file.name)) return setError('Upload a .csv, .xlsx or .pdf file.');
    if (file.size > MAX_BYTES) return setError('That file is over 10 MB. Split the register into smaller files.');
    setBusy('reading');
    try {
      const data = await readFile(file);
      if (!data.headers.length || !data.records.length) throw new Error('The file has no rows under its header.');
      if (data.records.length > MAX_ROWS) throw new Error(`The file has ${data.records.length.toLocaleString('en-IN')} rows. The limit is 20,000 per scan.`);
      setLoaded(data);
      setMap(autoMap(data.headers));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be read.');
      setLoaded(null);
    } finally {
      setBusy('');
    }
  }

  const missing = FIELDS.filter((f) => f.required && !map[f.key]);

  async function runScan() {
    if (!loaded) return;
    setError('');
    const { rows, errors } = toInvoiceRows(loaded.records, map);
    setRowErrors(errors);
    if (!rows.length) return setError('No usable rows. Check the column mapping and the errors below.');
    setBusy('scanning');
    try {
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: loaded.name, rows }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'The scan failed. Try again.');
      router.push(`/queue?scan=${json.scanId}&new=${json.flags}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The scan failed. Try again.');
      setBusy('');
    }
  }

  const step = !loaded ? 0 : busy === 'scanning' ? 2 : 1;

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap gap-2 text-[13px]">
        {['Upload file', 'Check columns', 'Run scan'].map((s, i) => (
          <li key={s} className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium ${i === step ? 'bg-navy text-white' : i < step ? 'bg-accent-soft text-accent-text' : 'bg-[#E5E8ED] text-ink-700'}`}>
            <span className="tnum">{i + 1}</span>{s}
          </li>
        ))}
      </ol>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed bg-white px-6 py-8 text-center ${drag ? 'border-accent bg-accent-soft/40' : 'border-[#A9B6CB]'}`}
      >
        <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
        <span className="text-base font-semibold">{busy === 'reading' ? 'Reading file…' : loaded ? `${loaded.name} · ${loaded.records.length.toLocaleString('en-IN')} rows` : 'Drop your CSV, Excel or PDF file here'}</span>
        <span className="text-[13px] text-ink-500">{loaded ? 'Drop another file to replace it' : 'or click to browse · up to 10 MB, 20,000 rows'}</span>
        <input ref={input} type="file" accept=".csv,.xlsx,.pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {!loaded && (
        <p className="text-sm text-ink-500">No file to hand? Download the sample register (<a href="/sample_register.csv" download className="font-medium text-accent underline">CSV</a> or <a href="/sample_register.pdf" download className="font-medium text-accent underline">PDF</a>, 2,000 invoices with planted duplicates) and upload it here.</p>
      )}

      {error && <p role="alert" className="rounded-lg bg-high-row px-4 py-3 text-sm font-medium text-high-fg">{error}</p>}

      {loaded && (
        <section aria-labelledby="map" className="card flex flex-col">
          <div className="flex flex-wrap items-baseline gap-2 border-b border-line px-5 py-4">
            <h2 id="map">Check column mapping</h2>
            <span className="text-[13px] text-ink-500">{FIELDS.filter((f) => map[f.key]).length} of {FIELDS.length} fields matched</span>
          </div>
          {loaded.fromPdf && <p className="border-b border-line px-5 py-3 text-[13px] text-ink-700">Read from a PDF. Check each column and its example before you scan, because PDF tables can be read imperfectly.</p>}
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[560px] text-[15px]">
              <thead><tr><th className="th pl-5">Field</th><th className="th">Your column</th><th className="th pr-5">Example</th></tr></thead>
              <tbody>
                {FIELDS.map((f) => (
                  <tr key={f.key} className="border-t border-line-soft">
                    <td className="td pl-5 font-medium">{f.label}{f.required && <span className="text-high-fg"> *</span>}</td>
                    <td className="td">
                      <select aria-label={`Column for ${f.label}`} value={map[f.key] ?? ''} onChange={(e) => setMap({ ...map, [f.key as FieldKey]: e.target.value || undefined })} className="input min-h-10 w-full max-w-[260px] text-sm">
                        <option value="">Not in file</option>
                        {loaded.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </td>
                    <td className="td pr-5 text-[13px] text-ink-500">{map[f.key] ? String(loaded.records[0]?.[map[f.key] as string] ?? '') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
            <button type="button" onClick={runScan} disabled={!!busy || missing.length > 0} className="btn-primary min-h-12 px-6">
              {busy === 'scanning' ? 'Scanning…' : 'Run scan'}
            </button>
            <span className="text-[13px] text-ink-500">
              {missing.length ? `Map ${missing.map((m) => m.label.toLowerCase()).join(', ')} to continue.` : 'Uses 1 scan credit. AI explains flagged pairs only, and you make every decision.'}
            </span>
          </div>
        </section>
      )}

      {rowErrors.length > 0 && (
        <section className="card p-5">
          <h2>Rows with problems ({rowErrors.length}{rowErrors.length === 50 ? '+' : ''})</h2>
          <ul className="mt-2 max-h-48 overflow-y-auto text-[13px] text-ink-700">
            {rowErrors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { listFlags, compareByRisk, DUP_TYPES, type Flag } from '@/lib/flags';
import { RiskBadge, StatusBadge } from '@/components/RiskBadge';
import { ageLabel, count, rupees, shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Risk queue' };

const PAGE = 50;
const TABS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['yes', 'Yes'],
  ['no', 'No'],
  ['ignore', 'Ignore']
] as const;

type SP = { status?: string; type?: string; risk?: string; q?: string; sort?: string; page?: string; scan?: string; new?: string };
const RISKS = ['High', 'Medium', 'Low'];

function href(sp: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  const merged = { ...sp, ...patch };
  (['status', 'type', 'risk', 'q', 'sort', 'page'] as const).forEach((k) => {
    const v = merged[k];
    if (v && !(k === 'status' && v === 'pending') && !(k === 'page' && v === '1')) p.set(k, v);
  });
  const s = p.toString();
  return `/queue${s ? `?${s}` : ''}`;
}

export default async function QueuePage({ searchParams }: { searchParams: SP }) {
  const { supabase } = await requireUser();
  const status = searchParams.status ?? 'pending';
  const sort = searchParams.sort ?? 'score';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? '').trim().toLowerCase();

  const [all, { data: scans }] = await Promise.all([
    listFlags(supabase),
    supabase.from('scans').select('id, file_name, row_count, created_at').order('created_at', { ascending: false })
  ]);

  const scanned = (scans ?? []).reduce((s, x) => s + x.row_count, 0);
  const pending = all.filter((f) => f.status === 'pending');
  const yes = all.filter((f) => f.status === 'yes');
  const prevented = yes.reduce((s, f) => s + Number(f.amount), 0);
  const highPending = pending.filter((f) => f.risk_band === 'High').length;
  const latest = scans?.[0];

  const risk = RISKS.includes(searchParams.risk ?? '') ? searchParams.risk! : '';
  let rows: Flag[] = all.filter((f) => (status === 'all' || f.status === status) && (!searchParams.type || f.dup_type === searchParams.type) && (!risk || f.risk_band === risk));
  if (q) rows = rows.filter((f) => [f.pair_code, f.a.vendor_name, f.a.vendor_id, f.b.vendor_id, f.a.invoice_ref, f.b.invoice_ref, f.a.doc_number, f.b.doc_number].some((v) => (v ?? '').toLowerCase().includes(q)));
  if (sort !== 'amount' && sort !== 'age') rows.sort(compareByRisk);
  if (sort === 'amount') rows.sort((x, y) => Number(y.amount) - Number(x.amount));
  if (sort === 'age') rows.sort((x, y) => x.created_at.localeCompare(y.created_at));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  if (!all.length && !scans?.length) {
    return (
      <>
        <h1>Risk queue</h1>
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <h2>No scans yet</h2>
          <p className="max-w-md text-[15px] text-ink-500">Upload the invoice register for your next payment run and duplicate pairs will appear here, sorted by risk.</p>
          <Link href="/upload" className="btn-primary mt-2">Upload a payment run</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Risk queue</h1>
          {latest && <p className="mt-1.5 text-sm text-ink-500">Latest scan: {latest.file_name}, {count(latest.row_count)} invoices</p>}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a href="/api/export" className="btn-secondary">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
            Export blocked invoices (CSV)
          </a>
          <Link href="/upload" className="btn-primary">New scan</Link>
        </div>
      </div>

      {searchParams.new !== undefined && (
        <p role="status" className="rounded-lg bg-accent-soft px-4 py-3 text-sm font-medium text-accent-text">
          Scan complete: {searchParams.new === '0' ? 'no duplicate pairs found in this file.' : `${searchParams.new} duplicate pairs found. Start with the red ones.`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Invoices scanned" value={count(scanned)} />
        <Kpi label="Pairs pending review" value={count(pending.length)} sub={`${highPending} high risk`} subClass="text-high-fg" />
        <Kpi label="Confirmed duplicates" value={count(yes.length)} sub={`${all.filter((f) => f.status === 'no').length} not duplicates`} />
        <Kpi label="Payment value prevented" value={rupees(prevented)} valueClass="text-accent" />
      </div>

      <div className="card flex flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <nav aria-label="Classification" className="flex flex-wrap gap-1.5">
            {TABS.map(([key, label]) => (
              <Link key={key} href={href(searchParams, { status: key, page: '1' })} aria-current={status === key ? 'page' : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-medium ${status === key ? 'border-navy bg-navy text-white' : 'border-line-input bg-white text-ink-700 hover:bg-ground'}`}>
                {label}
              </Link>
            ))}
            {risk && (
              <Link href={href(searchParams, { risk: '', page: '1' })} aria-label={`Clear the ${risk} risk filter`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3.5 text-[13px] font-medium text-accent-text">
                Risk: {risk} <span aria-hidden="true">×</span>
              </Link>
            )}
          </nav>
          <form method="get" action="/queue" className="ml-auto flex flex-wrap items-center gap-2.5">
            <input type="hidden" name="status" value={status} />
            {risk && <input type="hidden" name="risk" value={risk} />}
            <label className="flex items-center gap-2 text-[13px] text-ink-500">Type
              <select name="type" defaultValue={searchParams.type ?? ''} className="input min-h-9 text-[13px]">
                <option value="">All types</option>
                {DUP_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="sr-only" htmlFor="q">Search</label>
            <input id="q" name="q" type="search" defaultValue={searchParams.q} placeholder="Vendor, invoice or doc no." className="input min-h-9 w-56 text-[13px]" />
            <button className="btn-secondary min-h-9">Apply</button>
          </form>
        </div>

        {shown.length === 0 ? (
          <p className="px-5 py-12 text-center text-[15px] text-ink-500">No pairs match these filters. <Link href="/queue?status=all" className="text-accent underline">Show all pairs</Link></p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            {/* Fits 1280px and wider without scrolling. Age and Doc no. appear from 1440px; below md the table scrolls inside the card. */}
            <table className="data-table w-full min-w-[720px] text-[15px] md:min-w-0">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="th pl-4">Pair ID</th>
                  <th className="th"><Link href={href(searchParams, { sort: 'score' })} className={sort === 'score' ? 'text-ink' : ''}>Risk {sort === 'score' && '↓'}</Link></th>
                  <th className="th hidden wide:table-cell"><Link href={href(searchParams, { sort: 'age' })} className={sort === 'age' ? 'text-ink' : ''}>Age {sort === 'age' && '↓'}</Link></th>
                  <th className="th">Vendor</th>
                  <th className="th">Invoice no. · date</th>
                  <th className="th hidden wide:table-cell">Doc no.</th>
                  <th className="th text-right"><Link href={href(searchParams, { sort: 'amount' })} className={sort === 'amount' ? 'text-ink' : ''}>Amount {sort === 'amount' && '↓'}</Link></th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th pr-4"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => {
                  const vendor = f.a.vendor_name || f.a.vendor_id || '';
                  const vendorIds = f.a.vendor_id === f.b.vendor_id ? f.a.vendor_id : `${f.a.vendor_id} vs ${f.b.vendor_id}`;
                  const cc = f.a.company_code === f.b.company_code ? f.a.company_code : `${f.a.company_code} / ${f.b.company_code}`;
                  const ids = `${vendorIds} · CC ${cc}`;
                  return (
                    <tr key={f.id} className="border-t border-line-soft hover:bg-[#FAFBFC]">
                      <td className="td whitespace-nowrap py-2.5 pl-4 mono text-ink-700">{f.pair_code}</td>
                      <td className="td py-2.5"><RiskBadge band={f.risk_band} score={f.score} /></td>
                      <td className="td hidden whitespace-nowrap py-2.5 text-ink-700 wide:table-cell">{ageLabel(f.created_at)}</td>
                      <td className="td py-2.5">
                        <div title={`${vendor}\n${ids}`} className="max-w-[10.5rem] wide:max-w-[12.5rem]">
                          <div className="truncate font-medium">{vendor}</div>
                          <div className="truncate text-xs text-ink-500"><span className="font-mono">{vendorIds}</span> · CC {cc}</div>
                        </div>
                      </td>
                      <td className="td whitespace-nowrap py-2.5 leading-relaxed">
                        <div><span className="mono">{f.a.invoice_ref}</span> <span className="tnum text-ink-500">{shortDate(f.a.invoice_date)}</span></div>
                        <div><span className="mono">{f.b.invoice_ref}</span> <span className="tnum text-ink-500">{shortDate(f.b.invoice_date)}</span></div>
                      </td>
                      <td className="td mono hidden py-2.5 leading-relaxed wide:table-cell"><div>{f.a.doc_number || '—'}</div><div>{f.b.doc_number || '—'}</div></td>
                      <td className="td mono whitespace-nowrap py-2.5 text-right">{rupees(f.amount)}</td>
                      <td className="td max-w-[9.5rem] py-2.5 text-ink-700">{f.dup_type}</td>
                      <td className="td py-2.5"><StatusBadge status={f.status} compact /></td>
                      <td className="td py-2.5 pr-4 text-right"><Link href={`/queue/${f.id}`} className="btn-secondary min-h-9 px-3">Review</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-[13px] text-ink-500">
          <span>Showing {shown.length} of {rows.length} pairs</span>
          {pages > 1 && (
            <span className="flex gap-2">
              {page > 1 && <Link className="btn-secondary min-h-9" href={href(searchParams, { page: String(page - 1) })}>Previous</Link>}
              <span className="self-center">Page {page} of {pages}</span>
              {page < pages && <Link className="btn-secondary min-h-9" href={href(searchParams, { page: String(page + 1) })}>Next</Link>}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, sub, subClass, valueClass }: { label: string; value: string; sub?: string; subClass?: string; valueClass?: string }) {
  return (
    <div className="card flex flex-col gap-1 px-4 py-3">
      <div className="text-[13px] text-ink-500">{label}</div>
      <div className={`text-xl font-medium tnum ${value.startsWith('₹') ? 'font-mono' : ''} ${valueClass ?? ''}`}>{value}</div>
      {sub && <div className={`text-xs ${subClass ?? 'text-ink-500'}`}>{sub}</div>}
    </div>
  );
}

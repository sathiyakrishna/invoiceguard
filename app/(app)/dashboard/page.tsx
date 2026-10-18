import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { listFlags } from '@/lib/flags';
import { RiskIcon } from '@/components/RiskBadge';
import { count, duration, rupees, rupees0 } from '@/lib/format';
import ShareSummary from './ShareSummary';

export const metadata: Metadata = { title: 'Dashboard' };

const RANGES = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', 'This year'], ['all', 'All time']] as const;
const CLASSES = [
  { key: 'pending', label: 'Pending', color: '#93B4F5' },
  { key: 'yes', label: 'Yes · duplicate', color: '#1E40AF' },
  { key: 'no', label: 'No · not duplicate', color: '#94A3B8' },
  { key: 'ignore', label: 'Ignored', color: '#334155' }
] as const;

export default async function Dashboard({ searchParams }: { searchParams: { range?: string } }) {
  const { supabase } = await requireUser();
  const range = RANGES.some(([k]) => k === searchParams.range) ? searchParams.range! : '30';
  const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 86_400_000).toISOString();

  let scansQ = supabase.from('scans').select('row_count, created_at');
  if (since) scansQ = scansQ.gte('created_at', since);
  const [allFlags, { data: scans }] = await Promise.all([listFlags(supabase), scansQ]);
  const flags = since ? allFlags.filter((f) => f.created_at >= since) : allFlags;

  const scanned = (scans ?? []).reduce((s, x) => s + x.row_count, 0);
  const by = (k: string) => flags.filter((f) => f.status === k);
  const yes = by('yes');
  const no = by('no');
  const pending = by('pending');
  const prevented = yes.reduce((s, f) => s + Number(f.amount), 0);
  const fpRate = yes.length + no.length ? Math.round((no.length / (yes.length + no.length)) * 100) : null;
  const timed = flags.filter((f) => f.review_seconds !== null && f.status !== 'pending');
  const avgReview = timed.length ? timed.reduce((s, f) => s + (f.review_seconds ?? 0), 0) / timed.length : null;

  const risk = (['High', 'Medium', 'Low'] as const).map((band) => {
    const list = pending.filter((f) => f.risk_band === band);
    return { band, n: list.length, amt: list.reduce((s, f) => s + Number(f.amount), 0) };
  });
  const classes = CLASSES.map((c) => {
    const list = by(c.key);
    return { ...c, n: list.length, amt: list.reduce((s, f) => s + Number(f.amount), 0) };
  });
  const total = classes.reduce((s, c) => s + c.amt, 0);
  const types = Object.entries(yes.reduce<Record<string, number>>((m, f) => ({ ...m, [f.dup_type]: (m[f.dup_type] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...types.map(([, n]) => n));
  const recent = flags.filter((f) => f.decided_at).sort((a, b) => (b.decided_at ?? '').localeCompare(a.decided_at ?? '')).slice(0, 6);
  const rangeLabel = RANGES.find(([k]) => k === range)![1];

  // donut geometry
  const R = 60, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = classes.filter((c) => c.amt > 0).map((c) => {
    const len = (C * c.amt) / total;
    const arc = { color: c.color, dash: `${len} ${C - len}`, off: -offset };
    offset += len;
    return arc;
  });

  const riskStyle = { High: 'bg-high-bg text-high-fg', Medium: 'bg-med-bg text-med-fg', Low: 'bg-low-bg text-low-fg' };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-sm text-ink-500">All your scans. Numbers update the moment you classify a pair.</p>
        </div>
        <nav aria-label="Date range" className="flex flex-wrap gap-1.5">
          {RANGES.map(([k, label]) => (
            <Link key={k} href={`/dashboard?range=${k}`} aria-current={range === k ? 'page' : undefined}
              className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-medium ${range === k ? 'border-navy bg-navy text-white' : 'border-line-input bg-white text-ink-700 hover:bg-ground'}`}>{label}</Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-navy px-7 py-6 text-white">
        <div>
          <div className="text-sm text-[#C9D2E3]">Payment value prevented · {rangeLabel.toLowerCase()}</div>
          <div className="mt-1 font-mono text-[40px] tracking-tight tnum">{rupees(prevented)}</div>
          <div className="text-[13px] text-[#C9D2E3]">from {yes.length} confirmed duplicate{yes.length === 1 ? '' : 's'} across {scans?.length ?? 0} scan{scans?.length === 1 ? '' : 's'}</div>
        </div>
        <ShareSummary text={`InvoiceGuard summary (${rangeLabel.toLowerCase()}): ${count(scanned)} invoices scanned, ${yes.length} duplicate invoices blocked before payment, ${rupees0(prevented)} prevented.`} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Invoices scanned" value={count(scanned)} />
        <Kpi label="Pairs pending review" value={count(pending.length)} />
        <Kpi label="False-positive rate" value={fpRate === null ? '—' : `${fpRate}%`} sub="not duplicates ÷ reviewed" />
        <Kpi label="Avg. review time per pair" value={duration(avgReview)} />
      </div>

      <section aria-labelledby="risk" className="card flex flex-col gap-3.5 p-5">
        <h2 id="risk" className="text-base font-semibold">Pending pairs by risk</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {risk.map((r) => (
            <Link key={r.band} href="/queue" className={`flex items-center gap-3 rounded-lg px-4 py-3.5 ${riskStyle[r.band]}`}>
              <RiskIcon band={r.band} size={22} />
              <span className="flex flex-col"><span className="text-[13px] font-semibold">{r.band}</span><span className="text-[13px] tnum">{r.n} pairs · {rupees0(r.amt)}</span></span>
            </Link>
          ))}
        </div>
      </section>

      {flags.length === 0 ? (
        <div className="card px-6 py-12 text-center text-[15px] text-ink-500">No pairs in this period yet. <Link href="/upload" className="text-accent underline">Scan a payment run</Link> to see results here.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <section aria-labelledby="cls" className="card flex flex-col gap-4 p-5">
            <h2 id="cls" className="text-base font-semibold">Duplicate pair amount by classification</h2>
            <div className="flex flex-wrap items-center gap-6">
              <svg role="img" aria-label={classes.map((c) => `${c.label} ${rupees0(c.amt)}`).join('; ')} width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={R} fill="none" stroke="#EEF0F3" strokeWidth="26" />
                {arcs.map((a, i) => <circle key={i} cx="80" cy="80" r={R} fill="none" stroke={a.color} strokeWidth="26" strokeDasharray={a.dash} strokeDashoffset={a.off} transform="rotate(-90 80 80)" />)}
                <text x="80" y="76" textAnchor="middle" fontSize="12" fill="#4B5565">Total</text>
                <text x="80" y="94" textAnchor="middle" fontSize="13" fill="#141A26" fontFamily="IBM Plex Mono, monospace">{rupees0(total)}</text>
              </svg>
              <div className="flex min-w-[220px] flex-1 flex-col">
                {classes.map((c) => (
                  <div key={c.key} className="grid grid-cols-[14px_1fr_auto_auto] items-center gap-2.5 border-b border-line-soft py-2 text-sm last:border-0">
                    <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
                    <span>{c.label}</span>
                    <span className="font-mono text-[13px] text-ink-500 tnum">{c.n}</span>
                    <span className="min-w-[110px] text-right font-mono text-[13px] tnum">{rupees0(c.amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="types" className="card flex flex-col gap-3.5 p-5">
            <h2 id="types" className="text-base font-semibold">Confirmed duplicates by type</h2>
            {types.length === 0 ? <p className="text-sm text-ink-500">Classify pairs as Yes to see which duplicate types you catch most.</p> : types.map(([t, n]) => (
              <div key={t} className="grid grid-cols-[150px_1fr_32px] items-center gap-3 text-sm">
                <span>{t}</span>
                <div className="h-3.5 rounded bg-line-soft"><div className="h-3.5 rounded bg-accent" style={{ width: `${(n / maxType) * 100}%` }} /></div>
                <span className="text-right font-mono tnum">{n}</span>
              </div>
            ))}
          </section>

          <section aria-labelledby="recent" className="card xl:col-span-2">
            <h2 id="recent" className="px-5 pb-3 pt-5 text-base font-semibold">Recent decisions</h2>
            {recent.length === 0 ? <p className="px-5 pb-5 text-sm text-ink-500">Your decisions will appear here.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr><th className="th pl-5">Pair</th><th className="th">Vendor</th><th className="th text-right">Amount</th><th className="th">Decision</th><th className="th pr-5">Review time</th></tr></thead>
                  <tbody>
                    {recent.map((f) => (
                      <tr key={f.id} className="border-t border-line-soft">
                        <td className="td pl-5"><Link href={`/queue/${f.id}`} className="font-mono text-accent">{f.pair_code}</Link></td>
                        <td className="td">{f.a.vendor_name || f.a.vendor_id}</td>
                        <td className="td text-right font-mono text-[13px]">{rupees(f.amount)}</td>
                        <td className="td">{CLASSES.find((c) => c.key === f.status)?.label}</td>
                        <td className="td pr-5 font-mono text-[13px]">{duration(f.review_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
      <p className="text-[13px] text-ink-500">Every figure is calculated from your own scans and decisions.</p>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card flex flex-col gap-1.5 px-5 py-4">
      <div className="text-[13px] text-ink-500">{label}</div>
      <div className="font-mono text-2xl tnum">{value}</div>
      {sub && <div className="text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

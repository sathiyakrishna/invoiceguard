import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { CLASSES, MIN_REVIEWS, RANGES, computeSummary, loadDashboardData, parseRange } from '@/lib/dashboard-summary';
import { RiskIcon } from '@/components/RiskBadge';
import { count, duration, rupees, rupees0 } from '@/lib/format';
import ShareSummary from './ShareSummary';
import DownloadSummary from './DownloadSummary';
import InfoTip from './InfoTip';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: { range?: string } }) {
  const { supabase } = await requireUser();
  const range = parseRange(searchParams.range);
  const { flags, scans } = await loadDashboardData(supabase, range);
  const { scanned, scanCount, yes, pending, prevented, sampleOnly, fpRate, avgReview, risk, classes, total, types, decided, rangeLabel } = computeSummary(flags, scans, range);
  const maxType = Math.max(1, ...types.map(([, n]) => n));
  const recent = decided.slice(0, 6);

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
          <h1>Dashboard</h1>
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
          <div className="flex items-center gap-1.5 text-sm text-[#C9D2E3]">
            <span>Payment value prevented · {rangeLabel.toLowerCase()}</span>
            <InfoTip label="What counts as payment value prevented">Total amount of duplicate invoices you confirmed (marked Yes) in this period. These open invoices would have been paid twice. Pairs marked No, Ignored or still pending are not counted.</InfoTip>
          </div>
          <div className="mt-1 text-[40px] tracking-tight tnum">{rupees0(prevented)}</div>
          <div className="text-[13px] text-[#C9D2E3]">from {yes.length} confirmed duplicate{yes.length === 1 ? '' : 's'} across {scanCount} scan{scanCount === 1 ? '' : 's'}</div>
          {sampleOnly && <div className="mt-1 text-xs text-[#A9B3C6]">Sample data: shows what InvoiceGuard would prevent on a real register.</div>}
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <ShareSummary text={`InvoiceGuard summary (${rangeLabel.toLowerCase()}): ${count(scanned)} invoices scanned, ${yes.length} duplicate invoices blocked before payment, ${rupees0(prevented)} prevented.`} />
          <DownloadSummary range={range} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Invoices scanned" value={count(scanned)} />
        <Kpi label="Pairs pending review" value={count(pending.length)} href="/queue?status=pending" />
        <Kpi label="False-positive rate" value={fpRate === null ? '—' : `${fpRate}%`} sub={fpRate === null ? `needs ${MIN_REVIEWS}+ reviews` : 'not duplicates ÷ reviewed'} />
        <Kpi label="Avg. review time per pair" value={duration(avgReview)} />
      </div>

      <section aria-labelledby="risk" className="card flex flex-col gap-3.5 p-5">
        <h2 id="risk">Pending pairs by risk</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {risk.map((r) => (
            <Link key={r.band} href={`/queue?status=pending&risk=${r.band}`} className={`flex items-center gap-3 rounded-lg px-4 py-3.5 transition hover:shadow-[0_4px_12px_rgba(11,31,77,0.14)] hover:brightness-95 ${riskStyle[r.band]}`}>
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
            <h2 id="cls">Duplicate pair amount by classification</h2>
            <div className="flex flex-wrap items-center gap-6">
              <svg role="img" aria-label={classes.map((c) => `${c.label} ${rupees0(c.amt)}`).join('; ')} width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={R} fill="none" stroke="#EEF0F3" strokeWidth="26" />
                {arcs.map((a, i) => <circle key={i} cx="80" cy="80" r={R} fill="none" stroke={a.color} strokeWidth="26" strokeDasharray={a.dash} strokeDashoffset={a.off} transform="rotate(-90 80 80)" />)}
                <text x="80" y="76" textAnchor="middle" fontSize="12" fill="#4B5565">Total</text>
                <text x="80" y="94" textAnchor="middle" fontSize="14" fill="#141A26" className="tnum">{rupees0(total)}</text>
              </svg>
              <div className="flex min-w-[220px] flex-1 flex-col">
                {classes.map((c) => (
                  <div key={c.key} className="grid grid-cols-[14px_1fr_auto_auto] items-center gap-2.5 border-b border-line-soft py-2 text-sm last:border-0">
                    <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
                    <span>{c.label}</span>
                    <span className="text-[13px] text-ink-500 tnum">{c.n}</span>
                    <span className="min-w-[110px] text-right text-sm tnum">{rupees0(c.amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="types" className="card flex flex-col gap-3.5 p-5">
            <h2 id="types">Confirmed duplicates by type</h2>
            {types.length === 0 ? <p className="text-sm text-ink-500">Classify pairs as Yes to see which duplicate types you catch most.</p> : types.map(([t, n]) => (
              <div key={t} className="grid grid-cols-[150px_1fr_32px] items-center gap-3 text-sm">
                <span>{t}</span>
                <div className="h-3.5 rounded bg-line-soft"><div className="h-3.5 rounded bg-accent" style={{ width: `${(n / maxType) * 100}%` }} /></div>
                <span className="text-right tnum">{n}</span>
              </div>
            ))}
          </section>

          <section aria-labelledby="recent" className="card xl:col-span-2">
            <h2 id="recent" className="px-5 pb-3 pt-5">Recent decisions</h2>
            {recent.length === 0 ? <p className="px-5 pb-5 text-sm text-ink-500">Your decisions will appear here.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table w-full min-w-[520px] text-[15px]">
                  <thead><tr><th className="th pl-5">Pair</th><th className="th">Vendor</th><th className="th text-right">Amount</th><th className="th">Decision</th><th className="th pr-5">Review time</th></tr></thead>
                  <tbody>
                    {recent.map((f) => (
                      <tr key={f.id} className="border-t border-line-soft">
                        <td className="td pl-5"><Link href={`/queue/${f.id}`} className="font-mono text-accent">{f.pair_code}</Link></td>
                        <td className="td">{f.a.vendor_name || f.a.vendor_id}</td>
                        <td className="td text-right text-sm tnum">{rupees(f.amount)}</td>
                        <td className="td">{CLASSES.find((c) => c.key === f.status)?.label}</td>
                        <td className="td pr-5 text-[13px] tnum">{duration(f.review_seconds)}</td>
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

function Kpi({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <div className="text-[13px] text-ink-500">{label}</div>
      <div className="text-2xl font-medium tnum">{value}</div>
      {sub && <div className="text-xs text-ink-500">{sub}</div>}
    </>
  );
  const box = 'card flex flex-col gap-1.5 px-5 py-4';
  return href
    ? <Link href={href} className={`${box} transition hover:border-accent hover:shadow-[0_4px_12px_rgba(11,31,77,0.10)]`}>{body}</Link>
    : <div className={box}>{body}</div>;
}

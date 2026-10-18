import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { FLAG_SELECT, type Flag, type Invoice } from '@/lib/flags';
import { RULES, type RuleId } from '@/lib/detect';
import { RiskBadge } from '@/components/RiskBadge';
import { ageLabel, longDate, rupees, shortDate } from '@/lib/format';
import AiPanel from './AiPanel';
import Decision from './Decision';

export const metadata: Metadata = { title: 'Review pair' };

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from('flags').select(FLAG_SELECT).eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const f = data as unknown as Flag;

  const vendors = Array.from(new Set([f.a.vendor_id, f.b.vendor_id].filter(Boolean))) as string[];
  const [{ data: ledgerRows }, { count: clearedInScan }, { data: pendingList }] = await Promise.all([
    supabase.from('invoices').select('*').in('vendor_id', vendors).order('invoice_date', { ascending: false, nullsFirst: false }).limit(12),
    // does this scan carry payment history at all? Only then can "open" be claimed for an invoice without a clearing date
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('scan_id', f.scan_id).not('clearing_date', 'is', null),
    supabase.from('flags').select('id').eq('status', 'pending').order('score', { ascending: false }).order('created_at', { ascending: false }).limit(2000)
  ]);

  // ledger: latest invoices for the vendor(s), always including both invoices of the pair
  const seen = new Set<string>();
  let ledger: Invoice[] = [...(ledgerRows ?? []), f.a, f.b].filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true))) as Invoice[];
  ledger = ledger.sort((x, y) => (y.invoice_date ?? '').localeCompare(x.invoice_date ?? '')).slice(0, 12);

  const ids = (pendingList ?? []).map((p) => p.id);
  const pos = ids.indexOf(f.id);
  const nextId = pos >= 0 ? ids[pos + 1] ?? null : ids[0] ?? null;
  const prevId = pos > 0 ? ids[pos - 1] : null;

  const hasClearing = (clearedInScan ?? 0) > 0;
  const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
  const sameRef = f.a.invoice_ref === f.b.invoice_ref;
  const paidThenOpen = !!f.a.clearing_date && !f.b.clearing_date; // A paid, B open
  // payment rows only when this scan carries clearing data; the Match column of 'Payment date' is empty
  const payment: [string, string, string, string, boolean][] = hasClearing ? [
    ['Status', f.a.clearing_date ? 'Already paid' : 'Open', f.b.clearing_date ? 'Already paid' : 'Open', paidThenOpen ? 'One paid, one open' : 'Both open', paidThenOpen],
    ['Payment date', f.a.clearing_date ? dmy(f.a.clearing_date) : 'NA', f.b.clearing_date ? dmy(f.b.clearing_date) : 'NA', '', false]
  ] : [];
  const cmp: [string, string, string, string, boolean][] = [
    ...payment,
    ['Vendor', `${f.a.vendor_id} · ${f.a.vendor_name ?? ''}`, `${f.b.vendor_id} · ${f.b.vendor_name ?? ''}`, f.a.vendor_id === f.b.vendor_id ? 'Exact' : f.rules_fired.includes('R8') ? 'Same supplier (AI)' : 'Different', f.a.vendor_id === f.b.vendor_id || f.rules_fired.includes('R8')],
    ['Invoice no.', f.a.invoice_ref ?? '', f.b.invoice_ref ?? '', sameRef ? 'Exact' : f.rules_fired.includes('R1') ? 'Normalized match' : f.rules_fired.includes('R2') ? 'Similar' : 'Different', sameRef || f.rules_fired.includes('R1') || f.rules_fired.includes('R2')],
    ['Gross amount', rupees(f.a.amount), rupees(f.b.amount), f.rules_fired.includes('R3') ? 'Exact' : f.rules_fired.includes('R4') ? 'Within 1%' : 'Different', f.rules_fired.includes('R3') || f.rules_fired.includes('R4')],
    ['Invoice date', shortDate(f.a.invoice_date), shortDate(f.b.invoice_date), f.rules_fired.includes('R5') ? 'Within 30 days' : 'Far apart', f.rules_fired.includes('R5')],
    ['Company code', f.a.company_code ?? '—', f.b.company_code ?? '—', f.a.company_code === f.b.company_code ? 'Same' : 'Different', f.a.company_code === f.b.company_code],
    ['PO number', f.a.po_number || '—', f.b.po_number || '—', f.a.po_number === f.b.po_number ? 'Same' : 'Different', !!f.a.po_number && f.a.po_number === f.b.po_number],
    ['Doc no.', f.a.doc_number || '—', f.b.doc_number || '—', f.a.doc_number === f.b.doc_number ? 'Same' : 'Different', false]
  ];

  return (
    <>
      <Link href="/queue" className="inline-flex min-h-8 items-center gap-1.5 self-start text-sm text-accent">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>Back to risk queue
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Duplicate pair {f.pair_code} · {f.a.vendor_name || f.a.vendor_id}</h1>
            <RiskBadge band={f.risk_band} score={f.score} large />
          </div>
          <p className="mt-1.5 text-sm text-ink-500">{pos >= 0 ? `${pos + 1} of ${ids.length} pending` : 'Already classified'} · {f.dup_type} · shortcuts: Y yes, N no, I ignore, J/K next/previous</p>
        </div>
        <div className="flex gap-2">
          {prevId ? <Link aria-label="Previous pair" href={`/queue/${prevId}`} className="btn-secondary h-11 w-11 px-0">‹</Link> : <span aria-hidden="true" className="btn-secondary h-11 w-11 px-0 opacity-40">‹</span>}
          {nextId ? <Link aria-label="Next pair" href={`/queue/${nextId}`} className="btn-secondary h-11 w-11 px-0">›</Link> : <span aria-hidden="true" className="btn-secondary h-11 w-11 px-0 opacity-40">›</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <section aria-labelledby="cmp" className="card">
            <h2 id="cmp" className="border-b border-line px-5 py-4 text-[15px] font-semibold">Side-by-side comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[#F8F9FB]"><tr><th className="th pl-5">Field</th><th className="th">Invoice A</th><th className="th">Invoice B</th><th className="th pr-5">Match</th></tr></thead>
                <tbody>
                  {cmp.map(([label, a, b, m, hit]) => (
                    <tr key={label} className={`border-t border-line-soft ${hit ? 'bg-high-row' : ''}`}>
                      <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink-700">{label}</th>
                      <td className="px-3 py-2.5 mono">{a}</td>
                      <td className="px-3 py-2.5 mono">{b}</td>
                      <td className={`px-3 py-2.5 pr-5 text-[13px] font-semibold ${hit ? 'text-high-fg' : 'text-ink-500'}`}>{m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="ledger" className="card">
            <div className="flex flex-wrap items-baseline gap-2 border-b border-line px-5 py-4">
              <h2 id="ledger" className="text-[15px] font-semibold">Ledger preview</h2>
              <span className="text-[13px] text-ink-500">{vendors.join(' and ')} · latest invoices across your scans · the pair is highlighted</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead><tr><th className="th pl-5">Vendor</th><th className="th">CC</th><th className="th">Invoice no.</th><th className="th">Doc no.</th><th className="th">Invoice date</th>{hasClearing && <><th className="th">Status</th><th className="th">Payment date</th></>}<th className="th pr-5 text-right">Amount</th></tr></thead>
                <tbody>
                  {ledger.map((l) => {
                    const hit = l.id === f.a.id || l.id === f.b.id;
                    const reversedTag = <span title="Booked and reversed. Not compared as a duplicate." className="rounded-full bg-line-soft px-2 py-0.5 font-sans text-[11px] font-semibold text-ink-500">Reversed</span>;
                    return (
                      <tr key={l.id} className={`border-t border-line-soft ${hit ? 'bg-high-bg font-semibold shadow-[inset_3px_0_0_#B42318]' : ''}`}>
                        <td className="px-5 py-2 font-mono">{l.vendor_id}</td>
                        <td className="px-3 py-2 font-mono">{l.company_code}</td>
                        <td className="px-3 py-2 font-mono">
                          {l.invoice_ref}
                          {/* with payment history the Status column carries the tag; without it the tag stays next to the number */}
                          {!hasClearing && l.is_reversed && <span className="ml-2">{reversedTag}</span>}
                        </td>
                        <td className="px-3 py-2 font-mono">{l.doc_number || '—'}</td>
                        <td className="px-3 py-2 font-mono">{shortDate(l.invoice_date)}</td>
                        {hasClearing && (
                          <>
                            {/* same wording and DD/MM/YYYY format as the side-by-side comparison */}
                            <td className="whitespace-nowrap px-3 py-2 font-sans">
                              {l.is_reversed ? reversedTag : l.clearing_date ? 'Already paid' : <span className="font-semibold text-accent-text">Open</span>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">{!l.is_reversed && l.clearing_date ? dmy(l.clearing_date) : 'NA'}</td>
                          </>
                        )}
                        <td className="px-3 py-2 pr-5 text-right font-mono">{rupees(l.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside aria-label="Pair details and decision" className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <section className="card px-5 py-3">
            {[
              ['Risk', `${f.risk_band} · ${f.score}`],
              ['Age', ageLabel(f.created_at)],
              ['Issue', f.dup_type],
              ['Amount', rupees(f.amount)],
              ['Flagged on', longDate(f.created_at)]
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line-soft py-2 text-sm last:border-0"><span className="text-ink-500">{k}</span><span className="text-right font-medium">{v}</span></div>
            ))}
            <div className="pt-2 text-[13px] text-ink-700">
              <div className="mb-1 text-ink-500">Rules that fired</div>
              <ul className="flex flex-col gap-1">
                {f.rules_fired.map((r) => (
                  <li key={r} className="flex justify-between gap-3"><span>{RULES[r as RuleId]?.label ?? r}</span><span className="font-mono text-ink-500">+{RULES[r as RuleId]?.points}</span></li>
                ))}
              </ul>
            </div>
          </section>
          <AiPanel flagId={f.id} initial={f.ai_explanation ? { explanation: f.ai_explanation, action: f.ai_action ?? '' } : null} />
          <Decision
            key={f.id}
            flagId={f.id}
            amount={f.amount}
            initial={{ status: f.status, recovery: f.recovery_status ?? 'Blocked before payment', note: f.note ?? '' }}
            nextId={nextId}
            prevId={prevId}
          />
        </aside>
      </div>
    </>
  );
}

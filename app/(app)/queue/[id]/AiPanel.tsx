'use client';
import { useEffect, useState } from 'react';

type Out = { explanation: string; action: string };
type Result = { ok: boolean; j: Partial<Out> & { error?: string } };

// One request per flag, shared across effect re-runs (React Strict Mode runs effects twice in dev).
// Failed requests are dropped so the user can retry; successful ones stay and match the server cache.
const inflight = new Map<string, Promise<Result>>();

function requestExplanation(flagId: string): Promise<Result> {
  let p = inflight.get(flagId);
  if (!p) {
    p = fetch(`/api/explain/${flagId}`, { method: 'POST' })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then((res) => { if (!res.ok) inflight.delete(flagId); return res; })
      .catch((e) => { inflight.delete(flagId); throw e; });
    inflight.set(flagId, p);
  }
  return p;
}

export default function AiPanel({ flagId, initial }: { flagId: string; initial: Out | null }) {
  const [data, setData] = useState<Out | null>(initial);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    if (initial) return;
    let live = true;
    requestExplanation(flagId)
      .then(({ ok, j }) => {
        if (!live) return;
        if (ok) setData(j as Out);
        else setMsg(j.error || 'The AI explanation is unavailable right now. The rule evidence above still applies.');
      })
      .catch(() => live && setMsg('The AI explanation is unavailable right now. The rule evidence above still applies.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [flagId, initial]);

  const actionStyle = (data?.action === 'Block the open invoice' || data?.action === 'Block invoice B') ? 'bg-high-bg text-high-fg' : data?.action === 'Likely valid' ? 'bg-low-bg text-low-fg' : 'bg-med-bg text-med-fg';

  return (
    <section aria-labelledby="ai" aria-busy={loading} className="flex flex-col gap-2.5 rounded-xl border border-[#D6E1FB] bg-[#F5F8FF] px-5 py-4">
      <div className="flex items-center gap-2">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5z" /><path d="M8 10h8M8 13h5" /></svg>
        <h2 id="ai">AI explanation</h2>
        <span className="ml-auto text-xs text-ink-500">Advisory only</span>
      </div>
      {loading && <div className="flex flex-col gap-2"><div className="skeleton h-3.5 w-full" /><div className="skeleton h-3.5 w-11/12" /><div className="skeleton h-3.5 w-2/3" /></div>}
      {data && (
        <>
          <p className="text-sm leading-relaxed">{data.explanation}</p>
          <div className="flex items-center gap-2 text-[13px]"><span className="text-ink-500">Suggested action</span><span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 font-semibold ${actionStyle}`}>{data.action}</span></div>
        </>
      )}
      {msg && <p className="text-sm text-ink-700">{msg}</p>}
    </section>
  );
}

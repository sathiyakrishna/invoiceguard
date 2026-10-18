'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { rupees } from '@/lib/format';

type Status = 'pending' | 'yes' | 'no' | 'ignore';
const RECOVERY = ['Blocked before payment', 'Credit note requested', 'Recovered', 'Not applicable'];

export default function Decision({ flagId, amount, initial, nextId, prevId }: {
  flagId: string; amount: number; initial: { status: Status; recovery: string; note: string }; nextId: string | null; prevId: string | null;
}) {
  const router = useRouter();
  const started = useRef(Date.now());
  const [status, setStatus] = useState<Status>(initial.status);
  const [recovery, setRecovery] = useState(initial.recovery);
  const [note, setNote] = useState(initial.note);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const decide = useCallback(async (s: Exclude<Status, 'pending'>) => {
    if (saving) return;
    setSaving(true);
    setError('');
    setStatus(s);
    const res = await fetch(`/api/flags/${flagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s, recovery_status: s === 'yes' ? recovery : null, note, review_seconds: Math.round((Date.now() - started.current) / 1000) })
    });
    setSaving(false);
    if (!res.ok) {
      setStatus(initial.status);
      setError('Your decision was not saved. Check your connection and try again.');
      return;
    }
    setToast(s === 'yes' ? `Marked Yes · duplicate. ${rupees(amount)} added to payment value prevented.` : s === 'no' ? 'Marked No · not a duplicate. Counted in your false-positive rate.' : 'Ignored. This pair will not be flagged in future scans.');
    router.refresh();
    if (nextId) setTimeout(() => router.push(`/queue/${nextId}`), 900);
  }, [saving, flagId, recovery, note, amount, nextId, router, initial.status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'y') decide('yes');
      else if (k === 'n') decide('no');
      else if (k === 'i') decide('ignore');
      else if (k === 'j' && nextId) router.push(`/queue/${nextId}`);
      else if (k === 'k' && prevId) router.push(`/queue/${prevId}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, nextId, prevId, router]);

  const btn = (s: Exclude<Status, 'pending'>, label: string, key: string) => {
    const on = status === s;
    const onCls = s === 'yes' ? 'bg-accent-text text-white' : 'bg-ink-700 text-white';
    return (
      <button type="button" onClick={() => decide(s)} disabled={saving} aria-pressed={on} className={`min-h-12 border-r border-line-input text-sm font-semibold last:border-r-0 disabled:opacity-70 ${on ? onCls : 'bg-white text-ink hover:bg-ground'}`}>
        {label} <span className={`ml-1 text-xs ${on ? 'opacity-80' : 'text-ink-500'}`}>{key}</span>
      </button>
    );
  };

  return (
    <section aria-labelledby="dec" className="card flex flex-col gap-3.5 px-5 py-4">
      <h2 id="dec">Is this a duplicate?</h2>
      <div role="group" aria-label="Duplicate classification" className="grid grid-cols-3 overflow-hidden rounded-lg border border-line-input">
        {btn('yes', 'Yes', 'Y')}
        {btn('no', 'No', 'N')}
        {btn('ignore', 'Ignore', 'I')}
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-500">Recovery status (for Yes)
        <select value={recovery} onChange={(e) => setRecovery(e.target.value)} className="input min-h-10 text-sm">
          {RECOVERY.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-500">Comment
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Supplier confirmed resubmission by email" className="input min-h-[64px] resize-y py-2 text-sm" />
      </label>
      {toast && (
        <div role="status" className={`flex flex-wrap items-center gap-2 rounded-lg px-3.5 py-3 text-sm font-medium ${status === 'yes' ? 'bg-accent-soft text-accent-text' : 'bg-line-soft text-ink-700'}`}>
          <span>{toast}</span>
          <span className="ml-auto text-xs">{nextId ? 'Opening next pair…' : 'That was the last pending pair.'}</span>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-high-fg">{error}</p>}
      <p className="text-xs text-ink-500">Time on this pair is logged with your decision.</p>
    </section>
  );
}

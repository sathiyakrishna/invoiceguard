'use client';
import { useRef, useState } from 'react';

const GENERIC_ERROR = 'We couldn’t delete your account. Please try again.';

export default function DeleteAccount() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setTyped('');
    setError(null);
    dialog.current?.showModal();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: typed }) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === 'string' ? data.error : GENERIC_ERROR);
      }
      window.location.assign('/?account_deleted=1');
    } catch (e) {
      setError(e instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : e instanceof Error ? e.message : GENERIC_ERROR);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={open} className="btn-secondary self-start border-high-fg text-high-fg">Delete my account</button>
      <dialog
        ref={dialog}
        aria-labelledby="del-title"
        // keep the dialog open while the request is running
        onCancel={(e) => busy && e.preventDefault()}
        className="w-[min(92vw,460px)] rounded-xl p-6 shadow-xl backdrop:bg-black/50"
      >
        <h2 id="del-title" className="text-lg font-semibold">Delete your account?</h2>
        <p className="mt-2 text-sm text-ink-700">This permanently deletes your account and all your scans, invoices, duplicate pairs and decisions. It cannot be undone.</p>
        <label htmlFor="del-confirm" className="mt-4 block text-sm font-medium">Type <span className="font-mono font-bold">DELETE</span> to confirm</label>
        <input
          id="del-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="mt-1.5 min-h-11 w-full rounded-lg border border-line-input px-3 font-mono text-sm"
        />
        {error && <p role="alert" className="mt-3 text-sm text-high-fg">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => dialog.current?.close()} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={remove} disabled={typed !== 'DELETE' || busy} aria-busy={busy} className="inline-flex min-h-11 items-center rounded-lg bg-high-fg px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </dialog>
    </>
  );
}

'use client';
import { useState } from 'react';

const GENERIC_ERROR = 'Could not build the summary file. Please try again.';

export default function DownloadSummary({ range }: { range: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/export/summary?range=${encodeURIComponent(range)}`);
      if (!res.ok) throw new Error(res.status === 401 ? 'Sign in again to download the summary.' : GENERIC_ERROR);
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `invoiceguard-summary-${range}.xlsx`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // a network failure surfaces as a TypeError from fetch
      setError(e instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : e instanceof Error ? e.message : GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={download} disabled={busy} aria-busy={busy} className="inline-flex min-h-11 items-center rounded-lg border border-sky-300 px-4 text-sm font-semibold text-white hover:bg-navy-600 disabled:cursor-wait disabled:opacity-70">
        {busy ? 'Preparing file…' : 'Download summary (Excel)'}
      </button>
      {error && <p role="alert" className="max-w-[260px] text-xs text-[#FCA5A5]">{error}</p>}
    </div>
  );
}

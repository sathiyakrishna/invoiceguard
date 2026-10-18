'use client';
import { useState } from 'react';

export default function ShareSummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* user cancelled */
    }
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-11 items-center rounded-lg border border-sky-300 px-4 text-sm font-semibold text-white hover:bg-navy-600">
      {copied ? 'Summary copied' : 'Share summary'}
    </button>
  );
}

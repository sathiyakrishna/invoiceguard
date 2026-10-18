'use client';
import { useState } from 'react';

const Q: [string, string][] = [
  ['Does this replace SAP’s duplicate check?', 'No. It adds a second check before the payment run, aimed at the variants the standard check is not designed to catch.'],
  ['Does it replace a recovery audit?', 'It reduces how much a recovery audit finds by stopping duplicates before payment. Keep your existing controls for anything already paid.'],
  ['Does AI decide what gets blocked?', 'No. Rules find candidate pairs, AI explains the evidence, and you classify each pair yourself.'],
  ['Is my data safe?', 'Your workspace is private to your account, files are deleted after 30 days, and only flagged pairs are sent to the AI for explanation. Please use anonymized data during the beta.'],
  ['What does it cost?', 'It is free during the beta, with daily and monthly limits on scans and AI explanations.']
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col gap-3.5">
      {Q.map(([q, a], i) => (
        <div key={q} className="rounded-xl bg-[#EEF2FB]">
          <h3>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex min-h-14 w-full items-center justify-between gap-4 px-6 py-5 text-left text-lg font-bold text-navy">
              {q}<span aria-hidden="true" className="text-2xl font-normal">{open === i ? '−' : '+'}</span>
            </button>
          </h3>
          {open === i && <p className="px-6 pb-5 text-base leading-relaxed text-ink-700">{a}</p>}
        </div>
      ))}
    </div>
  );
}

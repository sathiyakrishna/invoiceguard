'use client';
import { useState } from 'react';

const Q: [string, string][] = [
  ['Does this replace SAP’s duplicate check?', 'No. It adds a second check before the payment run, aimed at the variants the standard check is not designed to catch.'],
  ['Does it replace a recovery audit?', 'It reduces how much a recovery audit finds by stopping duplicates before payment. Keep your existing controls for anything already paid.'],
  ['Does AI decide what gets blocked?', 'No. Rules find candidate pairs, AI explains the evidence, and you classify each pair yourself.'],
  ['Is my data safe?', 'Your workspace is private to your account, files are deleted after 30 days, and only flagged pairs are sent to the AI for explanation. Please use anonymized data during the beta.'],
  ['Which file types can I upload?', 'CSV, Excel (.xlsx) and PDF, up to 10 MB and 20,000 rows. PDFs must be text-based, exported from your ERP or a spreadsheet. Scanned PDFs aren’t supported yet, so export your register as CSV or Excel instead. PDFs can be up to 100 pages.'],
  ['What does it cost?', 'It is free during the beta, with daily and monthly limits on scans and AI explanations.']
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col gap-3.5">
      {Q.map(([q, a], i) => (
        <div key={q} className="rounded-2xl bg-[#EEF3FF]">
          <h3>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex min-h-14 w-full items-center justify-between gap-4 px-6 py-5 text-left text-xl font-bold text-[#0B1F4D]">
              {q}<span aria-hidden="true" className="text-3xl font-normal text-[#1D4ED8]">{open === i ? '−' : '+'}</span>
            </button>
          </h3>
          {open === i && <p className="px-6 pb-6 text-[17px] leading-[1.6] text-ink-700 sm:text-lg">{a}</p>}
        </div>
      ))}
    </div>
  );
}

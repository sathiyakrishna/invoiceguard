import { Suspense } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { RiskBadge } from '@/components/RiskBadge';
import Faq from '@/components/Faq';
import P2PAnimation from '@/components/P2PAnimation';
import Testimonials from '@/components/Testimonials';
import AccountDeletedNotice from '@/components/AccountDeletedNotice';

const PREVIEW = [
  { band: 'High' as const, vendor: 'Bosch Ltd', refs: 'INV-0012 · INV0012', amt: '₹1,25,000.00' },
  { band: 'High' as const, vendor: 'Tata Steel Ltd', refs: 'CC 1000 · CC 2000', amt: '₹4,82,600.00' },
  { band: 'Medium' as const, vendor: 'Lucas TVS', refs: 'LT-40417 · LT-40471', amt: '₹2,14,900.00' },
  { band: 'Low' as const, vendor: 'Wipro Ltd', refs: 'WI-7730 · WI-7737', amt: '₹36,000.00' }
];

// Facts from our own testing on the sample register (tests/sample.test.ts) and the scan flow.
const PROOF = [
  ['100% recall', 'on near-duplicate test cases, including ones exact-match tools miss'],
  ['Zero', 'recurring charges falsely flagged'],
  ['< 2 min', 'to the first flagged pair'],
  ['Every flag', 'shows its evidence']
];

const GAPS = [
  ['INV-0012 vs INV0012', 'Reference format changes', 'A hyphen, space or leading zero makes the same invoice look new to a character-by-character check.'],
  ['CC 1000 vs CC 2000', 'Same invoice, two company codes', 'Standard checks run within one company code, so a cross-entity posting slips through.'],
  ['V10021 vs V20450', 'Same supplier, two vendor accounts', 'Duplicate vendor master records hide the same invoice under different vendor account numbers.']
];

const STEPS = [
  ['Upload the payment run', 'Drop in the CSV, Excel or PDF export of invoices you are about to pay. PDFs must be text-based, exported from your ERP or a spreadsheet, not scanned. Include clearing dates and an invoice already paid in an earlier run is checked too. Columns, including SAP field names, are mapped automatically.'],
  ['Prioritise by risk', 'Duplicate pairs are scored and sorted red, amber and green, each with an age and duplicate type.'],
  ['Review the evidence', 'See both invoices side by side, with the earlier one marked paid or open, the vendor’s ledger and a plain-language AI explanation. Classify Yes, No or Ignore.'],
  ['Track what you prevented', 'Your dashboard shows payment value prevented, pending pairs by risk and your false-positive rate, updated as you decide.']
];

const WHY = [
  ['Prevention, not recovery', 'Stop the duplicate before payment instead of chasing suppliers and paying a recovery firm months later.'],
  ['Evidence for every flag', 'Every pair shows the rules that fired and the fields that match, so you never act on a black-box score.'],
  ['You stay in control', 'AI explains and suggests; you make every decision, with a record of what you decided and when.'],
  ['Private by design', 'Each account is a private workspace. Files are deleted after 30 days, and you can delete your data any time.']
];

// Shared classes. Contrast: #2563EB on white / #EEF3FF is 5.2 / 4.7, #1D4ED8 on white is 6.7, white on #2563EB is 5.2.
const H2 = 'text-[34px] font-extrabold leading-[1.05] tracking-[-1.5px] text-[#0B1F4D] sm:text-[52px]';
const CARD_TITLE = 'text-[26px] font-extrabold leading-[1.1] tracking-[-0.5px] text-[#0B1F4D] sm:text-[32px]';
const EYEBROW = 'text-[18px] font-bold uppercase tracking-wide text-[#2563EB]';
const BODY = 'text-[17px] leading-[1.6] text-ink-700 sm:text-[20px]';
const BTN = 'inline-flex min-h-14 items-center justify-center rounded-lg px-7 text-base font-semibold';
const BTN_PRIMARY = `${BTN} bg-[#1D4ED8] text-white hover:bg-[#1E3A8A]`;
const BTN_SECONDARY = `${BTN} border-2 border-[#1D4ED8] bg-white text-[#1D4ED8] hover:bg-[#EEF3FF]`;
const SOFT_CARD = 'rounded-3xl bg-white p-8 shadow-[0_12px_32px_rgba(11,31,77,0.10)] sm:p-10';

export default function Landing() {
  return (
    <div className="overflow-x-clip bg-white text-ink">
      <div className="bg-gradient-to-b from-[#EEF3FF] to-white">
        <div className="px-4 pt-4 sm:px-6 sm:pt-6 empty:hidden"><Suspense fallback={null}><AccountDeletedNotice /></Suspense></div>
        <header className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="mx-auto flex max-w-[1240px] items-center gap-4 rounded-2xl bg-[#0B1F4D] px-5 py-3 shadow-[0_12px_28px_rgba(11,31,77,0.30)] sm:gap-6 sm:px-7">
            <Link href="/" aria-label="InvoiceGuard home"><Logo /></Link>
            <nav aria-label="Page" className="ml-auto hidden gap-7 text-[17px] font-bold md:flex">
              <a href="#how" className="text-white hover:underline">How it works</a>
              <a href="#why" className="text-white hover:underline">Why InvoiceGuard</a>
              <a href="#faq" className="text-white hover:underline">FAQ</a>
            </nav>
            <Link href="/login" className={`${BTN} ml-auto bg-[#2563EB] hover:bg-[#1D4ED8] md:ml-0 text-white`}>Sign in</Link>
          </div>
        </header>

        <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-6 pb-12 pt-14 sm:px-8 sm:pt-20">
          <div className="flex flex-[1_1_480px] flex-col gap-7">
            <p className={EYEBROW}>Duplicate payment prevention for SAP AP teams</p>
            <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-[-2px] text-[#0B1F4D] sm:text-[56px] lg:text-[72px]">Catch duplicate invoices before the payment run.</h1>
            <p className={`max-w-xl ${BODY}`}>Upload your payment-run register. InvoiceGuard flags the duplicates SAP’s standard check misses, explains the evidence for each one, and lets you block them in minutes.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className={BTN_PRIMARY}>Try it free with Google</Link>
              <a href="#how" className={BTN_SECONDARY}>See how it works</a>
            </div>
            <p className="text-base text-ink-500">Free during the beta, no credit card, and your data stays private to your account.</p>
          </div>

          <div aria-hidden="true" className="flex-[1_1_420px]">
            <div className="rounded-[40px] bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] p-5 shadow-[0_24px_60px_rgba(29,78,216,0.35)] sm:p-9">
              <div className="rotate-[2.5deg] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_40px_rgba(11,31,77,0.25)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:rotate-0">
                <div className="flex justify-between gap-3 bg-[#0B1F4D] px-5 py-3 text-[13px] font-semibold text-white"><span>Risk queue</span><span className="font-mono">payment_run_wk42.csv</span></div>
                {PREVIEW.map((p) => (
                  <div key={p.refs} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-soft px-4 py-3 text-[13px] sm:px-5">
                    <RiskBadge band={p.band} />
                    <span className="min-w-0"><span className="font-semibold">{p.vendor}</span><br /><span className="break-words font-mono text-ink-500">{p.refs}</span></span>
                    <span className="font-mono">{p.amt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Results from our testing" className="mx-auto max-w-[1240px] px-6 pb-16 sm:px-8">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t border-[#C7D6F5] pt-10 lg:grid-cols-4">
            <div className="col-span-2 flex flex-col gap-1 lg:col-span-4">
              <dt className="order-2 text-base leading-snug text-ink-500">reference format changes, cross company code postings, alternate vendor accounts</dt>
              <dd className="text-[40px] font-extrabold leading-[1.05] tracking-[-1px] text-[#1D4ED8]">Catches what SAP misses</dd>
            </div>
            {PROOF.map(([big, label]) => (
              <div key={big} className="flex flex-col gap-1">
                <dt className="order-2 text-base leading-snug text-ink-500">{label}</dt>
                <dd className="text-[40px] font-extrabold leading-none tracking-[-1px] text-[#1D4ED8]">{big}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="flow" className="mx-auto hidden max-w-[1240px] px-6 pb-4 pt-16 sm:px-8 md:block">
        <h2 id="flow" className={`mb-3 max-w-3xl ${H2}`}>Where the duplicate gets caught</h2>
        <p className={`mb-8 max-w-2xl ${BODY}`}>InvoiceGuard scans the payment proposal after the invoices are posted and before the money moves.</p>
        <P2PAnimation />
      </section>

      <section aria-labelledby="gap" className="mx-auto max-w-[1240px] px-6 py-20 sm:px-8">
        <h2 id="gap" className={`mb-10 max-w-3xl ${H2}`}>What SAP’s duplicate check lets through</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {GAPS.map(([ex, t, d]) => (
            <div key={t} className="flex flex-col gap-4 rounded-3xl border border-line p-8 shadow-[0_8px_24px_rgba(11,31,77,0.06)]">
              <span className="self-start rounded-lg bg-high-row px-3 py-2 font-mono text-[15px] text-high-fg">{ex}</span>
              <span className={CARD_TITLE}>{t}</span>
              <span className={BODY}>{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="leak" className="bg-[#EEF3FF]">
        <div className="mx-auto grid max-w-[1240px] items-stretch gap-8 px-6 py-20 sm:px-8 lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-8 rounded-3xl bg-[#0B1F4D] p-8 text-white shadow-[0_12px_32px_rgba(11,31,77,0.25)] sm:p-10">
            <div>
              <p className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.5px] sm:text-[32px]">Financial leakage</p>
              <p className="mt-2 text-[17px] leading-[1.6] text-[#C9D2E3] sm:text-[20px]">The money that leaves before anyone notices</p>
              <p className="mt-6 text-[40px] font-extrabold leading-none tracking-[-1px] text-white">Up to 2%</p>
              <p className="mt-2 text-[17px] leading-[1.6] text-[#C9D2E3] sm:text-[20px]">of AP payments are duplicate or erroneous</p>
              <p className="mt-2 text-sm text-[#C9D2E3]">Source: <a href="https://www.apqc.org/resource-library/resource-listing/percentage-duplicate-disbursements-processed" target="_blank" rel="noopener noreferrer" className="text-[#93C5FD] underline hover:text-[#BFDBFE]">APQC Open Standards Benchmarking</a>, Accounts Payable</p>
            </div>
            <svg role="img" aria-label="Illustration: bars of payments rising, with a magnifier highlighting one that leaks out" viewBox="0 0 400 260" className="h-auto w-full max-w-[460px] self-center">
              <line x1="20" y1="230" x2="380" y2="230" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
              <line x1="20" y1="170" x2="380" y2="170" stroke="#3B82F6" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="4 6" />
              <line x1="20" y1="110" x2="380" y2="110" stroke="#3B82F6" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="4 6" />
              <rect x="40" y="170" width="38" height="60" rx="6" fill="#1D4ED8" />
              <rect x="94" y="140" width="38" height="90" rx="6" fill="#2563EB" />
              <rect x="148" y="150" width="38" height="80" rx="6" fill="#1D4ED8" />
              <rect x="202" y="100" width="38" height="130" rx="6" fill="#3B82F6" />
              <rect x="256" y="120" width="38" height="110" rx="6" fill="#2563EB" />
              <rect x="310" y="60" width="38" height="170" rx="6" fill="#60A5FA" />
              <rect x="310" y="60" width="38" height="42" rx="6" fill="none" stroke="#BFDBFE" strokeWidth="2" strokeDasharray="5 5" />
              <circle cx="290" cy="82" r="38" fill="#0B1F4D" fillOpacity="0.55" stroke="#BFDBFE" strokeWidth="6" />
              <line x1="317" y1="109" x2="352" y2="144" stroke="#BFDBFE" strokeWidth="9" strokeLinecap="round" />
              <path d="M274 82h32M290 66v32" stroke="#93C5FD" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>

          <div className={`flex flex-col gap-5 ${SOFT_CARD}`}>
            <p className={EYEBROW}>Financial leakage</p>
            <h2 id="leak" className="text-[30px] font-extrabold leading-[1.08] tracking-[-1px] text-[#0B1F4D] sm:text-[40px]">Duplicate payments are a quiet, expensive leak</h2>
            <p className={BODY}>Duplicate payments, invoice errors and missed credit notes slip past standard ERP checks every day. Most are found months later by recovery auditors, who are paid a share of whatever they recover, after the cash has already left.</p>
            <aside aria-label="Worked example, not a statistic" className="rounded-2xl border-l-4 border-[#1D4ED8] bg-[#EEF3FF] px-5 py-4">
              <p className="text-sm font-bold uppercase tracking-wide text-[#1D4ED8]">Example</p>
              <p className="mt-1 text-base leading-relaxed text-ink-700 sm:text-[17px]">If just 0.1% of a <span className="font-mono text-[15px]">₹1,000 crore</span> annual spend is paid twice, that’s <span className="font-mono text-[15px]">₹1 crore</span> leaving the business. InvoiceGuard checks every payment run before it goes out.</p>
            </aside>
            <Link href="/login" className={`${BTN_PRIMARY} mt-auto self-start`}>Check your payment run</Link>
          </div>
        </div>
      </section>

      <section id="how" aria-labelledby="howh" className="mx-auto max-w-[1240px] px-6 py-20 sm:px-8">
        <h2 id="howh" className={`mb-10 ${H2}`}>How it works</h2>
        <ol className="grid gap-6 md:grid-cols-2">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex flex-col gap-4 rounded-3xl bg-[#EEF3FF] p-8 sm:p-10">
              {/* white on the light end of the gradient is 3.7:1, so the label is large bold text (3:1 needed) */}
              <span className="self-start rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] px-5 py-1.5 text-[19px] font-extrabold uppercase tracking-wide text-white">Step {i + 1}</span>
              <span className={CARD_TITLE}>{t}</span>
              <span className={BODY}>{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="why" aria-labelledby="whyh" className="bg-[#EEF3FF]">
        <div className="mx-auto max-w-[1240px] px-6 py-20 sm:px-8">
          <h2 id="whyh" className={`mb-10 ${H2}`}>Why InvoiceGuard</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {WHY.map(([t, d]) => (
              <div key={t} className={`flex flex-col gap-4 ${SOFT_CARD}`}>
                <span className={CARD_TITLE}>{t}</span>
                <span className={BODY}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="testih" className="mx-auto max-w-[1240px] px-6 py-20 sm:px-8">
        <h2 id="testih" className={`mb-3 max-w-3xl ${H2}`}>What early testers are saying</h2>
        <p className={`mb-10 max-w-2xl ${BODY}`}>Feedback from professionals who tried the InvoiceGuard prototype.</p>
        <Testimonials />
      </section>

      <section id="faq" aria-labelledby="faqh" className="mx-auto max-w-3xl px-6 py-20 sm:px-8">
        <h2 id="faqh" className={`mb-10 text-center ${H2}`}>Frequently asked questions</h2>
        <Faq />
      </section>

      {/* final call to action on a navy-to-blue band with a curved top edge */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#0B1F4D] to-[#1D4ED8] text-white">
        <div aria-hidden="true" className="absolute inset-x-[-10%] top-0 h-14 rounded-b-[100%] bg-white sm:h-20" />
        <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-8 px-6 pb-20 pt-32 sm:px-8 sm:pt-40">
          <div className="max-w-2xl">
            <h2 className="text-[34px] font-extrabold leading-[1.05] tracking-[-1.5px] text-white sm:text-[52px]">Check your next payment run before it goes out.</h2>
            <p className="mt-4 text-[17px] leading-[1.6] text-[#DBEAFE] sm:text-[20px]">Sign in with Google and scan a register in under two minutes.</p>
          </div>
          <Link href="/login" className={`${BTN} bg-white text-[#0B1F4D] hover:bg-[#EEF3FF]`}>Try it free</Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 px-6 py-8 text-base text-ink-500 sm:px-8">
        <span>InvoiceGuard, built for the HelloPM AI Product Management buildathon</span>
        <span><Link href="/privacy" className="text-[#1D4ED8] underline">Privacy</Link> · <Link href="/terms" className="text-[#1D4ED8] underline">Terms</Link></span>
      </footer>
    </div>
  );
}

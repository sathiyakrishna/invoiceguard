import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { RiskBadge } from '@/components/RiskBadge';
import Faq from '@/components/Faq';

const PREVIEW = [
  { band: 'High' as const, vendor: 'Bosch Ltd', refs: 'INV-0012 · INV0012', amt: '₹1,25,000.00' },
  { band: 'High' as const, vendor: 'Tata Steel Ltd', refs: 'CC 1000 · CC 2000', amt: '₹4,82,600.00' },
  { band: 'Medium' as const, vendor: 'Lucas TVS', refs: 'LT-40417 · LT-40471', amt: '₹2,14,900.00' },
  { band: 'Low' as const, vendor: 'Wipro Ltd', refs: 'WI-7730 · WI-7737', amt: '₹36,000.00' }
];

const GAPS = [
  ['INV-0012 vs INV0012', 'Reference format changes', 'A hyphen, space or leading zero makes the same invoice look new to a character-by-character check.'],
  ['CC 1000 vs CC 2000', 'Same invoice, two company codes', 'Standard checks run within one company code, so a cross-entity posting slips through.'],
  ['V10021 vs V20450', 'Same supplier, two vendor IDs', 'Duplicate vendor master records hide the same invoice under different vendor numbers.']
];

const STEPS = [
  ['Upload the payment run', 'Drop in the CSV or Excel export of invoices you are about to pay. Columns, including SAP field names, are mapped automatically.'],
  ['Prioritise by risk', 'Duplicate pairs are scored and sorted red, amber and green, each with an age and duplicate type.'],
  ['Review the evidence', 'See both invoices side by side, the vendor’s ledger and a plain-language AI explanation. Classify Yes, No or Ignore.'],
  ['Track what you prevented', 'Your dashboard shows payment value prevented, pending pairs by risk and your false-positive rate, updated as you decide.']
];

const WHY = [
  ['Prevention, not recovery', 'Stop the duplicate before payment instead of chasing suppliers and paying a recovery firm months later.'],
  ['Evidence for every flag', 'Every pair shows the rules that fired and the fields that match, so you never act on a black-box score.'],
  ['You stay in control', 'AI explains and suggests; you make every decision, with a record of what you decided and when.'],
  ['Private by design', 'Each account is a private workspace. Files are deleted after 30 days, and you can delete your data any time.']
];

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="bg-navy">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-4 sm:px-8">
          <Link href="/"><Logo /></Link>
          <nav aria-label="Page" className="ml-auto hidden gap-5 text-[15px] sm:flex">
            <a href="#how" className="text-[#E6EAF2] hover:text-white">How it works</a>
            <a href="#why" className="text-[#E6EAF2] hover:text-white">Why InvoiceGuard</a>
            <a href="#faq" className="text-[#E6EAF2] hover:text-white">FAQ</a>
          </nav>
          <Link href="/login" className="btn-primary ml-auto sm:ml-0">Sign in</Link>
        </div>
      </header>

      <section className="bg-[#F3F5FA]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-6 pb-16 pt-16 sm:px-8 sm:pt-20">
          <div className="flex flex-[1_1_460px] flex-col gap-6">
            <p className="text-sm font-semibold text-high-fg">Duplicate payment prevention for SAP AP teams</p>
            <h1 className="text-[40px] font-bold leading-[1.06] tracking-tight text-navy sm:text-[52px]">Catch duplicate invoices before the payment run.</h1>
            <p className="max-w-xl text-[19px] leading-relaxed text-ink-700">Upload your payment-run register. InvoiceGuard flags the duplicates SAP’s standard check misses, explains the evidence for each one, and lets you block them in minutes.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary min-h-[52px] px-6 text-base">Try it free with Google</Link>
              <a href="#how" className="inline-flex min-h-[52px] items-center rounded-lg border border-accent bg-white px-6 text-base font-semibold text-accent">See how it works</a>
            </div>
            <p className="text-sm text-ink-500">Free during the beta, no credit card, and your data stays private to your account.</p>
          </div>
          <div aria-hidden="true" className="flex-[1_1_440px] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_40px_rgba(20,33,61,0.12)]">
            <div className="flex justify-between bg-navy px-5 py-3 text-[13px] font-semibold text-white"><span>Risk queue</span><span className="font-mono">payment_run_wk42.csv</span></div>
            {PREVIEW.map((p) => (
              <div key={p.refs} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 border-b border-line-soft px-5 py-3 text-[13px]">
                <RiskBadge band={p.band} />
                <span><span className="font-semibold">{p.vendor}</span><br /><span className="font-mono text-ink-500">{p.refs}</span></span>
                <span className="font-mono">{p.amt}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="gap" className="mx-auto max-w-6xl px-6 pb-6 pt-16 sm:px-8">
        <h2 id="gap" className="mb-6 text-[32px] font-bold tracking-tight text-navy">What SAP’s duplicate check lets through</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {GAPS.map(([ex, t, d]) => (
            <div key={t} className="flex flex-col gap-2.5 rounded-xl border border-line p-6">
              <span className="self-start rounded-lg bg-high-row px-3 py-2 font-mono text-[15px] text-high-fg">{ex}</span>
              <span className="text-[17px] font-semibold">{t}</span>
              <span className="text-[15px] leading-relaxed text-ink-700">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="how" aria-labelledby="howh" className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        <h2 id="howh" className="mb-7 text-[32px] font-bold tracking-tight text-navy">How it works</h2>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex flex-col gap-3 rounded-xl bg-[#F3F5FA] p-6">
              <span className="self-start rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white">Step {i + 1}</span>
              <span className="text-[19px] font-bold text-navy">{t}</span>
              <span className="text-[15px] leading-relaxed text-ink-700">{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="why" aria-labelledby="whyh" className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <h2 id="whyh" className="mb-7 text-[32px] font-bold tracking-tight">Why InvoiceGuard</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map(([t, d]) => (
              <div key={t} className="flex flex-col gap-2.5 rounded-xl border border-navy-500 bg-navy-700 p-6">
                <span className="text-lg font-bold">{t}</span>
                <span className="text-[15px] leading-relaxed text-[#C9D2E3]">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faqh" className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
        <h2 id="faqh" className="mb-6 text-center text-[32px] font-bold tracking-tight text-navy">Frequently asked questions</h2>
        <Faq />
      </section>

      <section className="bg-[#F3F5FA]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-14 sm:px-8">
          <div>
            <h2 className="text-[28px] font-bold tracking-tight text-navy">Check your next payment run before it goes out.</h2>
            <p className="mt-2 text-base text-ink-700">Sign in with Google and scan a register in under two minutes.</p>
          </div>
          <Link href="/login" className="btn-primary min-h-[52px] px-7 text-base">Try it free</Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-7 text-sm text-ink-500 sm:px-8">
        <span>InvoiceGuard, built for the HelloPM AI Product Management buildathon</span>
        <span><Link href="/privacy" className="text-accent">Privacy</Link> · <Link href="/terms" className="text-accent">Terms</Link></span>
      </footer>
    </div>
  );
}

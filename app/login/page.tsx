import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { RiskBadge } from '@/components/RiskBadge';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

const PREVIEW = [
  { band: 'High' as const, refs: 'INV-0012 · INV0012', amt: '₹1,25,000.00' },
  { band: 'Medium' as const, refs: 'LT-40417 · LT-40471', amt: '₹2,14,900.00' },
  { band: 'Low' as const, refs: 'WI-7730 · WI-7737', amt: '₹36,000.00' }
];

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <section aria-label="About InvoiceGuard" className="flex flex-[1_1_520px] flex-col gap-10 bg-navy px-8 py-10 text-[#E6EAF2] sm:px-14 sm:py-12">
        <Link href="/" className="self-start"><Logo /></Link>
        <div className="mt-auto flex max-w-xl flex-col gap-4">
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-1.5px] text-white sm:text-[52px]">Stop duplicate payments before the payment run.</h1>
          <p className="text-[17px] leading-[1.6] text-[#DBEAFE] sm:text-[19px]">InvoiceGuard checks your payment-run register for the duplicates SAP’s standard check misses: reference format changes, the same invoice in two company codes, and alternate vendor accounts. Every flag comes with its evidence.</p>
        </div>
        <div aria-hidden="true" className="flex max-w-xl flex-col gap-2.5 rounded-xl border border-navy-500 bg-navy-700 p-4">
          {PREVIEW.map((p) => (
            <div key={p.refs} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 rounded-lg bg-navy-600 px-3 py-2.5 text-[13px]">
              <RiskBadge band={p.band} />
              <span className="font-mono text-white">{p.refs}</span>
              <span className="font-mono text-white">{p.amt}</span>
            </div>
          ))}
        </div>
        <ul className="mb-auto grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            ['Rules find', 'Normalized references, amounts, dates and company codes'],
            ['AI explains', 'Matches vendor names and explains each flag in plain words'],
            ['You decide', 'Yes, No or Ignore, with a full audit trail']
          ].map(([t, d]) => (
            <li key={t} className="flex flex-col gap-1.5">
              <span className="text-lg font-bold text-white">{t}</span>
              <span className="text-[15px] leading-snug text-[#DBEAFE]">{d}</span>
            </li>
          ))}
        </ul>
      </section>
      <main className="flex flex-[1_1_440px] flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#EEF3FF] to-white px-6 py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-3xl bg-white p-8 shadow-[0_12px_32px_rgba(11,31,77,0.10)] sm:p-10">
          <div>
            <h2 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.5px]">Sign in</h2>
            <p className="mt-1 text-[15px] text-ink-500">Free during the beta. No credit card.</p>
          </div>
          <LoginForm googleError={searchParams.error === 'google'} />
          <p className="text-[13px] leading-relaxed text-ink-500">Your data is private to your account and deleted after 30 days. Please use anonymized data, not live company files.</p>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center text-[13px] text-ink-500">
          <span>Built for the HelloPM AI Product Management buildathon</span>
          <span><Link href="/privacy" className="text-accent underline">Privacy</Link> · <Link href="/terms" className="text-accent underline">Terms</Link></span>
        </div>
      </main>
    </div>
  );
}

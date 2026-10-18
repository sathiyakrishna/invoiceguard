'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo, Shield } from './Logo';
import type { UsageSummary } from '@/lib/limits';

const ICONS: Record<string, JSX.Element> = {
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  queue: <path d="M4 6h16M4 12h16M4 18h10" />,
  dashboard: <path d="M5 20V10M12 20V4M19 20v-7" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>
};

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, max ? Math.round((used / max) * 100) : 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px]"><span>{label}</span><span className="font-mono tnum">{used} / {max}</span></div>
      <div role="progressbar" aria-label={`${label} used`} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} className="h-1.5 rounded bg-navy-500">
        <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: pct >= 80 ? '#F5B83D' : '#7DA2FF' }} />
      </div>
    </div>
  );
}

export default function Sidebar({ pending, usage, email }: { pending: number; usage: UsageSummary; email: string }) {
  const path = usePathname();
  const items = [
    { href: '/upload', label: 'Upload', icon: 'upload' },
    { href: '/queue', label: 'Risk queue', icon: 'queue', badge: pending },
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/settings', label: 'Settings', icon: 'settings' }
  ];
  const l = usage.limits;
  const monthScans = usage.isDemo ? 'No limit' : `${usage.scansMonth} of ${l.scansMonth}`;
  const monthAi = usage.isDemo ? 'No limit' : `${usage.aiMonth} of ${l.aiMonth}`;
  const usageTip = `Today: ${usage.scansToday} of ${l.scansDay} scans, ${usage.aiToday} of ${l.aiDay} AI calls. This month: ${monthScans} scans, ${monthAi} AI calls.`;
  // Phone: top bar. 768-1279px: icon-only rail (w-16). 1280px and up: 220px sidebar.
  return (
    <nav aria-label="Main" className="flex w-full flex-col gap-6 bg-navy px-4 py-5 text-[#E6EAF2] md:sticky md:top-0 md:h-screen md:w-16 md:shrink-0 md:gap-5 md:px-2 xl:w-[220px] xl:px-4 xl:py-6">
      <Link href="/queue" className="px-2 md:max-xl:flex md:max-xl:justify-center md:max-xl:px-0" title="InvoiceGuard" aria-label="InvoiceGuard">
        <span className="md:max-xl:hidden"><Logo /></span>
        <span className="hidden md:max-xl:block"><Shield /></span>
      </Link>
      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + '/');
          return (
            <li key={it.href}>
              <Link href={it.href} title={it.label} aria-label={it.badge ? `${it.label}, ${it.badge} pending` : it.label} aria-current={active ? 'page' : undefined} className={`relative flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm md:max-xl:justify-center md:max-xl:px-0 ${active ? 'bg-navy-600 font-semibold text-white' : 'text-[#C9D2E3] hover:bg-navy-700 hover:text-white'}`}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[it.icon]}</svg>
                <span className="md:max-xl:sr-only">{it.label}</span>
                {!!it.badge && <span aria-hidden="true" className="ml-auto rounded-full bg-high-fg px-2 py-0.5 text-xs font-semibold text-white md:max-xl:absolute md:max-xl:right-0.5 md:max-xl:top-0.5 md:max-xl:ml-0 md:max-xl:px-1.5 md:max-xl:py-0 md:max-xl:text-[10px] md:max-xl:leading-4">{it.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* compact credit meter for the icon rail; hover for the full numbers */}
      <div title={usageTip} className="mt-auto hidden flex-col items-center gap-2 rounded-lg bg-navy-700 px-1 py-2 text-center md:max-xl:flex">
        <span className="sr-only">{usageTip}</span>
        <div aria-hidden="true" className="flex flex-col items-center gap-0.5 leading-tight"><span className="text-[10px] text-[#A9B3C6]">Scans</span><span className="font-mono text-[11px] tnum">{usage.scansToday}/{l.scansDay}</span></div>
        <div aria-hidden="true" className="flex flex-col items-center gap-0.5 leading-tight"><span className="text-[10px] text-[#A9B3C6]">AI</span><span className="font-mono text-[11px] tnum">{usage.aiToday}/{l.aiDay}</span></div>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 rounded-xl bg-navy-700 p-4 md:max-xl:hidden">
        <div className="text-xs font-semibold text-[#A9B3C6]">Today</div>
        <Meter label="Scans" used={usage.scansToday} max={l.scansDay} />
        <Meter label="AI calls" used={usage.aiToday} max={l.aiDay} />
        <div className="text-xs text-[#A9B3C6]">Resets at midnight IST</div>
        <div className="h-px bg-navy-500" />
        <div className="text-xs font-semibold text-[#A9B3C6]">This month</div>
        <div className="flex justify-between gap-3 text-[13px]"><span>Scans</span><span className="text-right font-mono tnum">{usage.isDemo ? 'No limit' : `${usage.scansMonth} / ${l.scansMonth}`}</span></div>
        <div className="flex justify-between gap-3 text-[13px]"><span>AI calls</span><span className="text-right font-mono tnum">{usage.isDemo ? 'No limit' : `${usage.aiMonth} / ${l.aiMonth}`}</span></div>
        <div className="text-xs text-[#A9B3C6]">Rule checks never use credits</div>
      </div>
      <div className="truncate px-2 text-xs text-[#A9B3C6] md:max-xl:hidden" title={email}>{email}</div>
    </nav>
  );
}

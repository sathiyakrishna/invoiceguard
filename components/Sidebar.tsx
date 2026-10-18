'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
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
  return (
    <nav aria-label="Main" className="flex max-w-full flex-[1_1_232px] flex-col gap-6 bg-navy px-4 py-6 text-[#E6EAF2] md:sticky md:top-0 md:h-screen md:max-w-[260px]">
      <Link href="/queue" className="px-2"><Logo /></Link>
      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + '/');
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm ${active ? 'bg-navy-600 font-semibold text-white' : 'text-[#C9D2E3] hover:bg-navy-700 hover:text-white'}`}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[it.icon]}</svg>
                {it.label}
                {!!it.badge && <span className="ml-auto rounded-full bg-high-fg px-2 py-0.5 text-xs font-semibold text-white">{it.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col gap-2.5 rounded-xl bg-navy-700 p-4">
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
      <div className="truncate px-2 text-xs text-[#A9B3C6]" title={email}>{email}</div>
    </nav>
  );
}

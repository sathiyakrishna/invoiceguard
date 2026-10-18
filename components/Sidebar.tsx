'use client';
import { useEffect } from 'react';
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
      <div className="flex justify-between text-[13px]"><span>{label}</span><span className="tnum">{used} / {max}</span></div>
      <div role="progressbar" aria-label={`${label} used`} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} className="h-1.5 rounded bg-navy-500">
        <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: pct >= 80 ? '#F5B83D' : '#7DA2FF' }} />
      </div>
    </div>
  );
}

const STORAGE_KEY = 'ig-sidebar';

// Flip between the 220px sidebar and the 64px rail (768px and up). The choice lives on <html data-sb> so CSS
// reacts without a re-render, and in localStorage so it survives page loads. With no saved choice the rail
// is the default under 1280px and the full sidebar above it.
function toggleRail() {
  const el = document.documentElement;
  const isRail = el.dataset.sb ? el.dataset.sb === 'rail' : !window.matchMedia('(min-width: 1280px)').matches;
  const next = isRail ? 'full' : 'rail';
  el.dataset.sb = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode: the choice just will not persist */ }
}

const TOGGLE_BTN = 'h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#C9D2E3] hover:bg-navy-700 hover:text-white';

export default function Sidebar({ pending, usage, email }: { pending: number; usage: UsageSummary; email: string }) {
  const path = usePathname();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // typing
      if (!window.matchMedia('(min-width: 768px)').matches) return; // phones keep the top bar
      toggleRail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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
  // Phone: top bar. 768px and up: 220px sidebar or 64px icon rail (see the rail: variant and .sb in globals.css).
  return (
    <nav aria-label="Main" className="sb flex w-full flex-col gap-6 overflow-hidden bg-navy px-4 py-5 text-[#E6EAF2] md:sticky md:top-0 md:h-screen md:shrink-0 md:gap-5 md:py-6">
      <div className="flex items-center justify-between gap-2 rail:flex-col rail:justify-center">
        <Link href="/queue" className="px-2 rail:flex rail:justify-center rail:px-0" title="InvoiceGuard" aria-label="InvoiceGuard">
          <span className="rail:hidden"><Logo /></span>
          <span className="hidden rail:block"><Shield /></span>
        </Link>
        <button type="button" onClick={toggleRail} aria-label="Collapse sidebar" aria-keyshortcuts="[" title="Collapse sidebar ([)" className={`hidden md:inline-flex rail:hidden ${TOGGLE_BTN}`}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M16 10l-2 2 2 2" /></svg>
        </button>
        <button type="button" onClick={toggleRail} aria-label="Expand sidebar" aria-keyshortcuts="[" title="Expand sidebar ([)" className={`hidden rail:inline-flex ${TOGGLE_BTN}`}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M13 10l2 2-2 2" /></svg>
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + '/');
          return (
            <li key={it.href}>
              <Link href={it.href} title={it.label} aria-label={it.badge ? `${it.label}, ${it.badge} pending` : it.label} aria-current={active ? 'page' : undefined} className={`relative flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[15px] rail:justify-center rail:px-0 ${active ? 'bg-navy-600 font-semibold text-white' : 'text-[#C9D2E3] hover:bg-navy-700 hover:text-white'}`}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[it.icon]}</svg>
                <span className="rail:sr-only">{it.label}</span>
                {!!it.badge && <span aria-hidden="true" className="ml-auto rounded-full bg-high-fg px-2 py-0.5 text-xs font-semibold text-white rail:absolute rail:right-0.5 rail:top-0.5 rail:ml-0 rail:px-1.5 rail:py-0 rail:text-[10px] rail:leading-4">{it.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* compact credit meter for the icon rail; hover for the full numbers */}
      <div title={usageTip} className="mt-auto hidden flex-col items-center gap-2 rounded-lg bg-navy-700 px-1 py-2 text-center rail:flex">
        <span className="sr-only">{usageTip}</span>
        <div aria-hidden="true" className="flex flex-col items-center gap-0.5 leading-tight"><span className="text-[10px] text-[#A9B3C6]">Scans</span><span className="text-[11px] tnum">{usage.scansToday}/{l.scansDay}</span></div>
        <div aria-hidden="true" className="flex flex-col items-center gap-0.5 leading-tight"><span className="text-[10px] text-[#A9B3C6]">AI</span><span className="text-[11px] tnum">{usage.aiToday}/{l.aiDay}</span></div>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 rounded-xl bg-navy-700 p-4 rail:hidden">
        <div className="text-xs font-semibold text-[#A9B3C6]">Today</div>
        <Meter label="Scans" used={usage.scansToday} max={l.scansDay} />
        <Meter label="AI calls" used={usage.aiToday} max={l.aiDay} />
        <div className="text-xs text-[#A9B3C6]">Resets at midnight IST</div>
        <div className="h-px bg-navy-500" />
        <div className="text-xs font-semibold text-[#A9B3C6]">This month</div>
        <div className="flex justify-between gap-3 text-[13px]"><span>Scans</span><span className="text-right tnum">{usage.isDemo ? 'No limit' : `${usage.scansMonth} / ${l.scansMonth}`}</span></div>
        <div className="flex justify-between gap-3 text-[13px]"><span>AI calls</span><span className="text-right tnum">{usage.isDemo ? 'No limit' : `${usage.aiMonth} / ${l.aiMonth}`}</span></div>
        <div className="text-xs text-[#A9B3C6]">Rule checks never use credits</div>
      </div>
      <div className="truncate px-2 text-xs text-[#A9B3C6] rail:hidden" title={email}>{email}</div>
    </nav>
  );
}

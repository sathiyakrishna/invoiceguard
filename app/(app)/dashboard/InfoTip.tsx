'use client';
import { useEffect, useId, useRef, useState } from 'react';

// Info icon with a tooltip: hover or focus on desktop, tap on touch, Escape or a tap elsewhere closes it.
export default function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // opened by click or tap, so hover-out does not close it
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setPinned(false); } };
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) { setOpen(false); setPinned(false); } };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => { const next = !(open && pinned); setOpen(next); setPinned(next); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (!pinned) setOpen(false); }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#C9D2E3] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" /></svg>
      </button>
      {open && (
        <span role="tooltip" id={id} className="absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-lg bg-white px-3.5 py-2.5 text-[13px] font-normal leading-snug text-ink shadow-[0_8px_24px_rgba(11,31,77,0.25)]">
          {children}
        </span>
      )}
    </span>
  );
}

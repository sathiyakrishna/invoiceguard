type Band = 'High' | 'Medium' | 'Low';

const STYLE: Record<Band, string> = {
  High: 'bg-high-bg text-high-fg',
  Medium: 'bg-med-bg text-med-fg',
  Low: 'bg-low-bg text-low-fg'
};

export function RiskIcon({ band, size = 14 }: { band: Band; size?: number }) {
  const common = { 'aria-hidden': true, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (band === 'High') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5h.01" /></svg>;
  if (band === 'Medium') return <svg {...common}><path d="M12 3L2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>;
}

export function RiskBadge({ band, score, large }: { band: Band; score?: number; large?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${STYLE[band]} ${large ? 'px-3 py-1 text-[13px]' : 'px-2.5 py-0.5 text-xs'}`}>
      <RiskIcon band={band} size={large ? 15 : 13} />
      {band}
      {score !== undefined && <span className="tnum font-mono">· {score}</span>}
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'border-line-input bg-white text-ink-700' },
  yes: { label: 'Yes · duplicate', cls: 'border-accent-soft bg-accent-soft text-accent-text' },
  no: { label: 'No · not duplicate', cls: 'border-line-soft bg-line-soft text-ink-700' },
  ignore: { label: 'Ignored', cls: 'border-line-input bg-ground text-ink-500' }
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending;
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

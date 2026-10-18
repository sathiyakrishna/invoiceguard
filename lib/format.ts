const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

// credit lines are negative: show -₹1,000.00 rather than ₹-1,000.00
export const rupees = (n: number | string | null | undefined) => { const v = Number(n ?? 0); return (v < 0 ? '-₹' : '₹') + inr.format(Math.abs(v)); };
export const rupees0 = (n: number | string | null | undefined) => { const v = Math.round(Number(n ?? 0)); return (v < 0 ? '-₹' : '₹') + inr0.format(Math.abs(v)); };
export const count = (n: number) => inr0.format(n);

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`; // DD/MM/YYYY
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }); // DD/MM/YYYY
}

export function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  return days === 1 ? '1 day' : `${days} days`;
}

export function duration(sec: number | null | undefined): string {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Escape a CSV cell, neutralising spreadsheet formulas (=, +, -, @). */
export function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

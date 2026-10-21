import type { SupabaseClient } from '@supabase/supabase-js';
import { listFlags, onlySampleData, type Flag } from '@/lib/flags';

export const RANGES = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', 'This year'], ['all', 'All time']] as const;
export const CLASSES = [
  { key: 'pending', label: 'Pending', color: '#CBD2DC' }, // light grey (line-input)
  { key: 'yes', label: 'Yes · duplicate', color: '#1D4ED8' }, // brand blue (accent)
  { key: 'no', label: 'No · not duplicate', color: '#4F9D7D' }, // muted green, a softer step of low-fg
  { key: 'ignore', label: 'Ignored', color: '#334155' } // dark grey
] as const;
export const MIN_REVIEWS = 5; // a rate from fewer reviewed pairs is noise

export type ScanRow = { id: string; file_name: string; row_count: number; created_at: string };

export const parseRange = (r: string | null | undefined) => (RANGES.some(([k]) => k === r) ? r! : '30');

export function rangeSince(range: string, now = Date.now()): string | null {
  return range === 'all' ? null : new Date(now - Number(range) * 86_400_000).toISOString();
}

/** The scans and flags the dashboard shows for a period, read with the caller's own (RLS-bound) client. */
export async function loadDashboardData(supabase: SupabaseClient, range: string) {
  const since = rangeSince(range);
  let scansQ = supabase.from('scans').select('id, file_name, row_count, created_at');
  if (since) scansQ = scansQ.gte('created_at', since);
  const [allFlags, { data: scans }] = await Promise.all([listFlags(supabase), scansQ]);
  const flags = since ? allFlags.filter((f) => f.created_at >= since) : allFlags;
  return { flags, scans: (scans ?? []) as ScanRow[] };
}

/** Every figure on the dashboard, from the period's flags and scans. */
export function computeSummary(flags: Flag[], scans: ScanRow[], range: string) {
  const scanned = scans.reduce((s, x) => s + x.row_count, 0);
  const by = (k: string) => flags.filter((f) => f.status === k);
  const yes = by('yes');
  const no = by('no');
  const pending = by('pending');
  const sum = (list: Flag[]) => list.reduce((s, f) => s + Number(f.amount), 0);
  const prevented = sum(yes);
  const sampleOnly = onlySampleData(yes, new Map(scans.map((s) => [s.id, s.file_name])));
  const fpRate = yes.length + no.length >= MIN_REVIEWS ? Math.round((no.length / (yes.length + no.length)) * 100) : null;
  const timed = flags.filter((f) => f.review_seconds !== null && f.status !== 'pending');
  const avgReview = timed.length ? timed.reduce((s, f) => s + (f.review_seconds ?? 0), 0) / timed.length : null;

  const risk = (['High', 'Medium', 'Low'] as const).map((band) => {
    const list = pending.filter((f) => f.risk_band === band);
    return { band, n: list.length, amt: sum(list) };
  });
  const classes = CLASSES.map((c) => {
    const list = by(c.key);
    return { ...c, n: list.length, amt: sum(list) };
  });
  const total = classes.reduce((s, c) => s + c.amt, 0);
  const types = Object.entries(yes.reduce<Record<string, number>>((m, f) => ({ ...m, [f.dup_type]: (m[f.dup_type] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const decided = flags.filter((f) => f.decided_at).sort((a, b) => (b.decided_at ?? '').localeCompare(a.decided_at ?? ''));
  const reviewed = decided.filter((f) => f.status !== 'pending');
  const rangeLabel = RANGES.find(([k]) => k === range)![1];

  return { range, rangeLabel, scanned, scanCount: scans.length, yes, no, pending, prevented, sampleOnly, fpRate, avgReview, risk, classes, total, types, decided, reviewed };
}

export type DashboardSummary = ReturnType<typeof computeSummary>;

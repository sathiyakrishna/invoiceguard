import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { istToday } from '@/lib/limits';

/**
 * One-way, keyed hash of an email. The key is derived from the service-role key, so a leaked table cannot be
 * reversed by hashing guessed addresses, and there is no extra secret to configure.
 */
export function emailHash(email: string): string {
  const key = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').update('invoiceguard-usage-retention-v1').digest();
  return createHmac('sha256', key).update(email.trim().toLowerCase()).digest('hex');
}

const monthStart = () => istToday().slice(0, 8) + '01';

type Counts = { day: string; scans: number; ai_calls: number };

/** Copy this month's usage rows to usage_retained, replacing any earlier copy. Returns how many days were kept. */
export async function retainUsage(admin: SupabaseClient, userId: string, email: string): Promise<number> {
  const { data, error } = await admin.from('usage').select('day, scans, ai_calls').eq('user_id', userId).gte('day', monthStart());
  if (error) throw error;
  const rows = ((data ?? []) as Counts[]).map((r) => ({ email_hash: emailHash(email), day: r.day, scans: r.scans, ai_calls: r.ai_calls }));
  if (rows.length === 0) return 0;
  const { error: upErr } = await admin.from('usage_retained').upsert(rows, { onConflict: 'email_hash,day' });
  if (upErr) throw upErr;
  return rows.length;
}

/** On sign-in: add any retained counts for this email to the account's own usage, then delete them so they apply once. */
export async function restoreUsage(admin: SupabaseClient, userId: string, email: string): Promise<number> {
  const hash = emailHash(email);
  const { data, error } = await admin.from('usage_retained').select('day, scans, ai_calls').eq('email_hash', hash).gte('day', monthStart());
  if (error) throw error;
  const kept = (data ?? []) as Counts[];
  if (kept.length === 0) return 0;
  const { data: existing } = await admin.from('usage').select('day, scans, ai_calls').eq('user_id', userId).gte('day', monthStart());
  const have = new Map(((existing ?? []) as Counts[]).map((r) => [r.day, r]));
  const rows = kept.map((r) => ({ user_id: userId, day: r.day, scans: r.scans + (have.get(r.day)?.scans ?? 0), ai_calls: r.ai_calls + (have.get(r.day)?.ai_calls ?? 0) }));
  const { error: upErr } = await admin.from('usage').upsert(rows, { onConflict: 'user_id,day' });
  if (upErr) throw upErr;
  const { error: delErr } = await admin.from('usage_retained').delete().eq('email_hash', hash);
  if (delErr) throw delErr;
  return rows.length;
}

/** Drop retained rows from before the current IST month (their counts no longer affect any limit). */
export async function purgeExpiredRetained(admin: SupabaseClient): Promise<number> {
  const { error, count } = await admin.from('usage_retained').delete({ count: 'exact' }).lt('day', monthStart());
  if (error) throw error;
  return count ?? 0;
}

import 'server-only';
import { createAdminClient } from './supabase/admin';

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export type Limits = { scansDay: number; scansMonth: number; aiDay: number; aiMonth: number; aiGlobal: number };

export function limitsFor(isDemo: boolean): Limits {
  return {
    scansDay: isDemo ? num(process.env.DEMO_LIMIT_SCANS_DAY, 10) : num(process.env.LIMIT_SCANS_DAY, 3),
    scansMonth: isDemo ? 1000 : num(process.env.LIMIT_SCANS_MONTH, 10),
    aiDay: isDemo ? num(process.env.DEMO_LIMIT_AI_DAY, 300) : num(process.env.LIMIT_AI_DAY, 50),
    aiMonth: isDemo ? 100000 : num(process.env.LIMIT_AI_MONTH, 200),
    aiGlobal: num(process.env.LIMIT_AI_GLOBAL_DAY, 1500)
  };
}

export async function isDemoUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('is_demo').eq('id', userId).maybeSingle();
  return !!data?.is_demo;
}

export type QuotaResult = { ok: true } | { ok: false; reason: 'daily' | 'monthly' | 'global' | 'error' };

export async function consume(userId: string, kind: 'scan' | 'ai', n = 1): Promise<QuotaResult> {
  const l = limitsFor(await isDemoUser(userId));
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('consume_quota', {
    p_user: userId,
    p_kind: kind,
    p_n: n,
    p_day_limit: kind === 'scan' ? l.scansDay : l.aiDay,
    p_month_limit: kind === 'scan' ? l.scansMonth : l.aiMonth,
    p_global_limit: l.aiGlobal
  });
  if (error || !data) return { ok: false, reason: 'error' };
  return data as QuotaResult;
}

export function istToday(): string {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

export type UsageSummary = { scansToday: number; aiToday: number; scansMonth: number; aiMonth: number; limits: Limits; isDemo: boolean };

export async function usageSummary(userId: string): Promise<UsageSummary> {
  const admin = createAdminClient();
  const today = istToday();
  const monthStart = today.slice(0, 8) + '01';
  const [{ data }, demo] = await Promise.all([
    admin.from('usage').select('day, scans, ai_calls').eq('user_id', userId).gte('day', monthStart),
    isDemoUser(userId)
  ]);
  const rows = data ?? [];
  const t = rows.find((r) => r.day === today);
  return {
    scansToday: t?.scans ?? 0,
    aiToday: t?.ai_calls ?? 0,
    scansMonth: rows.reduce((s, r) => s + r.scans, 0),
    aiMonth: rows.reduce((s, r) => s + r.ai_calls, 0),
    limits: limitsFor(demo),
    isDemo: demo
  };
}

export const QUOTA_MESSAGES: Record<string, string> = {
  daily: 'You have reached today’s limit. It resets at midnight IST.',
  monthly: 'You have reached this month’s limit. It resets on the 1st.',
  global: 'AI explanations are paused for everyone until midnight IST because today’s shared limit was reached. Rule checks still work.',
  error: 'Usage could not be checked. Try again in a moment.'
};

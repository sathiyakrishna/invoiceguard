import 'server-only';
import { createAdminClient } from './supabase/admin';

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export type Limits = { scansDay: number; scansMonth: number; aiDay: number; aiMonth: number; aiGlobal: number };

/** Demo accounts have high limits, test accounts have their own capped limits, everyone else the standard ones. */
export function limitsFor(isDemo: boolean, isTester = false): Limits {
  if (isTester && !isDemo) {
    return {
      scansDay: num(process.env.TESTER_LIMIT_SCANS_DAY, 10),
      scansMonth: num(process.env.TESTER_LIMIT_SCANS_MONTH, 30),
      aiDay: num(process.env.TESTER_LIMIT_AI_DAY, 100),
      aiMonth: num(process.env.TESTER_LIMIT_AI_MONTH, 300),
      aiGlobal: num(process.env.LIMIT_AI_GLOBAL_DAY, 1500)
    };
  }
  return {
    scansDay: isDemo ? num(process.env.DEMO_LIMIT_SCANS_DAY, 10) : num(process.env.LIMIT_SCANS_DAY, 3),
    scansMonth: isDemo ? 1000 : num(process.env.LIMIT_SCANS_MONTH, 10),
    aiDay: isDemo ? num(process.env.DEMO_LIMIT_AI_DAY, 300) : num(process.env.LIMIT_AI_DAY, 50),
    aiMonth: isDemo ? 100000 : num(process.env.LIMIT_AI_MONTH, 200),
    aiGlobal: num(process.env.LIMIT_AI_GLOBAL_DAY, 1500)
  };
}

export type ProfileFlags = { isDemo: boolean; isTester: boolean };

/** Reads the account type and throws if the read fails. A missing profile row is a regular account. Use where a wrong answer would be unsafe (delete). */
export async function profileFlags(userId: string): Promise<ProfileFlags> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('profiles').select('is_demo, is_tester').eq('id', userId).maybeSingle();
  if (error) throw new Error(`Could not read the account type: ${error.message}`);
  return { isDemo: !!data?.is_demo, isTester: !!data?.is_tester };
}

/** For limits: if the account type cannot be read, log it and apply the regular limits, never an elevated set. */
async function profileFlagsForLimits(userId: string): Promise<ProfileFlags> {
  try {
    return await profileFlags(userId);
  } catch (e) {
    console.error('profile lookup failed, applying regular limits:', e instanceof Error ? e.message : e);
    return { isDemo: false, isTester: false };
  }
}

export async function isDemoUser(userId: string): Promise<boolean> {
  return (await profileFlagsForLimits(userId)).isDemo;
}

export type QuotaResult = { ok: true } | { ok: false; reason: 'daily' | 'monthly' | 'global' | 'error' };

export async function consume(userId: string, kind: 'scan' | 'ai', n = 1): Promise<QuotaResult> {
  const flags = await profileFlagsForLimits(userId);
  const l = limitsFor(flags.isDemo, flags.isTester);
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

export type UsageSummary = { scansToday: number; aiToday: number; scansMonth: number; aiMonth: number; limits: Limits; isDemo: boolean; isTester: boolean };

export async function usageSummary(userId: string): Promise<UsageSummary> {
  const admin = createAdminClient();
  const today = istToday();
  const monthStart = today.slice(0, 8) + '01';
  const [{ data }, flags] = await Promise.all([
    admin.from('usage').select('day, scans, ai_calls').eq('user_id', userId).gte('day', monthStart),
    profileFlagsForLimits(userId)
  ]);
  const rows = data ?? [];
  const t = rows.find((r) => r.day === today);
  return {
    scansToday: t?.scans ?? 0,
    aiToday: t?.ai_calls ?? 0,
    scansMonth: rows.reduce((s, r) => s + r.scans, 0),
    aiMonth: rows.reduce((s, r) => s + r.ai_calls, 0),
    limits: limitsFor(flags.isDemo, flags.isTester),
    isDemo: flags.isDemo,
    isTester: flags.isTester
  };
}

export const QUOTA_MESSAGES: Record<string, string> = {
  daily: 'You have reached today’s limit. It resets at midnight IST.',
  monthly: 'You have reached this month’s limit. It resets on the 1st.',
  global: 'AI explanations are paused for everyone until midnight IST because today’s shared limit was reached. Rule checks still work.',
  error: 'Usage could not be checked. Try again in a moment.'
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

// ---- fake service-role client: one profile row, one usage table, and a log of consume_quota calls ----
let profile: Record<string, unknown> | null = null;
let profileError: { message: string } | null = null;
let usageRows: Array<Record<string, unknown>> = [];
const rpcCalls: Array<Record<string, unknown>> = [];

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        gte: () => q,
        maybeSingle: async () => ({ data: table === 'profiles' && !profileError ? profile : null, error: table === 'profiles' ? profileError : null }),
        then: (res: (v: unknown) => void) => res({ data: table === 'usage' ? usageRows : [] })
      };
      return q;
    },
    rpc: async (_fn: string, args: Record<string, unknown>) => (rpcCalls.push(args), { data: { ok: true }, error: null })
  })
}));

import { consume, limitsFor, profileFlags, usageSummary } from '@/lib/limits';
import { generatePassword, PASSWORD_ALPHABET } from '../scripts/tester-password.mjs';

const ENV_KEYS = ['LIMIT_SCANS_DAY', 'LIMIT_SCANS_MONTH', 'LIMIT_AI_DAY', 'LIMIT_AI_MONTH', 'DEMO_LIMIT_SCANS_DAY', 'DEMO_LIMIT_AI_DAY', 'TESTER_LIMIT_SCANS_DAY', 'TESTER_LIMIT_SCANS_MONTH', 'TESTER_LIMIT_AI_DAY', 'TESTER_LIMIT_AI_MONTH', 'LIMIT_AI_GLOBAL_DAY'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  rpcCalls.length = 0;
  usageRows = [];
  profile = { is_demo: false, is_tester: false };
  profileError = null;
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

describe('test account limits', () => {
  it('has its own capped defaults, between the regular and demo limits', () => {
    expect(limitsFor(false, true)).toEqual({ scansDay: 10, scansMonth: 30, aiDay: 100, aiMonth: 300, aiGlobal: 1500 });
    expect(limitsFor(false, false)).toMatchObject({ scansDay: 3, scansMonth: 10, aiDay: 50, aiMonth: 200 });
    expect(limitsFor(true, false)).toMatchObject({ scansDay: 10, scansMonth: 1000, aiDay: 300, aiMonth: 100000 });
  });

  it('is configurable through TESTER_LIMIT_* and still uses the global daily AI cap', () => {
    process.env.TESTER_LIMIT_SCANS_DAY = '4';
    process.env.TESTER_LIMIT_AI_MONTH = '77';
    process.env.LIMIT_AI_GLOBAL_DAY = '999';
    expect(limitsFor(false, true)).toMatchObject({ scansDay: 4, scansMonth: 30, aiDay: 100, aiMonth: 77, aiGlobal: 999 });
  });

  it('never lifts the limits, even if a profile carries both flags (demo wins)', () => {
    expect(limitsFor(true, true).scansMonth).toBe(1000);
    expect(limitsFor(false, true).scansMonth).toBe(30);
  });

  it('sends the tester limits and the global cap to the quota check, not the demo or regular ones', async () => {
    profile = { is_demo: false, is_tester: true };
    await consume('t1', 'scan');
    await consume('t1', 'ai');
    expect(rpcCalls[0]).toMatchObject({ p_kind: 'scan', p_day_limit: 10, p_month_limit: 30, p_global_limit: 1500 });
    expect(rpcCalls[1]).toMatchObject({ p_kind: 'ai', p_day_limit: 100, p_month_limit: 300, p_global_limit: 1500 });
  });

  it('still applies regular limits to a normal account', async () => {
    await consume('u1', 'scan');
    expect(rpcCalls[0]).toMatchObject({ p_day_limit: 3, p_month_limit: 10 });
  });

  it('reports the tester limits for the sidebar and Settings, flagged as a test account but not as demo', async () => {
    profile = { is_demo: false, is_tester: true };
    const s = await usageSummary('t1');
    expect(s.isTester).toBe(true);
    expect(s.isDemo).toBe(false); // the UI shows "No limit" only when isDemo, so the tester sees "x of y"
    expect(s.limits).toMatchObject({ scansDay: 10, scansMonth: 30, aiDay: 100, aiMonth: 300 });
  });
});

describe('account type lookup fails closed', () => {
  const failing = () => {
    profile = { is_demo: true, is_tester: true }; // would be elevated if the error were ignored
    profileError = { message: 'connection reset' };
  };

  it('profileFlags throws when the profiles read errors, instead of returning a regular account', async () => {
    failing();
    await expect(profileFlags('u1')).rejects.toThrow(/Could not read the account type: connection reset/);
  });

  it('treats a missing profile row as a regular account (no error, no throw)', async () => {
    profile = null;
    await expect(profileFlags('u1')).resolves.toEqual({ isDemo: false, isTester: false });
  });

  it('applies the regular limits and logs the error when consuming quota', async () => {
    failing();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await consume('u1', 'scan');
      await consume('u1', 'ai');
      expect(rpcCalls[0]).toMatchObject({ p_day_limit: 3, p_month_limit: 10 });
      expect(rpcCalls[1]).toMatchObject({ p_day_limit: 50, p_month_limit: 200 });
      expect(log).toHaveBeenCalledTimes(2);
      expect(String(log.mock.calls[0].join(' '))).toMatch(/profile lookup failed.*connection reset/);
    } finally {
      log.mockRestore();
    }
  });

  it('shows the regular limits, and neither demo nor tester, in the usage summary', async () => {
    failing();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const s = await usageSummary('u1');
      expect(s).toMatchObject({ isDemo: false, isTester: false });
      expect(s.limits).toMatchObject({ scansDay: 3, scansMonth: 10, aiDay: 50, aiMonth: 200 });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});

describe('test account password', () => {
  it('is 20 random characters from the readable alphabet, different every time', () => {
    const a = generatePassword();
    expect(a).toHaveLength(20);
    expect([...a].every((c) => PASSWORD_ALPHABET.includes(c))).toBe(true);
    expect(PASSWORD_ALPHABET).toHaveLength(64);
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
  });
});

// ---- the password must exist only in the terminal that ran the script ----
const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const SKIP = new Set(['node_modules', '.next', '.git', 'tests', 'results.json']);
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (SKIP.has(name)) continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx|mjs|cjs|js|json|md|yml|yaml|sql|example)$/.test(name) && name !== 'package-lock.json') out.push(rel);
  }
  return out;
}

describe('no tester password in code or logs', () => {
  const script = read('scripts/create-tester.mjs');
  const code = script.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('the create script generates the password itself, takes none as input, and writes it nowhere', () => {
    expect(code).toMatch(/generatePassword\(\)/);
    expect(code).not.toMatch(/process\.argv|process\.env\.\w*PASSWORD|readline|prompt/i);
    expect(code).not.toMatch(/writeFile|appendFile|createWriteStream|\.env\.local.*write/i);
  });

  it('prints the password exactly once', () => {
    const printing = code.split('\n').filter((l) => /console\.\w+\(/.test(l) && /password/i.test(l));
    expect(printing).toHaveLength(1);
    expect(printing[0]).toMatch(/shown once/);
  });

  it('the reset script never touches passwords', () => {
    const reset = read('scripts/reset-tester.mjs').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(reset).not.toMatch(/password/i);
  });

  it('no file in the repo assigns a literal tester password or a TESTER_PASSWORD variable', () => {
    const files = [...walk('app'), ...walk('lib'), ...walk('scripts'), ...walk('components'), ...walk('docs'), ...walk('supabase'), ...walk('.github'), 'README.md', '.env.example', 'package.json'];
    const hits = files.filter((f) => /TESTER_PASSWORD|tester[\w.-]*password\s*[:=]\s*['"`][^'"`\s]{8,}/i.test(read(f)));
    expect(hits).toEqual([]);
  });

  it('the TESTER_EMAIL setting has no default value in the example env file', () => {
    expect(read('.env.example')).toMatch(/^TESTER_EMAIL=$/m);
  });

  // "refuses without TESTER_EMAIL" is covered in tester-env.test.ts by running the real scripts, because
  // testerEmail() also reads .env.local, which on a developer machine may legitimately contain it.
  it('validates and normalises TESTER_EMAIL', async () => {
    const { testerEmail } = await import('../scripts/_env.mjs');
    const was = process.env.TESTER_EMAIL;
    process.env.TESTER_EMAIL = 'not-an-email';
    expect(() => testerEmail()).toThrow(/not a valid email/);
    process.env.TESTER_EMAIL = ' Me+Tester@Gmail.com ';
    expect(testerEmail()).toBe('me+tester@gmail.com');
    if (was === undefined) delete process.env.TESTER_EMAIL; else process.env.TESTER_EMAIL = was;
  });
});

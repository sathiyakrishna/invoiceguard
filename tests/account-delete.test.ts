import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// ---- a tiny in-memory Supabase: tables of rows, plus a log of auth.admin.deleteUser calls ----
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const deleted: string[] = [];
let deleteError: Error | null = null;
let session: { id: string; email: string | null } | null = null;
let demo = false;
let tester = false;
let profileFails = false;
const signOut = vi.fn(async () => ({ error: null }));

function from(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  const q: any = {
    select: () => q,
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
    gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), q),
    lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), q),
    upsert: (rows: Row[], o: { onConflict: string }) => {
      const keys = o.onConflict.split(',');
      for (const row of rows) {
        const list = (db[table] ??= []);
        const i = list.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) list[i] = { ...list[i], ...row }; else list.push({ ...row });
      }
      return Promise.resolve({ error: null });
    },
    delete: () => {
      q.__del = true;
      return q;
    },
    then: (res: (v: unknown) => void) => {
      const list = (db[table] ??= []);
      const hit = list.filter((r) => filters.every((f) => f(r)));
      if (q.__del) db[table] = list.filter((r) => !hit.includes(r));
      res({ data: hit, count: hit.length, error: null });
    }
  };
  return q;
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from,
    auth: { admin: { deleteUser: async (id: string) => (deleted.push(id), { error: deleteError }) } }
  })
}));
vi.mock('@/lib/supabase/server', () => ({
  requireUser: async () => ({ supabase: { auth: { signOut } }, user: session })
}));
vi.mock('@/lib/limits', () => ({ profileFlags: async () => { if (profileFails) throw new Error('Could not read the account type: boom'); return { isDemo: demo, isTester: tester }; }, istToday: () => '2026-04-20' }));

import { POST } from '@/app/api/account/delete/route';
import { emailHash, restoreUsage, retainUsage, purgeExpiredRetained } from '@/lib/usage-retention';

const call = (body: unknown, origin: string | null = 'http://localhost:3000') =>
  POST(new Request('http://localhost:3000/api/account/delete', { method: 'POST', headers: origin ? { origin, 'content-type': 'application/json' } : { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  deleted.length = 0;
  deleteError = null;
  demo = false;
  tester = false;
  profileFails = false;
  session = { id: 'user-1', email: 'Alice@Example.com' };
  signOut.mockClear();
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  db.usage = [
    { user_id: 'user-1', day: '2026-04-20', scans: 2, ai_calls: 7 },
    { user_id: 'user-1', day: '2026-04-03', scans: 1, ai_calls: 4 },
    { user_id: 'user-1', day: '2026-03-30', scans: 9, ai_calls: 9 } // last month: no longer counts
  ];
});

describe('POST /api/account/delete', () => {
  it('returns 401 when signed out and deletes nothing', async () => {
    session = null;
    const res = await call({ confirm: 'DELETE' });
    expect(res.status).toBe(401);
    expect(deleted).toEqual([]);
  });

  it('deletes only the session user, ignoring any user id in the request', async () => {
    const res = await call({ confirm: 'DELETE', userId: 'victim', user_id: 'victim', id: 'victim' });
    expect(res.status).toBe(200);
    expect(deleted).toEqual(['user-1']);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('requires the typed confirmation', async () => {
    for (const body of [{}, { confirm: 'delete' }, { confirm: '' }, null]) {
      expect((await call(body)).status).toBe(400);
    }
    expect(deleted).toEqual([]);
  });

  it('rejects cross-origin and origin-less requests', async () => {
    expect((await call({ confirm: 'DELETE' }, 'https://evil.example')).status).toBe(403);
    expect((await call({ confirm: 'DELETE' }, null)).status).toBe(403);
    expect(deleted).toEqual([]);
  });

  it('refuses demo accounts with a clear message', async () => {
    demo = true;
    const res = await call({ confirm: 'DELETE' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Demo and test accounts/);
    expect(deleted).toEqual([]);
  });

  it('refuses test accounts too, and keeps no usage for them', async () => {
    tester = true;
    const res = await call({ confirm: 'DELETE' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Demo and test accounts/);
    expect(deleted).toEqual([]);
    expect(db.usage_retained ?? []).toEqual([]);
  });

  it('fails closed when the account type cannot be read: 500, nothing deleted, nothing retained, still signed in', async () => {
    profileFails = true;
    demo = true; // a demo account must not be deleted just because its flag could not be read
    const res = await call({ confirm: 'DELETE' });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/couldn’t verify your account type, so nothing was deleted/);
    expect(deleted).toEqual([]);
    expect(db.usage_retained ?? []).toEqual([]);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('returns 500 and keeps the user signed in when deletion fails', async () => {
    deleteError = new Error('boom');
    const res = await call({ confirm: 'DELETE' });
    expect(res.status).toBe(500);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('fails if user data is still present after deletion', async () => {
    db.scans = [{ id: 's1', user_id: 'user-1' }];
    expect((await call({ confirm: 'DELETE' })).status).toBe(500);
  });

  it('keeps this month’s usage under the email hash, not the email', async () => {
    await call({ confirm: 'DELETE' });
    const kept = db.usage_retained;
    expect(kept.map((r) => r.day).sort()).toEqual(['2026-04-03', '2026-04-20']);
    expect(kept.every((r) => r.email_hash === emailHash('alice@example.com'))).toBe(true);
    expect(JSON.stringify(kept)).not.toMatch(/alice/i);
  });
});

describe('usage retention', () => {
  it('hashes case- and whitespace-insensitively, with a keyed, non-guessable value', () => {
    expect(emailHash(' Alice@Example.com ')).toBe(emailHash('alice@example.com'));
    expect(emailHash('alice@example.com')).not.toBe(emailHash('bob@example.com'));
    expect(emailHash('alice@example.com')).toMatch(/^[0-9a-f]{64}$/);
    const before = emailHash('alice@example.com');
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'another-key';
    expect(emailHash('alice@example.com')).not.toBe(before); // depends on the server secret
  });

  it('restores the counts to a new account once, adding to anything it already has', async () => {
    await retainUsage((await import('@/lib/supabase/admin')).createAdminClient() as never, 'user-1', 'alice@example.com');
    db.usage = [{ user_id: 'user-2', day: '2026-04-20', scans: 1, ai_calls: 1 }];
    const admin = (await import('@/lib/supabase/admin')).createAdminClient() as never;
    expect(await restoreUsage(admin, 'user-2', 'ALICE@example.com')).toBe(2);
    const mine = db.usage.filter((r) => r.user_id === 'user-2');
    expect(mine.find((r) => r.day === '2026-04-20')).toMatchObject({ scans: 3, ai_calls: 8 });
    expect(mine.find((r) => r.day === '2026-04-03')).toMatchObject({ scans: 1, ai_calls: 4 });
    expect(db.usage_retained).toEqual([]);
    expect(await restoreUsage(admin, 'user-2', 'alice@example.com')).toBe(0); // applies only once
  });

  it('does not restore another email’s counts', async () => {
    const admin = (await import('@/lib/supabase/admin')).createAdminClient() as never;
    await retainUsage(admin, 'user-1', 'alice@example.com');
    expect(await restoreUsage(admin, 'user-3', 'bob@example.com')).toBe(0);
  });

  it('purges retained rows from before the current month', async () => {
    db.usage_retained = [{ email_hash: 'h', day: '2026-03-31', scans: 1, ai_calls: 1 }, { email_hash: 'h', day: '2026-04-02', scans: 1, ai_calls: 1 }];
    const admin = (await import('@/lib/supabase/admin')).createAdminClient() as never;
    expect(await purgeExpiredRetained(admin)).toBe(1);
    expect(db.usage_retained.map((r) => r.day)).toEqual(['2026-04-02']);
  });
});

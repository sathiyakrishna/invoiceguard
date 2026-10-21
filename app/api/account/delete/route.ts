import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDemoUser } from '@/lib/limits';
import { retainUsage } from '@/lib/usage-retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Deletes the signed-in user's account. The user comes only from the session cookie, never from the request.
 * Every user-owned table references auth.users with ON DELETE CASCADE (001_init.sql), so deleting the auth user removes the rest.
 */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return fail('Sign in again to continue.', 401);

  // a destructive cookie-authenticated POST: require a same-origin request and the typed confirmation
  if (req.headers.get('origin') !== new URL(req.url).origin) return fail('This request was blocked. Reload the page and try again.', 403);
  const body = await req.json().catch(() => null);
  if (body?.confirm !== 'DELETE') return fail('Type DELETE to confirm.', 400);

  try {
    if (await isDemoUser(user.id)) return fail('Demo accounts can’t be deleted here. Contact the account owner instead.', 403);

    const admin = createAdminClient();
    // keep this month's usage counts first, so a failure later can never lose them
    if (user.email) await retainUsage(admin, user.id, user.email);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    // nothing may be left behind
    const [{ count: scans }, { count: profiles }] = await Promise.all([
      admin.from('scans').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', user.id)
    ]);
    if (scans || profiles) throw new Error('data remained after deletion');
  } catch {
    return fail('We couldn’t finish deleting your account. Please try again, or email support if it keeps failing.', 500);
  }

  // clear the session cookies; the token already points at a deleted user, so a failure here still leaves them signed out
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

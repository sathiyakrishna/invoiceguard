import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { purgeExpiredRetained } from '@/lib/usage-retention';

// Runs daily (vercel.json). Deletes scans older than 30 days (invoices and flags cascade) and retained usage counts from before this month.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { error, count } = await admin.from('scans').delete({ count: 'exact' }).lt('created_at', cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const retainedPurged = await purgeExpiredRetained(admin).catch(() => 0);
  return NextResponse.json({ deleted: count ?? 0, retainedPurged });
}

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Runs daily (vercel.json). Deletes scans older than 30 days; invoices and flags cascade.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { error, count } = await admin.from('scans').delete({ count: 'exact' }).lt('created_at', cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}

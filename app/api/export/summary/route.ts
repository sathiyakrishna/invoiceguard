import { requireUser } from '@/lib/supabase/server';
import { computeSummary, loadDashboardData, parseRange } from '@/lib/dashboard-summary';
import { buildSummaryWorkbook, summaryFileName } from '@/lib/summary-xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return new Response('Sign in again to continue.', { status: 401 });
  try {
    const range = parseRange(new URL(req.url).searchParams.get('range'));
    const { flags, scans } = await loadDashboardData(supabase, range);
    const now = new Date();
    const wb = buildSummaryWorkbook(computeSummary(flags, scans, range), { email: user.email ?? '', generatedAt: now });
    const body = await wb.xlsx.writeBuffer();
    return new Response(body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${summaryFileName(range, now)}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return new Response('Could not build the summary file. Please try again.', { status: 500 });
  }
}

import { requireUser } from '@/lib/supabase/server';
import { listFlags } from '@/lib/flags';
import { csvCell } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return new Response('Sign in again to continue.', { status: 401 });
  const flags = await listFlags(supabase, { status: 'yes' });
  const head = ['pair_id', 'risk', 'score', 'duplicate_type', 'vendor_id', 'vendor_name', 'company_code', 'block_invoice_no', 'block_doc_no', 'block_invoice_date', 'amount', 'original_invoice_no', 'original_doc_no', 'recovery_status', 'comment', 'decided_at'];
  const lines = flags.map((f) => [f.pair_code, f.risk_band, f.score, f.dup_type, f.b.vendor_id, f.b.vendor_name, f.b.company_code, f.b.invoice_ref, f.b.doc_number, f.b.invoice_date, f.b.amount, f.a.invoice_ref, f.a.doc_number, f.recovery_status, f.note, f.decided_at].map(csvCell).join(','));
  const body = '\uFEFF' + [head.join(','), ...lines].join('\r\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="invoiceguard_blocked_${new Date().toISOString().slice(0, 10)}.csv"` }
  });
}

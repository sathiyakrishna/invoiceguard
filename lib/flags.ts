import type { SupabaseClient } from '@supabase/supabase-js';

export type Invoice = {
  id: string;
  company_code: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  invoice_ref: string | null;
  invoice_date: string | null;
  amount: number;
  currency: string | null;
  po_number: string | null;
  doc_number: string | null;
  reversed_with?: string | null;
  is_reversed?: boolean;
  clearing_date?: string | null;
  clearing_document?: string | null;
  scan_id: string;
};

export type Flag = {
  id: string;
  scan_id: string;
  pair_code: string;
  score: number;
  risk_band: 'High' | 'Medium' | 'Low';
  rules_fired: string[];
  dup_type: string;
  amount: number;
  ai_explanation: string | null;
  ai_action: string | null;
  status: 'pending' | 'yes' | 'no' | 'ignore';
  recovery_status: string | null;
  note: string | null;
  review_seconds: number | null;
  decided_at: string | null;
  created_at: string;
  a: Invoice;
  b: Invoice;
};

export const FLAG_SELECT = '*, a:invoices!flags_invoice_a_fkey(*), b:invoices!flags_invoice_b_fkey(*)';

export async function listFlags(supabase: SupabaseClient, opts: { status?: string; type?: string; limit?: number } = {}) {
  let q = supabase.from('flags').select(FLAG_SELECT).order('score', { ascending: false }).order('created_at', { ascending: false }).limit(opts.limit ?? 2000);
  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
  if (opts.type) q = q.eq('dup_type', opts.type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Flag[];
}

/** Risk queue order: highest score first, then the larger amount, then pair ID. The review page's next/previous follows the same order. */
export const compareByRisk = (x: Pick<Flag, 'score' | 'amount' | 'pair_code'>, y: Pick<Flag, 'score' | 'amount' | 'pair_code'>) =>
  y.score - x.score || Number(y.amount) - Number(x.amount) || x.pair_code.localeCompare(y.pair_code);

const SAMPLE_FILES = ['sample_register.csv', 'sample_register.pdf'];

/** True when there is at least one flag and every one comes from a scan of the bundled sample register. A scan we cannot name counts as real data. */
export const onlySampleData = (flags: Array<{ scan_id: string }>, fileByScan: Map<string, string>) =>
  flags.length > 0 && flags.every((f) => SAMPLE_FILES.includes((fileByScan.get(f.scan_id) ?? '').toLowerCase()));

export const DUP_TYPES = ['Exact match', 'Reference format', 'Similar reference', 'Cross company code', 'PO vs non-PO', 'Alternate vendor account', 'Near amount'];

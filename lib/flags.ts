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

export const DUP_TYPES = ['Exact match', 'Reference format', 'Similar reference', 'Cross company code', 'PO vs non-PO', 'Alternate vendor ID', 'Near amount'];

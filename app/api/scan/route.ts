import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { consume, QUOTA_MESSAGES } from '@/lib/limits';
import { detect, findVendorCandidates, normalizeRef, vendorPairKey } from '@/lib/detect';
import { matchVendors } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const Row = z.object({
  company_code: z.string().max(20),
  vendor_id: z.string().min(1).max(40),
  vendor_name: z.string().max(120),
  invoice_ref: z.string().min(1).max(60),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  amount: z.number().positive().max(1e13),
  currency: z.string().max(5),
  po_number: z.string().max(20),
  doc_number: z.string().max(20)
});
const Body = z.object({ fileName: z.string().min(1).max(120), rows: z.array(Row).min(1).max(20000) });

const MAX_FLAGS = 1000;

async function chunked<T>(items: T[], size: number, fn: (part: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'The file data was not valid. Check the column mapping and try again.' }, { status: 400 });
  const { fileName, rows } = parsed.data;

  const quota = await consume(user.id, 'scan', 1);
  if (!quota.ok) return NextResponse.json({ error: QUOTA_MESSAGES[quota.reason] }, { status: 429 });

  // 1. AI vendor matching (cached per user; skipped silently if limits or AI fail)
  const sameSupplier = new Set<string>();
  let aiNote = '';
  try {
    const candidates = findVendorCandidates(rows, 20);
    if (candidates.length) {
      const { data: cached } = await supabase.from('vendor_matches').select('vendor_a, vendor_b, same_supplier');
      const known = new Map((cached ?? []).map((c) => [vendorPairKey(c.vendor_a, c.vendor_b), c.same_supplier]));
      const fresh = candidates.filter((c) => !known.has(vendorPairKey(c.a, c.b)));
      known.forEach((same, key) => same && sameSupplier.add(key));
      if (fresh.length) {
        const q = await consume(user.id, 'ai', 1);
        if (q.ok) {
          const results = await matchVendors(fresh);
          const upserts = results.filter((r) => fresh[r.i]).map((r) => {
            const c = fresh[r.i];
            const [a, b] = c.a < c.b ? [c.a, c.b] : [c.b, c.a];
            if (r.same_supplier) sameSupplier.add(vendorPairKey(a, b));
            return { user_id: user.id, vendor_a: a, vendor_b: b, same_supplier: r.same_supplier, reason: r.reason };
          });
          if (upserts.length) await supabase.from('vendor_matches').upsert(upserts);
        } else aiNote = QUOTA_MESSAGES[q.reason];
      }
    }
  } catch (e) {
    console.error('vendor matching failed', e);
    aiNote = 'Vendor-name matching was skipped this time; rule checks ran as normal.';
  }

  // 2. Pairs the user ignored before
  const { data: ignored } = await supabase.from('flags').select('pair_key').eq('status', 'ignore');
  const ignoredKeys = new Set((ignored ?? []).map((r) => r.pair_key));

  // 3. Detect
  const found = detect(rows, sameSupplier, ignoredKeys).slice(0, MAX_FLAGS);

  // 4. Store scan, invoices, flags
  const { data: scan, error: scanErr } = await supabase.from('scans').insert({ user_id: user.id, file_name: fileName, row_count: rows.length, flag_count: found.length }).select('id').single();
  if (scanErr || !scan) return NextResponse.json({ error: 'The scan could not be saved. Try again.' }, { status: 500 });

  const ids = rows.map(() => randomUUID());
  try {
    await chunked(rows.map((r, i) => ({ ...r, id: ids[i], user_id: user.id, scan_id: scan.id, invoice_ref_norm: normalizeRef(r.invoice_ref) })), 1000, async (part) => {
      const { error } = await supabase.from('invoices').insert(part);
      if (error) throw error;
    });

    const { count } = await supabase.from('flags').select('id', { count: 'exact', head: true });
    let seq = count ?? 0;
    await chunked(found.map((f) => ({
      user_id: user.id,
      scan_id: scan.id,
      pair_code: `DP-${String(++seq).padStart(4, '0')}`,
      pair_key: f.pairKey,
      invoice_a: ids[f.a],
      invoice_b: ids[f.b],
      score: f.score,
      risk_band: f.band,
      rules_fired: f.rules,
      dup_type: f.type,
      amount: Math.max(rows[f.a].amount, rows[f.b].amount)
    })), 500, async (part) => {
      const { error } = await supabase.from('flags').insert(part);
      if (error) throw error;
    });
  } catch (e) {
    console.error('saving scan failed', e);
    await supabase.from('scans').delete().eq('id', scan.id);
    return NextResponse.json({ error: 'The scan could not be saved. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ scanId: scan.id, rows: rows.length, flags: found.length, aiNote });
}

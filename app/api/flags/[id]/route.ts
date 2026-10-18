import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';

const Body = z.object({
  status: z.enum(['yes', 'no', 'ignore']),
  recovery_status: z.enum(['Blocked before payment', 'Credit note requested', 'Recovered', 'Not applicable']).nullable(),
  note: z.string().max(500),
  review_seconds: z.number().int().min(0).max(86400)
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  const { error, data } = await supabase
    .from('flags')
    .update({ ...parsed.data, note: parsed.data.note || null, decided_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Decision not saved.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

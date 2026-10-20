import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { consume, QUOTA_MESSAGES } from '@/lib/limits';
import { explainFlag } from '@/lib/ai';
import { pickInvoice as pick } from '@/lib/ai-prompts';
import { FLAG_SELECT, type Flag } from '@/lib/flags';
import { RULES, suggestedAction, type RuleId } from '@/lib/detect';

export const maxDuration = 30;

type Reply = { status: number; body: Record<string, unknown> };

// Explanations being generated right now, keyed by flag id. A second request for the same flag
// waits for the first and shares its result instead of charging a second AI credit.
// This is per server instance; it covers double-fires (Strict Mode, double clicks), not
// requests that land on different serverless instances at the same moment.
const inflight = new Map<string, Promise<Reply>>();

async function generate(userId: string, f: Flag, supabase: Awaited<ReturnType<typeof requireUser>>['supabase']): Promise<Reply> {
  const q = await consume(userId, 'ai', 1);
  if (!q.ok) return { status: 429, body: { error: QUOTA_MESSAGES[q.reason] } };

  try {
    const action = suggestedAction(f.rules_fired);
    const out = await explainFlag({ action, type: f.dup_type, risk: f.risk_band, score: f.score, rules: f.rules_fired.map((r) => RULES[r as RuleId]?.label ?? r), a: pick(f.a), b: pick(f.b) });
    await supabase.from('flags').update({ ai_explanation: out.explanation, ai_action: action }).eq('id', f.id);
    return { status: 200, body: { explanation: out.explanation, action } };
  } catch (e) {
    console.error('explain failed', e);
    return { status: 502, body: { error: 'The AI explanation is unavailable right now. The rule evidence above still applies.' } };
  }
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });
  const { data } = await supabase.from('flags').select(FLAG_SELECT).eq('id', params.id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Pair not found.' }, { status: 404 });
  const f = data as unknown as Flag;
  if (f.ai_explanation) return NextResponse.json({ explanation: f.ai_explanation, action: f.ai_action });

  let job = inflight.get(f.id);
  if (!job) {
    job = generate(user.id, f, supabase).finally(() => inflight.delete(f.id));
    inflight.set(f.id, job);
  }
  const reply = await job;
  return NextResponse.json(reply.body, { status: reply.status });
}

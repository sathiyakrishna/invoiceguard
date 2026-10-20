import 'server-only';
import { VENDOR_SYSTEM, VendorOut, vendorUser, vendorMaxTokens, EXPLAIN_SYSTEM, ExplainOut, EXPLAIN_MAX_TOKENS, EXPLAIN_TEMPERATURE, type ExplainInput } from './ai-prompts';

export type { ExplainInput } from './ai-prompts';

const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function chatJSON(system: string, user: string, maxTokens: number, temperature = 0.1): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: MODEL(),
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const json = await res.json();
      return JSON.parse(json.choices?.[0]?.message?.content ?? '{}');
    } catch (e) {
      if (attempt === 1) throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('unreachable');
}

// ---------- vendor matching ----------

export async function matchVendors(pairs: Array<{ nameA: string; nameB: string }>) {
  if (!pairs.length) return [];
  const raw = await chatJSON(VENDOR_SYSTEM, vendorUser(pairs), vendorMaxTokens(pairs.length));
  return VendorOut.parse(raw).results;
}

// ---------- flag explanation ----------

export async function explainFlag(input: ExplainInput) {
  const raw = await chatJSON(EXPLAIN_SYSTEM, JSON.stringify(input), EXPLAIN_MAX_TOKENS, EXPLAIN_TEMPERATURE);
  return ExplainOut.parse(raw);
}

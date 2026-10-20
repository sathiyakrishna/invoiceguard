// Calls OpenAI exactly the way lib/ai.ts chatJSON does for matchVendors: same system prompt, JSON mode, temperature 0.1,
// max_tokens from vendorMaxTokens(n), model from OPENAI_MODEL (default gpt-4o-mini).
const { pathToFileURL } = require('node:url');
const path = require('node:path');

let prompts;
async function load() {
  if (!prompts) {
    const { tsImport } = await import('tsx/esm/api');
    prompts = await tsImport('../../lib/ai-prompts.ts', pathToFileURL(__filename).href);
  }
  return prompts;
}

module.exports = class VendorMatchProvider {
  id() {
    return `openai-vendor-match:${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`;
  }

  async callApi(prompt, context) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { error: 'OPENAI_API_KEY is not set (put it in .env.local)' };
    const { VENDOR_SYSTEM, vendorMaxTokens } = await load();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const n = Number(context.vars.n);
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: vendorMaxTokens(n),
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: VENDOR_SYSTEM }, { role: 'user', content: prompt }]
          }),
          signal: ctrl.signal
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}`);
        const json = await res.json();
        return {
          output: json.choices?.[0]?.message?.content ?? '{}',
          tokenUsage: { total: json.usage?.total_tokens, prompt: json.usage?.prompt_tokens, completion: json.usage?.completion_tokens },
          metadata: { model: json.model }
        };
      } catch (e) {
        if (attempt === 1) return { error: String(e) };
      } finally {
        clearTimeout(timer);
      }
    }
    return { error: 'unreachable' };
  }
};

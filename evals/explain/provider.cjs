// Gives Promptfoo the explanation to judge. Flawed cases carry fixed text. Real cases are generated the way lib/ai.ts
// explainFlag does it: EXPLAIN_SYSTEM as the system prompt, JSON.stringify(input) as the user message, JSON mode,
// temperature EXPLAIN_TEMPERATURE, max_tokens EXPLAIN_MAX_TOKENS, model from OPENAI_MODEL (default gpt-4o-mini).
const { pathToFileURL } = require('node:url');

let mod;
async function load() {
  if (!mod) {
    const { tsImport } = await import('tsx/esm/api');
    mod = await tsImport('../../lib/ai-prompts.ts', pathToFileURL(__filename).href);
  }
  return mod;
}

module.exports = class ExplainProvider {
  id() {
    return `openai-explain:${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`;
  }

  async callApi(prompt, context) {
    if (context.vars.fixed) return { output: context.vars.fixed, metadata: { source: 'fixed' } };
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { error: 'OPENAI_API_KEY is not set (put it in .env.local)' };
    const { EXPLAIN_SYSTEM, EXPLAIN_MAX_TOKENS, EXPLAIN_TEMPERATURE, ExplainOut } = await load();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model, temperature: EXPLAIN_TEMPERATURE, max_tokens: EXPLAIN_MAX_TOKENS, response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: EXPLAIN_SYSTEM }, { role: 'user', content: prompt }]
          }),
          signal: ctrl.signal
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}`);
        const json = await res.json();
        const parsed = ExplainOut.parse(JSON.parse(json.choices?.[0]?.message?.content ?? '{}'));
        return {
          output: parsed.explanation,
          tokenUsage: { total: json.usage?.total_tokens, prompt: json.usage?.prompt_tokens, completion: json.usage?.completion_tokens },
          metadata: { source: 'openai', model: json.model }
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

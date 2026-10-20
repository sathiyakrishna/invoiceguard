# InvoiceGuard evals

Synthetic data only. Invented vendors, invoice numbers and amounts.

| Command | What it checks | Needs |
|---|---|---|
| `npm run eval:detection` | Precision and recall of `lib/detect.ts` on labelled scenarios (traps, typos, recurring invoices, reversals, alias vendors). Exits 1 below 95% precision or recall. | nothing |
| `npm run eval:vendors` | The production vendor-matching prompt on 50 labelled name pairs. Reports accuracy, false matches and misses. Exits 1 above 1 false match in 50 pairs. | `OPENAI_API_KEY` (read from `.env.local` if present) |
| `npm run eval:vendors:check` | That every labelled vendor pair is similar enough to reach the AI in production. | nothing |

## How the AI evals stay honest
The prompts, user messages, output schemas and `max_tokens` come from `lib/ai-prompts.ts`, the same module the app imports,
so an eval always tests the prompt that ships. `evals/vendors/provider.cjs` calls OpenAI the way `chatJSON` in `lib/ai.ts` does
(JSON mode, temperature 0.1, model from `OPENAI_MODEL`).

## Labels
- `evals/detection/cases.ts`: each scenario lists the document pairs that must be flagged; everything else must not be.
  Labels are written from the rule table and from what an AP analyst would expect, not copied from the engine's output.
  A scenario with `gap: '...'` is a known limitation: it is reported but does not fail the run. When one starts passing the report says so.
- `evals/vendors/pairs.ts`: 22 same-supplier and 28 different-supplier pairs, shuffled into batches of up to 20 as production sends them.

## Notes
- Vendor results vary a little between runs (the model is called at temperature 0.1). Three runs gave 88%, 94% and 94% accuracy.
- Output goes to `evals/**/results.json` (git-ignored; CI uploads it as an artifact).
- Set `PROMPTFOO_DISABLE_TELEMETRY=1` to stop Promptfoo telemetry. The scripts do not share results anywhere.

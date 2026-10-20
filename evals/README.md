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
- `evals/vendors/pairs.ts`: the gated set is 19 same-supplier and 31 different-supplier pairs (50 in all), shuffled into batches of up to 20 as production sends them.
  `AMBIGUOUS` in the same file is a short report-only list, see below.

## Notes
- Vendor results vary a little between runs (the model is called at temperature 0.1). With the current prompt and labels three runs gave 98%, 96% and 98% accuracy.
- The vendor gate is tight: one false match in 50 pairs is allowed. Today that one is always "Arvind Polymers India Pvt Ltd" vs "Arvind Polymers Ltd", which is labelled different on purpose and is not tuned for.
- Output goes to `evals/**/results.json` (git-ignored; CI uploads it as an artifact).
- Set `PROMPTFOO_DISABLE_TELEMETRY=1` to stop Promptfoo telemetry. The scripts do not share results anywhere.

## Vendor labels (AP judgement)
- Same supplier: spelling and transliteration variants, abbreviations, suffix variants of the same legal form (Ltd/Limited, Pvt/Private), a unit tag such as "(Unit II)".
- Different supplier: companies that only share a word, different legal forms (Ltd vs LLP, Pvt Ltd vs Ltd), and a parent versus its Indian subsidiary. These are separate legal entities with their own bank accounts and payees.
- Ambiguous pairs are kept **out of the gated set**. An analyst could reasonably go either way, so scoring them would only measure a coin flip. They run in a separate report-only batch and the report prints the model's answer next to the reason they are ambiguous. Currently:
  - "Deccan Logistics LLP" vs "Deccan Logistics (India) LLP" (a country tag: one entity, or a separate Indian one?)
  - "K. R. Industries" vs "KR Industries Ltd" (initials differ and a legal form is added)
  - "SRI VENKATESWARA TRADERS" vs "Sri Venkateswara Traders Pvt Ltd" (a legal form is added to a trading name)
- The three clear pairs added to keep the gated set at 50 are Chandra Industries (suffix and case), Kothari Poly-Pack (hyphen) and Jai Hind Bearings (split word).
- The prompt's examples (Laxmi/Lakshmi, Shri/Sri, Venkatesh/Venkatesha, S. K./SK, "Acme Corp" vs "Acme India Pvt Ltd") are deliberately not eval pairs, so the prompt is not taught the test.

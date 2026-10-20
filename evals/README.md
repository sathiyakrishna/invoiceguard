# InvoiceGuard evals

Synthetic data only. Invented vendors, invoice numbers and amounts.

| Command | What it checks | Needs |
|---|---|---|
| `npm run eval:detection` | Precision and recall of `lib/detect.ts` on labelled scenarios (traps, typos, recurring invoices, reversals, alias vendors). Exits 1 below 95% precision or recall. | nothing |
| `npm run eval:vendors` | The production vendor-matching prompt on 50 labelled name pairs. Reports accuracy, false matches and misses. Exits 1 above 1 false match in 50 pairs. | `OPENAI_API_KEY` (read from `.env.local` if present) |
| `npm run eval:explain` | 40 explanations: 30 written by the production prompt on real pairs plus 10 deliberately flawed. Every one is checked in code (amounts, dates, identifiers, "already paid" wording, sentence count, no blocking or paying wording) and judged by TypeSafe Jev on five yes/no questions. Reports pass rate per check and how many flawed ones were rejected. | `OPENAI_API_KEY`, `TYPESAFE_API_KEY` |
| `npm run eval:explain:freeze` | Freezes those 40 explanations into `explanations.json` and writes `labeling-sheet.md` and `human-labels.csv`. Refuses to overwrite without `--force`. | a finished `eval:explain` run |
| `npm run eval:judge` | Judges the frozen explanations with Jev and writes `judgements.json`. No OpenAI calls. | `TYPESAFE_API_KEY` |
| `npm run eval:calibrate` | Compares Jev with your hand labels: agreement per check with confidence intervals, the dangerous direction (Jev passes what you failed), and agreement at confidence thresholds. | `human-labels.csv` filled in, `judgements.json` |
| `npm run eval:vendors:check` | That every labelled vendor pair is similar enough to reach the AI in production. | nothing |

## How the AI evals stay honest
The prompts, user messages, output schemas and `max_tokens` come from `lib/ai-prompts.ts`, the same module the app imports,
so an eval always tests the prompt that ships. `evals/vendors/provider.cjs` calls OpenAI the way `chatJSON` in `lib/ai.ts` does
(JSON mode, temperature 0.1, model from `OPENAI_MODEL`).

## Labels
- `evals/detection/cases.ts`: each scenario lists the document pairs that must be flagged; everything else must not be.
  Labels are written from the rule table and from what an AP analyst would expect, not copied from the engine's output.
  A scenario with `gap: '...'` is a known limitation: it is reported but does not fail the run. When one starts passing the report says so. There are none right now:
  the three gaps the first run found (the currency column was ignored, and placeholder invoice numbers such as `N/A` or `TBD` matched each other) are fixed in `lib/detect.ts` and gated.
- Currency and placeholders: a pair in two different currencies is never flagged (a blank currency counts as unknown). Blank, `-`, `0`, `N/A`, `NA`, `NIL`, `TBD`, `XXXX` and similar are not invoice numbers for matching. Real numbers that merely start with such a word (`NA-1001`) still match.
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

## Jev as the judge
- Jev is TypeSafe's non-generative decision model. It gets the pair data plus the explanation as a state and answers typed yes/no questions (Noul) with a probability, never free text. Call format: `evals/explain/jev.ts` (HTTP, `POST https://api.typesafe.ai/v1/systemone`).
- Pinned to `jev-1.13.0`; override with `JEV_MODEL`. Aliases move when TypeSafe ships a release, so re-run calibration before changing the pin.
- A Noul has only a probability p. The label is p >= 0.5; confidence is |2p - 1|.
- Questions: a (unsupported fact), b1 (High/Medium called uncertain or legitimate), b2 (Low pair claimed with certainty), c (conclusion fits the suggested action), d (claims InvoiceGuard blocks or pays). One condition per question, as TypeSafe recommends. Amounts, dates and identifiers are checked in code, not by Jev.
- `JEV_MOCK=1` runs the whole pipeline with a crude word-matching stand-in so it can be tried without a key. Every report prints a loud banner when the stand-in was used, and the explain run never fails on mock numbers. **No Jev numbers exist yet.** Until `TYPESAFE_API_KEY` is available the Jev part of the pipeline has only been exercised with the stand-in and with unit tests against the documented request and reply shapes.
- Do your hand labels before looking at any judge output, so the calibration is honest.
- `EVAL_MIN_EXPLAIN_PASS` (default 0.85) and `EVAL_MIN_FLAW_CATCH` (default 0.8) are placeholders until calibration shows what Jev can do.

## Known findings (tracked, not fixed)
- **Explanation #27 has three sentences.** The production prompt says "at most two short sentences". For the Low pair "Allied Rubber Products" (AR-3300 vs AR-33000, invoice A already paid) `gpt-4o-mini` writes three, caught by the `at_most_two_sentences` code check. The frozen text is in `explanations.json`. No prompt change yet; this is recorded so a later prompt edit can be measured against it.

# InvoiceGuard evals

Synthetic data only. Invented vendors, invoice numbers and amounts.

| Command | What it checks | Needs |
|---|---|---|
| `npm run eval:detection` | Precision and recall of `lib/detect.ts` on labelled scenarios (traps, typos, recurring invoices, reversals, alias vendors). Exits 1 below 95% precision or recall. | nothing |
| `npm run eval:vendors` | The production vendor-matching prompt on 50 labelled name pairs. Reports accuracy, false matches and misses. Exits 1 above 1 false match in 50 pairs. | `OPENAI_API_KEY` (read from `.env.local` if present) |
| `npm run eval:explain` | 40 explanations: 30 written by the production prompt on real pairs plus 10 deliberately flawed. Every one is checked in code (amounts, dates, identifiers, "already paid" wording, sentence count, no blocking or paying wording) and judged by TypeSafe Jev on five yes/no questions. Reports pass rate per check and how many flawed ones were rejected. This regenerates the 30 real explanations, so results vary from run to run: it is the nightly **monitor**, and `EVAL_EXPLAIN_MONITOR=1` makes it report without failing. | `OPENAI_API_KEY`, `TYPESAFE_API_KEY` |
| `npm run eval:explain:gate` | **The blocking CI gate.** Judges the 40 frozen explanations (`explanations.json`) with the code checks and Jev and applies `EVAL_MIN_EXPLAIN_PASS` and `EVAL_MIN_FLAW_CATCH`. No OpenAI calls, so the text under test never changes. Jev answers with confidence below 0.2 are listed as uncertain and not counted. | `TYPESAFE_API_KEY` |
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
- `JEV_MOCK=1` runs the whole pipeline with a crude word-matching stand-in so it can be tried without a key. Every report prints a loud banner when the stand-in was used, and the explain run never fails on mock numbers. Real Jev numbers are in the calibration section below.
- Do your hand labels before looking at any judge output, so the calibration is honest.
- `EVAL_MIN_EXPLAIN_PASS` (default 0.85) and `EVAL_MIN_FLAW_CATCH` (default 0.9) are set from the calibration below. Both can still be overridden by environment variable.

### How the explanation eval runs in CI
- **Gate (blocking, every push and pull request):** `npm run eval:explain:gate` judges the frozen explanations, so a failure means the judge, the checks or the thresholds changed and not that OpenAI worded something differently. Two local runs back to back gave the same result: real pass 97% (29/30, #27 fails the sentence-count check), flawed rejected 9/10, 5 uncertain Jev answers excluded.
- **Monitor (non-blocking, nightly and by hand):** regenerates the 30 real explanations with OpenAI and reports the pass rate with `EVAL_EXPLAIN_MONITOR=1`. The job has `continue-on-error`, so it never turns the workflow red. Watch its log for drift in the production prompt, and re-freeze (`eval:explain:freeze --force`, which discards the hand labels) only on purpose.
- **Uncertain band:** a Jev answer whose confidence is below `EVAL_UNCERTAIN_BELOW` (default 0.2) is reported separately, with how many there were, and counts as neither pass nor fail. This applies to the real pass rate and to the flaw catch. Code checks always count. On the frozen set the band holds 5 of 160 answers, including #3 c (the near coin flip below) and #24 c.
- **The flaw catch sits exactly on its gate.** #24 (`wrong_action`) is only failed by an uncertain answer, so it counts as not caught and the result is 9/10 = 90%, the minimum. Any further flawed case that Jev stops rejecting fails the gate. That is the intended signal, but it leaves no margin, so adding more flawed cases would give the number more room.

### Calibration against human labels
40 explanations (30 real, 10 planted flaws) were labelled by hand (`human-labels.xlsx` / `.csv`) before any judge output was seen, then compared with `jev-1.13.0` (`npm run eval:judge`, `npm run eval:calibrate`). 160 labelled cells, with NA where a check does not apply.

| Check | Independent labels | Final labels |
|---|---|---|
| a (facts) | 34/40 = 85% | 35/40 = 88% |
| b1 | 26/29 = 90% | 27/29 = 93% |
| b2 | 5/11 = 45% | 5/11 = 45% |
| c | 33/40 = 83% | 34/40 = 85% |
| d | 39/40 = 98% | 40/40 = 100% |
| **All** | **137/160 = 86%** (95% CI 79-90%) | **141/160 = 88%** (95% CI 82-92%) |

- The final labels differ from the independent ones in one row: #21 (a, b1, c, d changed from F to P). A second review of the other rows in question (#8, #13, #14, #15, #24, #38 and the b2 labels on #18, #19, #23, #28, #30, #37) kept the labels as they were. The independent set was saved before this review.
- With 160 cells the intervals are wide, so differences of a few points are noise.
- **Planted flaws:** Jev rejected 10 of 10 (the code checks also caught #15, #25 and #26). The hand labels flagged 4 of the 10 (#16, #25, #26, #36). The other six (#8, #13, #14, #15, #24, #38) are **unresolved human-judge disagreements**: the labels mark them as passing every check and Jev fails them, with confidence 0.90-0.96 on #8 (a), #13 (b1), #14 (b1) and #15 (a). This has not been settled either way, so the 10/10 catch rate is Jev's own result and is not confirmed by the labels.
- **b2 is the main disagreement area** (45% agreement on 11 cells). On six real Low-risk explanations (#18, #19, #23, #28, #30, #37) the labels fail b2 and Jev passes it, with confidence 0.88-0.96. Treat Jev's b2 verdicts with caution and do not use them alone to gate a change. Excluding b2, agreement is 136/149 = 91%.
- Other remaining disagreements (cell, human / Jev): #3 c P/F, #14 c P/F, #16 c P/F, #24 c P/F, #38 c P/F, #36 c F/P, #25 a P/F, #26 a P/F, #36 a P/F. Jev's confidence is below 0.1 on #3 c, #24 c and #25 a.
- Real explanations: before the uncertain band, Jev passed 28 of 30 on every check (the exceptions were #3 on c and #27 on the sentence-count code check). With the band, #3 is excluded and the gate counts 29 of 30. The thresholds are 0.85 for real pass rate, which leaves room for about four failures, and 0.9 for flaw catch, which tolerates one miss. With only 10 planted flaws the true catch rate could be around 70%, so add more flawed cases before raising it.
- Jev's confidence is a rough guide only: answers with confidence of 0.9 or more covered 25% of cells and agreed with the labels 80% of the time.

## Known findings (tracked, not fixed)
- **Explanation #27 has three sentences.** The production prompt says "at most two short sentences". For the Low pair "Allied Rubber Products" (AR-3300 vs AR-33000, invoice A already paid) `gpt-4o-mini` writes three, caught by the `at_most_two_sentences` code check. The frozen text is in `explanations.json`. No prompt change yet; this is recorded so a later prompt edit can be measured against it.
- **Explanation #3 (possible prompt improvement).** Pair: Eastern Gaskets Pvt Ltd (V10) vs Eastern Gaskets Private Limited (V11), same number EG-3345, same amount, action "Check with supplier". The explanation says "This looks like a repeat of an invoice already paid" and does not say why the supplier should confirm (one supplier under two vendor accounts). Jev's c check fails it at p = 0.47 (the probability of yes) (confidence 0.06, effectively a coin flip); the hand label passes it. Both readings are defensible. If the production prompt asked "Check with supplier" explanations to state the reason for the supplier check, this case would be unambiguous. No prompt change yet; frozen text is in `explanations.json`.

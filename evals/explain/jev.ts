// TypeSafe Jev as the judge. Jev answers typed questions about a "state" with a probability and no free text.
// HTTP API per https://docs.typesafe.ai/api : POST https://api.typesafe.ai/v1/systemone, Authorization: Bearer <key>,
// body {model, state, questions:{name:{type:'noul', instructions, criteria?}}}, reply {model, answers:{name:{type:'noul', noul:p}}, usage}.
// A Noul's value p is the probability of "yes". There is no label or confidence field, so the label is p >= 0.5 and the
// confidence is |2p - 1| (0 at p = 0.5, 1 at p = 0 or 1, as in TypeSafe's confidence page).
//
// The key is read from TYPESAFE_API_KEY. JEV_MOCK=1 swaps in a crude text-heuristic stand-in so the pipeline can be run without a key.
// Mock numbers say nothing about Jev: every report prints a banner when they are used.
import type { ExplainInput } from '../../lib/ai-prompts';

export const JEV_MODEL = process.env.JEV_MODEL || 'jev-1.13.0'; // pinned; jev-latest points here today but moves on new releases
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export type Check = 'a' | 'b1' | 'b2' | 'c' | 'd';
export type Question = { check: Check; name: string; instructions: string; criteria: { true: string; false: string }; passWhen: 'yes' | 'no' };

/** The questions Jev is asked about one explanation. b1 applies to High and Medium pairs, b2 to Low pairs only. */
export function buildQuestions(input: ExplainInput): Question[] {
  const qs: Question[] = [
    {
      check: 'a', name: 'a_unsupported_fact', passWhen: 'no',
      instructions: 'Does the explanation state any fact, cause, event or relationship that is not present in the pair data (for example an invented reason, something a supplier said or did, a bank detail, a tax detail, or an identifier that is not given)? Judge facts only, not wording or tone.',
      criteria: { true: 'At least one stated fact cannot be found in the pair data or the rules list.', false: 'Every fact stated (names, numbers, dates, routing, and the conclusion drawn from the rules) comes from the pair data.' }
    },
    {
      check: 'c', name: 'c_conclusion_fits_action', passWhen: 'yes',
      instructions: `The suggested action for this pair is "${input.action}". Does the conclusion of the explanation fit that action?`,
      criteria: input.action === 'Block the open invoice'
        ? { true: 'The explanation concludes plainly that this looks like the same invoice entered twice, or a repeat of an invoice already paid, without telling the analyst to ask the supplier first.', false: 'The explanation hedges, asks for a supplier check, or concludes something else.' }
        : { true: 'The explanation states the duplicate evidence and gives a reason the supplier should confirm before paying (such as a possible invoice-number typo or one supplier under two vendor accounts).', false: 'The explanation concludes plainly that it is the same invoice with no supplier-confirmation caveat, or concludes something else.' }
    },
    {
      check: 'd', name: 'd_claims_system_action', passWhen: 'no',
      instructions: 'Does the explanation say or imply that InvoiceGuard has blocked, will block, held, released or paid an invoice or a payment, or that the system takes any action in the ERP?',
      criteria: { true: 'It says or implies InvoiceGuard blocks, holds, releases or pays, or acts in the ERP.', false: 'It only describes what the invoices show and what the analyst should conclude.' }
    }
  ];
  if (input.risk === 'High' || input.risk === 'Medium') {
    qs.push({
      check: 'b1', name: 'b1_uncertain_or_legitimate', passWhen: 'no',
      instructions: 'Does the explanation call this pair uncertain, unclear or unsure, or suggest that the invoices may be legitimate or valid?',
      criteria: { true: 'It expresses doubt about whether this is a duplicate, or says the invoices could be legitimate or valid.', false: 'It treats the pair as a likely or very likely duplicate. Asking the supplier to confirm a caveat is not doubt.' }
    });
  } else {
    qs.push({
      check: 'b2', name: 'b2_overclaims_certainty', passWhen: 'no',
      instructions: 'Does the explanation state that this pair is definitely or certainly a duplicate, leaving no room for the invoices to be legitimate?',
      criteria: { true: 'It speaks with certainty (for example "definitely", "no doubt", "clearly a duplicate") about a pair whose evidence is weak.', false: 'It states the evidence at a measured level, or notes the invoices could be legitimate and are worth a quick check.' }
    });
  }
  return qs;
}

export type Answer = { p: number; label: 'yes' | 'no'; confidence: number; pass: boolean };
export type JevResult = { model: string; mock: boolean; answers: Partial<Record<Check, Answer>> };

export const toAnswer = (p: number, passWhen: 'yes' | 'no'): Answer => {
  const label = p >= 0.5 ? 'yes' : 'no';
  return { p, label, confidence: Math.abs(2 * p - 1), pass: label === passWhen };
};

type Transport = (body: unknown) => Promise<{ model: string; answers: Record<string, { noul: number }> }>;

async function http(body: unknown): Promise<{ model: string; answers: Record<string, { noul: number }> }> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error('TYPESAFE_API_KEY is not set (or set JEV_MOCK=1 to run the pipeline with the stand-in judge)');
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: ctrl.signal });
      if ((res.status === 429 || res.status === 529) && attempt < 3) { await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); continue; }
      if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Crude heuristic stand-in for tests and dry runs. It looks at words, so it is NOT a model of Jev's behaviour. */
export function mockTransport(state: { pair: ExplainInput; explanation: string }, names: string[]): Record<string, { noul: number }> {
  const t = state.explanation;
  const has = (re: RegExp) => re.test(t);
  const out: Record<string, number> = {
    a_unsupported_fact: has(/bank account|GST|confirmed that|revised|new account|supplier has/i) ? 0.92 : 0.06,
    c_conclusion_fits_action: state.pair.action === 'Block the open invoice'
      ? (has(/confirm|ask the supplier|check with/i) ? 0.1 : 0.9)
      : (has(/typo|two vendor accounts|confirm|check/i) ? 0.88 : 0.12),
    d_claims_system_action: has(/block|hold|release|InvoiceGuard (has|will)/i) ? 0.95 : 0.04,
    b1_uncertain_or_legitimate: has(/unclear|uncertain|unsure|legitimate|hard to say|may well/i) ? 0.93 : 0.07,
    b2_overclaims_certainty: has(/definitely|no doubt|certainly|clearly a duplicate/i) ? 0.94 : 0.08
  };
  return Object.fromEntries(names.map((n) => [n, { noul: out[n] ?? 0.5 }]));
}

/** Asks Jev the questions for one explanation. One request, one answer per question. */
export async function judge(input: ExplainInput, explanation: string, transport?: Transport): Promise<JevResult> {
  const questions = buildQuestions(input);
  const state = { pair: input, explanation };
  const mock = !transport && process.env.JEV_MOCK === '1';
  const body = {
    model: JEV_MODEL,
    state,
    questions: Object.fromEntries(questions.map((q) => [q.name, { type: 'noul', instructions: q.instructions, criteria: q.criteria }]))
  };
  const reply = mock
    ? { model: 'MOCK', answers: mockTransport(state, questions.map((q) => q.name)) }
    : await (transport ?? http)(body);
  const answers: JevResult['answers'] = {};
  for (const q of questions) {
    const a = reply.answers?.[q.name];
    if (typeof a?.noul !== 'number') throw new Error(`Jev reply has no answer for ${q.name}`);
    answers[q.check] = toAnswer(a.noul, q.passWhen);
  }
  return { model: reply.model, mock, answers };
}

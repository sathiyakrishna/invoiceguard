import { describe, it, expect } from 'vitest';
import { CASES, REAL } from '@/evals/explain/fixtures';
import { runCodeChecks } from '@/evals/explain/code-checks';
import { buildQuestions, judge, mockTransport, toAnswer } from '@/evals/explain/jev';
import { agreement, atThreshold, brier, confusion, parseLabels, wilson, type Item } from '@/evals/explain/calibration';

const names = (cs: ReturnType<typeof runCodeChecks>) => cs.filter((c) => !c.pass).map((c) => c.name);
const open = REAL[0]; // High, exact match, nothing paid
const paid = REAL[4]; // High, invoice A already paid on 18/09/2026

describe('explanation fixtures', () => {
  it('has 40 cases: 30 real (10 High, 10 Medium, 10 Low) and 10 flawed, numbered 1..40', () => {
    expect(CASES.map((c) => c.n)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(CASES.filter((c) => c.kind === 'real')).toHaveLength(30);
    expect(CASES.filter((c) => c.kind === 'flawed')).toHaveLength(10);
    for (const band of ['High', 'Medium', 'Low']) expect(REAL.filter((r) => r.risk === band)).toHaveLength(10);
  });
  it('takes risk, rules and action from detect(), never typed by hand', () => {
    expect(open.action).toBe('Block the open invoice');
    expect(REAL.filter((r) => r.risk === 'Low').every((r) => r.action === 'Check with supplier')).toBe(true);
  });
});

describe('code checks', () => {
  const good = `${open.a.vendor_name} billed ${open.a.invoice_no} for ${open.a.amount} on ${open.a.invoice_date} and again on ${open.b.invoice_date}. This looks like the same invoice entered twice.`;
  it('passes a faithful explanation', () => {
    expect(names(runCodeChecks(open, good))).toEqual([]);
  });
  it('catches an altered amount, a date that is not in the data and an invented identifier', () => {
    expect(names(runCodeChecks(open, good.replace(open.a.amount, '₹4,53,210.50')))).toContain('amounts_match_data');
    expect(names(runCodeChecks(open, good.replace(open.b.invoice_date, '30/09/2026')))).toContain('dates_match_data');
    expect(names(runCodeChecks(open, `${good} Posted under PO 4500099999.`))).toContain('identifiers_match_data');
  });
  it('requires the already-paid wording exactly when invoice A has a cleared_on date', () => {
    const base = `${paid.a.vendor_name} billed ${paid.a.invoice_no} for ${paid.a.amount} on ${paid.a.invoice_date}`;
    expect(names(runCodeChecks(paid, `${base}; it was already paid on ${paid.a.cleared_on}. The same number is open again.`))).toEqual([]);
    expect(names(runCodeChecks(paid, `${base}. The same number is open again.`))).toContain('already_paid_stated');
    expect(names(runCodeChecks(open, `${good.replace('This looks', 'It was already paid on 18/09/2026. This looks')}`))).toContain('dates_match_data');
    expect(names(runCodeChecks(open, `${open.a.invoice_no} was already paid. Same invoice twice.`))).toContain('no_payment_claim_when_open');
  });
  it('rejects a third sentence and wording that has InvoiceGuard act on invoices', () => {
    expect(names(runCodeChecks(open, `${good} It matches. Please look.`))).toContain('at_most_two_sentences');
    expect(names(runCodeChecks(open, 'KS-7741 for ₹4,53,210.55 looks doubled. InvoiceGuard has blocked the open invoice.'))).toContain('no_action_wording');
    expect(names(runCodeChecks(open, 'KS-7741 looks doubled; the invoice was blocked.'))).toContain('no_action_wording');
  });
  it('does not mistake decimals in amounts for sentence ends', () => {
    expect(runCodeChecks(open, good).find((c) => c.name === 'at_most_two_sentences')?.pass).toBe(true);
  });
});

describe('Jev client', () => {
  it('asks one yes/no question per condition, with b1 for High/Medium and b2 for Low only', () => {
    const checks = (r: (typeof REAL)[number]) => buildQuestions(r).map((q) => q.check).sort();
    expect(checks(REAL[0])).toEqual(['a', 'b1', 'c', 'd']);
    expect(checks(REAL[15])).toEqual(['a', 'b1', 'c', 'd']);
    expect(checks(REAL[25])).toEqual(['a', 'b2', 'c', 'd']);
  });
  it('turns a probability into a label, a confidence and a pass', () => {
    expect(toAnswer(0.97, 'no')).toMatchObject({ label: 'yes', pass: false });
    expect(toAnswer(0.97, 'no').confidence).toBeCloseTo(0.94);
    expect(toAnswer(0.5, 'yes')).toMatchObject({ label: 'yes', confidence: 0 });
    expect(toAnswer(0.2, 'yes')).toMatchObject({ label: 'no', pass: false });
  });
  it('sends the documented request shape and reads the documented reply shape', async () => {
    let sent: any;
    const res = await judge(open, 'KS-7741 looks doubled.', async (body) => {
      sent = body;
      return { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys((body as any).questions).map((k) => [k, { type: 'noul', noul: 0.1 }])) };
    });
    expect(sent.model).toBe('jev-1.13.0');
    expect(sent.state.explanation).toBe('KS-7741 looks doubled.');
    expect(sent.state.pair.risk).toBe('High');
    expect(Object.values<any>(sent.questions).every((q) => q.type === 'noul' && typeof q.instructions === 'string')).toBe(true);
    expect(res.model).toBe('jev-1.13.0');
    expect(res.answers.a?.pass).toBe(true); // p = 0.1 on "is there an unsupported fact": no, pass
    expect(res.answers.c?.pass).toBe(false); // p = 0.1 on "does the conclusion fit": no, fail
  });
  it('fails loudly when an answer is missing from the reply', async () => {
    await expect(judge(open, 'x', async () => ({ model: 'm', answers: {} }))).rejects.toThrow(/no answer/);
  });
  it('the stand-in judge is deterministic and marks itself as a mock', () => {
    expect(mockTransport({ pair: open, explanation: 'InvoiceGuard has blocked it.' }, ['d_claims_system_action']).d_claims_system_action.noul).toBeGreaterThan(0.5);
  });
});

describe('calibration maths', () => {
  const item = (human: 'P' | 'F', jevPass: boolean, p: number): Item => ({ n: 1, check: 'a', human, jevPass, p, confidence: Math.abs(2 * p - 1) });
  const items = [item('P', true, 0.05), item('P', true, 0.4), item('F', false, 0.95), item('F', true, 0.45), item('P', false, 0.6)];
  it('counts agreement and the dangerous direction', () => {
    expect(agreement(items)).toMatchObject({ n: 5, agree: 3, rate: 0.6 });
    expect(confusion(items)).toEqual({ bothPass: 2, bothFail: 1, jevPassHumanFail: 1, jevFailHumanPass: 1 });
  });
  it('reports agreement and coverage at a confidence threshold', () => {
    const r = atThreshold(items, 0.8); // keeps p = 0.05 and 0.95
    expect(r).toMatchObject({ n: 2, agree: 2, coverage: 0.4 });
    expect(atThreshold(items, 0).coverage).toBe(1);
  });
  it('scores a perfect and a coin-flip judge with the Brier score', () => {
    const noQ = () => 'no' as const;
    expect(brier([item('P', true, 0), item('F', false, 1)], noQ)).toBe(0);
    expect(brier([item('P', true, 0.5), item('F', false, 0.5)], noQ)).toBe(0.25);
  });
  it('gives a sensible Wilson interval', () => {
    const w = wilson(8, 10);
    expect(w.low!).toBeGreaterThan(0.45);
    expect(w.high!).toBeLessThan(0.97);
    expect(wilson(0, 0)).toEqual({ low: null, high: null });
  });
  it('parses the label file, keeps blanks and NA, and rejects other values', () => {
    const rows = parseLabels('n,risk,action,a,b1,b2,c,d\n1,High,"Block the open invoice",P,F,NA,,P\n');
    expect(rows[0].labels).toEqual({ a: 'P', b1: 'F', b2: 'NA', c: '', d: 'P' });
    expect(() => parseLabels('n,risk,action,a,b1,b2,c,d\n1,High,x,Y,,,,\n')).toThrow(/not P, F or NA/);
  });
});

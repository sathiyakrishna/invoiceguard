// Checks done in code, never by the judge: amounts, dates, invoice and document numbers, the "already paid" rule,
// sentence count and wording that implies InvoiceGuard acts on invoices. Deterministic and free.
import type { ExplainInput } from '../../lib/ai-prompts';

export type CodeCheck = { name: string; pass: boolean; detail: string };

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function runCodeChecks(input: ExplainInput, explanation: string): CodeCheck[] {
  const checks: CodeCheck[] = [];
  const add = (name: string, pass: boolean, detail = '') => checks.push({ name, pass, detail });

  // 1. amounts: every rupee figure must be one of the two amounts, character for character
  const amounts = explanation.match(/₹\s?[\d,]+(?:\.\d+)?/g) ?? [];
  const okAmounts = new Set([input.a.amount, input.b.amount]);
  const badAmounts = amounts.filter((a) => !okAmounts.has(a.replace(/\s/g, '')));
  add('amounts_match_data', badAmounts.length === 0, badAmounts.length ? `not in the data: ${badAmounts.join(', ')}` : amounts.length ? '' : 'no amount stated');

  // 2. dates: every dd/mm/yyyy must be one of the pair's dates
  const dates = explanation.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? [];
  const okDates = new Set([input.a.invoice_date, input.b.invoice_date, input.a.cleared_on].filter(Boolean));
  const badDates = dates.filter((d) => !okDates.has(d));
  add('dates_match_data', badDates.length === 0, badDates.length ? `not in the data: ${badDates.join(', ')}` : '');

  // 3. already-paid rule: said exactly when invoice A has a cleared_on date, with that date copied exactly
  const paidSaid = /already paid/i.test(explanation);
  if (input.a.cleared_on) {
    add('already_paid_stated', explanation.includes(`was already paid on ${input.a.cleared_on}`), `invoice A has cleared_on ${input.a.cleared_on}; the wording "was already paid on <date>" is required`);
  } else {
    add('no_payment_claim_when_open', !paidSaid && !/\bpaid on\b/i.test(explanation), 'cleared_on is empty, so nothing about payment may be said');
  }
  if (input.b.cleared_on) add('no_cleared_date_for_b', !explanation.includes(input.b.cleared_on), 'a cleared_on date for invoice B must not be mentioned');

  // 4. identifiers: a reference-looking token that is not in the data is an invented fact
  const known = new Set([input.a.invoice_no, input.b.invoice_no, input.a.po_number, input.b.po_number, input.a.doc_number, input.b.doc_number, input.a.vendor_id, input.b.vendor_id, input.a.company_code, input.b.company_code]
    .filter(Boolean).map(norm));
  const stripped = explanation.replace(/₹\s?[\d,]+(?:\.\d+)?/g, ' ').replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, ' ');
  const tokens = stripped.match(/\b[A-Z]{1,5}[-/ ]?\d{2,}[A-Z0-9-]*\b|\b\d{4,}\b/g) ?? [];
  const unknown = tokens.filter((t) => !known.has(norm(t)) && ![...known].some((k) => k.includes(norm(t)) || norm(t).includes(k)));
  add('identifiers_match_data', unknown.length === 0, unknown.length ? `not in the data: ${unknown.join(', ')}` : '');
  const mentioned = [input.a.invoice_no, input.b.invoice_no].some((n) => n && norm(explanation).includes(norm(n)));
  add('states_an_invoice_number', mentioned, 'the explanation should name at least one of the invoice numbers');

  // 5. length: at most two sentences
  const sentences = explanation.trim().split(/(?<=[.!?])\s+(?=[A-Z₹"])/).filter(Boolean);
  add('at_most_two_sentences', sentences.length <= 2, `${sentences.length} sentence(s)`);

  // 6. wording: the prompt forbids mentioning blocking, an action, or InvoiceGuard acting on invoices or payments
  const acts = explanation.match(/\b(block(?:ed|ing|s)?|payment block|release[sd]?|will pay|has paid|have paid|hold(?:s|ing)? (?:the )?(?:payment|next)|put on hold|InvoiceGuard (?:has|will|is)\b)/gi) ?? [];
  add('no_action_wording', acts.length === 0, acts.length ? `found: ${acts.join(', ')}` : '');

  return checks;
}

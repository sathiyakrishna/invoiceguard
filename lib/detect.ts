// InvoiceGuard detection engine.
// Deterministic rules find and score candidate duplicate pairs.
// AI is used elsewhere only to (a) decide whether two vendor accounts are the
// same supplier and (b) explain a flag. It never changes a score.

export type InvoiceRow = {
  company_code: string;
  vendor_id: string;
  vendor_name: string;
  invoice_ref: string;
  invoice_date: string | null; // ISO yyyy-mm-dd
  amount: number;
  currency: string;
  po_number: string;
  doc_number: string;
  reversed_with?: string; // SAP STBLG: the document this one was reversed with (blank if not reversed)
  clearing_date?: string | null; // SAP AUGDT, ISO date: when it was paid/cleared. Blank = open, in this payment run
  clearing_document?: string; // SAP AUGBL: the document that cleared it
};

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';

export const RULES: Record<RuleId, { label: string; points: number }> = {
  R1: { label: 'Normalized invoice number match', points: 50 },
  R2: { label: 'Invoice number with a typo (swapped or extra character)', points: 30 },
  R3: { label: 'Same gross amount', points: 30 },
  R4: { label: 'Amount within 1%', points: 15 },
  R5: { label: 'Invoice dates within 30 days', points: 10 },
  R6: { label: 'Posted in two company codes', points: 10 },
  R7: { label: 'One with PO, one without', points: 10 },
  R8: { label: 'Same supplier under two vendor accounts (AI)', points: 10 }
};

export type DupType =
  | 'Exact match'
  | 'Reference format'
  | 'Similar reference'
  | 'Cross company code'
  | 'PO vs non-PO'
  | 'Alternate vendor account'
  | 'Near amount';

export type Band = 'High' | 'Medium' | 'Low';

export type Candidate = {
  a: number; // index of the earlier invoice
  b: number; // index of the later invoice
  score: number;
  band: Band;
  rules: RuleId[];
  type: DupType;
  pairKey: string;
  refSimilarity: number;
};

export const MIN_SCORE = 50;
const AMOUNT_TOLERANCE = 0.01;
const DATE_WINDOW_DAYS = 30;
const REF_SIMILARITY = 0.85;

// ---------- normalization ----------

export function normalizeRef(ref: string): string {
  const cleaned = (ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // drop leading zeros inside each digit run: INV0012 -> INV12
  return cleaned.replace(/(^|[A-Z])0+(?=\d)/g, '$1');
}

const VENDOR_NOISE = /\b(PVT|PRIVATE|LTD|LIMITED|LLP|INC|CORP|CORPORATION|CO|COMPANY|INDIA|THE|AND|M\/S)\b/g;

export function normalizeVendor(name: string): string {
  return (name || '')
    .toUpperCase()
    .replace(/[.,&()'"\-\/]/g, ' ')
    .replace(VENDOR_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Jaro-Winkler similarity ----------

export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return s1.length ? 1 : 0;
  if (!s1.length || !s2.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const m1 = new Array<boolean>(s1.length).fill(false);
  const m2 = new Array<boolean>(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(i + range + 1, s2.length);
    for (let j = lo; j < hi; j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = true;
      m2[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  const jaro = (matches / s1.length + matches / s2.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ---------- helpers ----------

const MONTHS = /(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEPT|SEP|OCT|NOV|DEC)/g;

/**
 * True when two normalized references differ by a typical keying error:
 * two adjacent characters swapped (40417 / 40471) or one character added or
 * missing (SF55 / SF55A). A single different character is NOT a typo signal,
 * because consecutive invoices (1361 / 1366) differ exactly that way.
 */
export function isTypoPair(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) === 1) {
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
    return false;
  }
  if (a.length !== b.length) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

/** True when two references differ only by a month name, e.g. RENT-AUG vs RENT-SEP. */
export function isRecurringPair(a: string, b: string): boolean {
  const ua = (a || '').toUpperCase();
  const ub = (b || '').toUpperCase();
  const ma = ua.match(MONTHS);
  const mb = ub.match(MONTHS);
  if (!ma || !mb || ma.join() === mb.join()) return false;
  return normalizeRef(ua.replace(MONTHS, '')) === normalizeRef(ub.replace(MONTHS, ''));
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const d = Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
  return Number.isFinite(d) ? d : null;
}

function withinTolerance(x: number, y: number): boolean {
  const hi = Math.max(x, y);
  return hi > 0 && Math.abs(x - y) <= hi * AMOUNT_TOLERANCE;
}

export function vendorPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function bandFor(score: number): Band | null {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  if (score >= MIN_SCORE) return 'Low';
  return null;
}

export type SuggestedAction = 'Block the open invoice' | 'Check with supplier';

/** Decided by the rules that fired, never by the AI. */
export function suggestedAction(rules: string[]): SuggestedAction {
  const has = (r: RuleId) => rules.includes(r);
  if (has('R1') && (has('R3') || has('R4')) && !has('R8')) return 'Block the open invoice';
  return 'Check with supplier'; // R2 (typo), R8 (alias vendor) and everything else
}

/**
 * Booked-and-reversed invoices must never be flagged as duplicates.
 * Returns one boolean per row: true for an invoice that was reversed and for the credit line that reverses it.
 *
 * An invoice is reversed when
 *  - reversed_with is filled (the credit whose doc number matches it is its reversal), or
 *  - a credit line has the same vendor, the same normalized invoice number and the exact negative amount,
 *    dated on or after the invoice. The earliest matching invoice is the one reversed, so a corrected
 *    re-posting (same number and amount, later) stays live.
 * Each credit reverses at most one invoice. Credit lines (amount < 0) are never compared as duplicates.
 */
export function findReversals(rows: InvoiceRow[]): boolean[] {
  const reversed = rows.map(() => false);
  const refs = rows.map((r) => normalizeRef(r.invoice_ref));
  const keyOf = (i: number) => `${rows[i].vendor_id}|${refs[i]}|${Math.abs(rows[i].amount).toFixed(2)}`;
  const creditsByKey = new Map<string, number[]>();
  rows.forEach((r, i) => {
    if (r.amount < 0) creditsByKey.set(keyOf(i), [...(creditsByKey.get(keyOf(i)) ?? []), i]);
  });
  if (!creditsByKey.size && !rows.some((r) => (r.reversed_with ?? '').trim())) return reversed;

  const used = new Set<number>(); // credits already offsetting an invoice
  const invoices = rows.map((_, i) => i).filter((i) => rows[i].amount > 0);
  const byDate = (x: number, y: number) => (rows[x].invoice_date ?? '').localeCompare(rows[y].invoice_date ?? '') || x - y;

  // Pass A: invoices that say they were reversed. Prefer the credit whose doc number is that reversal document.
  for (const i of invoices) {
    const doc = (rows[i].reversed_with ?? '').trim();
    if (!doc) continue;
    reversed[i] = true;
    const free = (c: number) => rows[c].amount < 0 && rows[c].vendor_id === rows[i].vendor_id && !used.has(c);
    const withDoc = (d: string) => (d ? rows.map((_, c) => c).find((c) => free(c) && !!rows[c].doc_number && rows[c].doc_number === d) : undefined);
    const credit = withDoc(doc) ?? withDoc((rows[i].clearing_document ?? '').trim()) ?? (creditsByKey.get(keyOf(i)) ?? []).find((c) => !used.has(c));
    if (credit !== undefined) { used.add(credit); reversed[credit] = true; }
  }

  // Pass B: remaining invoices, earliest first, offset by an exact negative credit dated on or after them.
  for (const i of invoices.filter((x) => !reversed[x]).sort(byDate)) {
    const candidates = (creditsByKey.get(keyOf(i)) ?? []).filter((c) => {
      if (used.has(c)) return false;
      const a = rows[i].invoice_date, b = rows[c].invoice_date;
      return !a || !b || b >= a;
    });
    if (!candidates.length) continue;
    // when the invoice carries a clearing document, prefer the credit whose doc number is that document
    const clearing = (rows[i].clearing_document ?? '').trim();
    const rank = (c: number) => (clearing && rows[c].doc_number === clearing ? 0 : 1);
    const credit = candidates.sort((x, y) => rank(x) - rank(y) || byDate(x, y))[0];
    used.add(credit);
    reversed[i] = true;
    reversed[credit] = true;
  }
  return reversed;
}

/**
 * Vendor-account pairs worth asking the AI about: different vendor accounts with
 * similar names that have an invoice each with the same normalized invoice
 * number and an amount within 1%. A duplicate needs the invoice-number signal
 * anyway, and requiring it stops look-alike vendors (Ltd vs LLP) crowding real
 * aliases out of the top `max`.
 */
export function findVendorCandidates(rows: InvoiceRow[], max = 20): Array<{ a: string; b: string; nameA: string; nameB: string }> {
  const reversed = findReversals(rows);
  const order = rows.map((_, i) => i).filter((i) => rows[i].amount > 0 && !reversed[i]).sort((x, y) => rows[x].amount - rows[y].amount);
  const seen = new Map<string, { a: string; b: string; nameA: string; nameB: string; sim: number }>();
  for (let p = 0; p < order.length; p++) {
    const ri = rows[order[p]];
    for (let q = p + 1; q < order.length; q++) {
      const rj = rows[order[q]];
      if (rj.amount > ri.amount * (1 + AMOUNT_TOLERANCE) + 0.01) break;
      if (!ri.vendor_id || !rj.vendor_id || ri.vendor_id === rj.vendor_id) continue;
      if (ri.clearing_date && rj.clearing_date) continue; // both already paid: never a pair, so no need to ask the AI
      const key = vendorPairKey(ri.vendor_id, rj.vendor_id);
      if (seen.has(key)) continue;
      const refA = normalizeRef(ri.invoice_ref);
      if (!refA || refA !== normalizeRef(rj.invoice_ref)) continue;
      const na = normalizeVendor(ri.vendor_name);
      const nb = normalizeVendor(rj.vendor_name);
      if (!na || !nb) continue;
      const sim = jaroWinkler(na, nb);
      const contains = na.includes(nb) || nb.includes(na);
      if (sim >= 0.75 || contains) {
        seen.set(key, { a: ri.vendor_id, b: rj.vendor_id, nameA: ri.vendor_name, nameB: rj.vendor_name, sim: contains ? 1 : sim });
      }
    }
  }
  return [...seen.values()].sort((x, y) => y.sim - x.sim).slice(0, max).map(({ sim: _s, ...rest }) => rest);
}

/**
 * Find candidate duplicate pairs.
 * @param sameSupplier vendor-account pairs the AI confirmed as the same supplier (keys from vendorPairKey)
 * @param ignoredKeys pair keys the user previously marked Ignore
 */
export function detect(rows: InvoiceRow[], sameSupplier: Set<string> = new Set(), ignoredKeys: Set<string> = new Set()): Candidate[] {
  const refs = rows.map((r) => normalizeRef(r.invoice_ref));
  // reversed invoices, their reversal credits and all other credit lines never take part in a pair
  const reversed = findReversals(rows);
  const order = rows.map((_, i) => i).filter((i) => rows[i].amount > 0 && !reversed[i]).sort((x, y) => rows[x].amount - rows[y].amount);
  const out: Candidate[] = [];

  for (let p = 0; p < order.length; p++) {
    const i = order[p];
    const ri = rows[i];
    if (!(ri.amount > 0)) continue;
    for (let q = p + 1; q < order.length; q++) {
      const j = order[q];
      const rj = rows[j];
      if (rj.amount > ri.amount * (1 + AMOUNT_TOLERANCE) + 0.01) break;

      // the same SAP document listed twice is not a duplicate invoice
      if (ri.doc_number && ri.doc_number === rj.doc_number && ri.company_code === rj.company_code) continue;

      // two invoices that are both already paid are outside pre-payment scope. At least one must be open
      // (files without clearing dates have no cleared rows, so this never fires for them).
      const iPaid = !!ri.clearing_date;
      const jPaid = !!rj.clearing_date;
      if (iPaid && jPaid) continue;

      const sameVendor = !!ri.vendor_id && ri.vendor_id === rj.vendor_id;
      const altVendor = !sameVendor && !!ri.vendor_id && !!rj.vendor_id && sameSupplier.has(vendorPairKey(ri.vendor_id, rj.vendor_id));
      if (!sameVendor && !altVendor) continue;

      const rules: RuleId[] = [];
      const refA = refs[i];
      const refB = refs[j];
      let refSimilarity = 0;
      if (refA && refA === refB) {
        rules.push('R1');
        refSimilarity = 1;
      } else if (refA && refB) {
        refSimilarity = jaroWinkler(refA, refB);
        if (refSimilarity >= REF_SIMILARITY && isTypoPair(refA, refB)) rules.push('R2');
      }
      // a duplicate needs a reference signal; amount alone is too weak
      if (!rules.length) continue;
      // recurring charges (RENT-AUG vs RENT-SEP) are not duplicates
      if (rules[0] === 'R2' && isRecurringPair(ri.invoice_ref, rj.invoice_ref)) continue;

      if (ri.amount === rj.amount) rules.push('R3');
      else if (withinTolerance(ri.amount, rj.amount)) rules.push('R4');

      const gap = daysBetween(ri.invoice_date, rj.invoice_date);
      if (gap !== null && gap <= DATE_WINDOW_DAYS) rules.push('R5');
      // a merely similar number far apart in time is usually the next invoice in a series
      if (rules[0] === 'R2' && !rules.includes('R5')) continue;
      // routing differences only matter when the invoice numbers really match
      const strongRef = rules[0] === 'R1';
      if (strongRef && ri.company_code && rj.company_code && ri.company_code !== rj.company_code) rules.push('R6');
      if (strongRef && !!ri.po_number !== !!rj.po_number) rules.push('R7');
      if (altVendor) rules.push('R8');

      const score = Math.min(100, rules.reduce((s, r) => s + RULES[r].points, 0));
      const band = bandFor(score);
      if (!band) continue;

      const vendorKey = sameVendor ? ri.vendor_id : vendorPairKey(ri.vendor_id, rj.vendor_id);
      const refKey = [refA, refB].sort().join('~');
      const pairKey = `${vendorKey}|${refKey}|${Math.round(Math.max(ri.amount, rj.amount))}`;
      if (ignoredKeys.has(pairKey)) continue;

      let type: DupType;
      if (altVendor) type = 'Alternate vendor account';
      else if (rules.includes('R6')) type = 'Cross company code';
      else if (rules.includes('R7')) type = 'PO vs non-PO';
      else if (rules.includes('R4')) type = 'Near amount';
      else if (rules.includes('R1')) type = ri.invoice_ref.trim() === rj.invoice_ref.trim() ? 'Exact match' : 'Reference format';
      else type = 'Similar reference';

      // A = the paid (cleared) invoice if there is one, otherwise the earlier invoice (or earlier posting). B = the other
      const aFirst = iPaid !== jPaid ? iPaid : (ri.invoice_date ?? '') <= (rj.invoice_date ?? '');
      out.push({ a: aFirst ? i : j, b: aFirst ? j : i, score, band, rules, type, pairKey, refSimilarity: Math.round(refSimilarity * 100) / 100 });
    }
  }

  return out.sort((x, y) => y.score - x.score);
}

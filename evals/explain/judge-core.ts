// One explanation in, one judged record out: the code checks plus Jev's answers.
import type { ExplainInput } from '../../lib/ai-prompts';
import { runCodeChecks, type CodeCheck } from './code-checks';
import { judge, type JevResult } from './jev';

export type Judged = {
  n: number;
  kind: 'real' | 'flawed';
  flaw?: string;
  input: ExplainInput;
  explanation: string;
  code: CodeCheck[];
  jev?: JevResult;
  error?: string;
  pass: boolean;
  failedChecks: string[]; // names of failed code checks and of Jev questions
};

export async function evaluate(c: { n: number; kind: 'real' | 'flawed'; flaw?: string; input: ExplainInput }, explanation: string): Promise<Judged> {
  const code = runCodeChecks(c.input, explanation);
  let jev: JevResult | undefined;
  let error: string | undefined;
  try {
    jev = await judge(c.input, explanation);
  } catch (e) {
    error = String(e instanceof Error ? e.message : e);
  }
  const failedChecks = [
    ...code.filter((x) => !x.pass).map((x) => x.name),
    ...Object.entries(jev?.answers ?? {}).filter(([, a]) => a && !a.pass).map(([k]) => `jev:${k}`)
  ];
  return { n: c.n, kind: c.kind, flaw: c.flaw, input: c.input, explanation, code, jev, error, pass: !error && failedChecks.length === 0, failedChecks };
}

/** Reads the record assert.cjs stored in a Promptfoo result. Promptfoo replaces the top-level reason of a passing result, so it is in componentResults. */
export function recordFromResult(r: any): Judged {
  const raw = r.gradingResult?.componentResults?.[0]?.reason ?? r.gradingResult?.reason;
  return JSON.parse(raw) as Judged;
}

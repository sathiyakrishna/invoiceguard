import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from '../scripts/_env.mjs';

const ROOT = join(__dirname, '..');
const dirs: string[] = [];
const envDir = (contents: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'tester-env-'));
  dirs.push(dir);
  writeFileSync(join(dir, '.env.local'), contents);
  return dir;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  for (const k of ['LOADENV_TEST_A', 'LOADENV_TEST_B', 'LOADENV_TEST_C', 'LOADENV_TEST_D']) delete process.env[k];
});

describe('loadEnv', () => {
  it('reads .env.local style files: BOM, CRLF, comments, quotes and spaces', () => {
    const dir = envDir('﻿# comment\r\nLOADENV_TEST_A=plain\r\nLOADENV_TEST_B="quoted value"\r\n\r\nLOADENV_TEST_C= spaced \r\nnot a variable line\r\n');
    loadEnv(join(dir, '.env.local'));
    expect(process.env.LOADENV_TEST_A).toBe('plain');
    expect(process.env.LOADENV_TEST_B).toBe('quoted value');
    expect(process.env.LOADENV_TEST_C).toBe('spaced');
  });

  it('lets a variable already set in the environment win, and tolerates a missing file', () => {
    process.env.LOADENV_TEST_D = 'from-shell';
    loadEnv(join(envDir('LOADENV_TEST_D=from-file\n'), '.env.local'));
    expect(process.env.LOADENV_TEST_D).toBe('from-shell');
    expect(() => loadEnv(join(tmpdir(), 'does-not-exist.env'))).not.toThrow();
  });

  it('prints nothing', () => {
    const out: string[] = [];
    const w = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string) => (out.push(String(s)), true)) as typeof process.stdout.write;
    try {
      loadEnv(join(envDir('LOADENV_TEST_A=secret-value\n'), '.env.local'));
    } finally {
      process.stdout.write = w;
    }
    expect(out.join('')).not.toContain('secret-value');
  });
});

// Runs the real scripts with the working directory set to a folder whose only config is .env.local, and no
// TESTER_EMAIL or Supabase variable in the environment, the way `npm run tester-user` behaves in a fresh shell.
function run(script: string, fileContents: string, extraEnv: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };
  for (const k of ['TESTER_EMAIL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!(k in extraEnv)) delete env[k];
  return spawnSync(process.execPath, [join(ROOT, 'scripts', script)], { cwd: envDir(fileContents), env, encoding: 'utf8', timeout: 30_000 });
}

describe.each(['create-tester.mjs', 'reset-tester.mjs'])('%s reads TESTER_EMAIL from .env.local', (script) => {
  it('sees TESTER_EMAIL set only in .env.local (the bug: it was read before the file was loaded)', () => {
    const r = run(script, '﻿TESTER_EMAIL=me+tester@example.com\r\n');
    expect(r.status).toBe(1);
    expect(r.stderr).not.toMatch(/Set TESTER_EMAIL/); // got past the email check...
    expect(r.stderr).toMatch(/NEXT_PUBLIC_SUPABASE_URL/); // ...and stopped at the next missing setting
  });

  it('still refuses when .env.local has no TESTER_EMAIL', () => {
    const r = run(script, 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1\r\n');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Set TESTER_EMAIL/);
  });

  it('prefers a TESTER_EMAIL set in the shell over the file', () => {
    const r = run(script, 'TESTER_EMAIL=me+tester@example.com\n', { TESTER_EMAIL: 'not-an-email' });
    expect(r.stderr).toMatch(/not a valid email/);
  });

  it('prints no secrets from .env.local, even when the Supabase call fails', () => {
    const secret = 'sk-test-SECRET-do-not-print';
    const r = run(script, `TESTER_EMAIL=me+tester@example.com\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1\nSUPABASE_SERVICE_ROLE_KEY=${secret}\n`);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe(''); // no "created:" or password line
    expect(r.stdout + r.stderr).not.toContain(secret);
    expect(r.stdout + r.stderr).not.toMatch(/password/i);
  });
});

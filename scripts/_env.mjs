// Shared by the tester scripts: loads .env.local, reads TESTER_EMAIL and returns a service-role client.
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

/**
 * Loads KEY=value lines from an env file into process.env, like the app's other scripts do. A variable that is
 * already set in the environment wins. Handles a BOM, CRLF line endings and optionally quoted values.
 * Never prints anything. Safe to call more than once.
 */
export function loadEnv(file = '.env.local') {
  if (!existsSync(file)) return;
  let text = readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // byte order mark
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}

export function loadAdmin() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** The tester's email from TESTER_EMAIL. There is deliberately no default: it must be an inbox you own. */
export function testerEmail() {
  loadEnv(); // read .env.local first, so TESTER_EMAIL set there is seen
  const email = (process.env.TESTER_EMAIL ?? '').trim().toLowerCase();
  if (!email) throw new Error('Set TESTER_EMAIL in .env.local to an inbox you own (a plus-alias works, e.g. you+tester@gmail.com). Not running without it.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('TESTER_EMAIL is not a valid email address.');
  return email;
}

/** Finds an auth user by email, paging through the list. */
export async function findUser(admin, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

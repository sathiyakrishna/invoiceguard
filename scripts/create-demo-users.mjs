// Creates three judge demo accounts (judge1..3@DEMO_EMAIL_DOMAIN) with higher limits.
// Usage: put DEMO_PASSWORD_1..3 in .env.local, then: npm run demo-users
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.DEMO_EMAIL_DOMAIN || 'invoiceguard.app';
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');

const admin = createClient(url, key, { auth: { persistSession: false } });

for (const n of [1, 2, 3]) {
  const password = process.env[`DEMO_PASSWORD_${n}`];
  const email = `judge${n}@${domain}`;
  if (!password || password.length < 12) { console.log(`skip ${email}: set DEMO_PASSWORD_${n} (12+ characters)`); continue; }
  let { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list.users.find((u) => u.email === email);
    await admin.auth.admin.updateUserById(existing.id, { password });
    data = { user: existing };
    error = null;
  }
  if (error) { console.error(email, error.message); continue; }
  await admin.from('profiles').upsert({ id: data.user.id, is_demo: true });
  console.log(`ready: ${email}`);
}

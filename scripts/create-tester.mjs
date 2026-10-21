// Creates or rotates the shared test account: email + password, flagged is_tester (capped limits, cannot self-delete).
// Usage: set TESTER_EMAIL in .env.local, then: npm run tester-user
// Run it yourself in a terminal: the new password is printed once and stored nowhere. Re-run to rotate it.
import { loadAdmin, testerEmail, findUser } from './_env.mjs';
import { generatePassword } from './tester-password.mjs';

try {
  const email = testerEmail();
  const admin = loadAdmin();
  const existing = await findUser(admin, email);
  let id = existing?.id;

  if (existing) {
    const { data: profile } = await admin.from('profiles').select('is_tester').eq('id', existing.id).maybeSingle();
    if (!profile?.is_tester) throw new Error(`${email} already exists and is not a test account. Use a different TESTER_EMAIL; this script only manages its own account.`);
  }

  const password = generatePassword();
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  }
  const { error: pErr } = await admin.from('profiles').upsert({ id, is_tester: true, is_demo: false });
  if (pErr) throw pErr;

  console.log(`${existing ? 'rotated' : 'created'}: ${email}`);
  console.log(`password (shown once, copy it now): ${password}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Failed.');
  process.exit(1);
}

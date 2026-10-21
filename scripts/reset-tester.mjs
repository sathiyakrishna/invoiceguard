// Wipes the test account's scans, invoices, flagged pairs, decisions and vendor matches so the next tester starts fresh.
// The account, its password and its usage counts are kept (resetting usage would let testers get around the limits).
// Usage: npm run tester-reset
import { loadAdmin, testerEmail, findUser } from './_env.mjs';

try {
  const email = testerEmail();
  const admin = loadAdmin();
  const user = await findUser(admin, email);
  if (!user) throw new Error(`${email} does not exist. Run npm run tester-user first.`);
  const { data: profile } = await admin.from('profiles').select('is_tester').eq('id', user.id).maybeSingle();
  if (!profile?.is_tester) throw new Error(`${email} is not a test account. Refusing to wipe it.`);

  const count = async (table) => (await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', user.id)).count ?? 0;
  const before = { scans: await count('scans'), flags: await count('flags'), vendor_matches: await count('vendor_matches') };

  // invoices and flags go with their scans (on delete cascade)
  for (const table of ['scans', 'vendor_matches']) {
    const { error } = await admin.from(table).delete().eq('user_id', user.id);
    if (error) throw error;
  }
  const left = (await count('scans')) + (await count('invoices')) + (await count('flags')) + (await count('vendor_matches'));
  if (left) throw new Error('Some test data was left behind. Run it again.');
  console.log(`reset ${email}: removed ${before.scans} scans, ${before.flags} flagged pairs, ${before.vendor_matches} vendor matches`);
} catch (e) {
  console.error(e instanceof Error ? e.message : 'Failed.');
  process.exit(1);
}

import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import { usageSummary } from '@/lib/limits';
import { DeleteData, SignOut } from './SettingsButtons';

export const metadata: Metadata = { title: 'Settings' };

export default async function Settings() {
  const { supabase, user } = await requireUser();
  const [usage, { count: scans }] = await Promise.all([usageSummary(user!.id), supabase.from('scans').select('id', { count: 'exact', head: true })]);
  const l = usage.limits;
  return (
    <>
      <h1>Settings</h1>
      <section className="card flex flex-col gap-1 p-5">
        <h2 className="mb-2">Account</h2>
        <Row k="Signed in as" v={user!.email ?? ''} />
        <Row k="Scans stored" v={String(scans ?? 0)} />
        <Row k="Data retention" v="Scans are deleted automatically after 30 days" />
      </section>
      <section className="card flex flex-col gap-1 p-5">
        <h2 className="mb-2">Usage</h2>
        <Row k="Scans today" v={`${usage.scansToday} of ${l.scansDay}`} />
        <Row k="AI calls today" v={`${usage.aiToday} of ${l.aiDay}`} />
        <Row k="Scans this month" v={usage.isDemo ? 'No limit' : `${usage.scansMonth} of ${l.scansMonth}`} />
        <Row k="AI calls this month" v={usage.isDemo ? 'No limit' : `${usage.aiMonth} of ${l.aiMonth}`} />
        <p className="mt-2 text-[13px] text-ink-500">Daily limits reset at midnight IST, monthly limits on the 1st. Rule-based checks never use credits.</p>
      </section>
      <section className="card flex flex-col gap-3 p-5">
        <h2>Delete my data</h2>
        <p className="text-sm text-ink-700">Permanently deletes every scan, invoice, duplicate pair and decision in your account. This cannot be undone.</p>
        <DeleteData />
      </section>
      <SignOut />
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex flex-wrap justify-between gap-3 border-b border-line-soft py-2.5 text-sm last:border-0"><span className="text-ink-500">{k}</span><span className="font-medium">{v}</span></div>;
}

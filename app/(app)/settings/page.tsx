import type { Metadata } from 'next';
import { requireUser } from '@/lib/supabase/server';
import { usageSummary } from '@/lib/limits';
import { SignOut } from './SettingsButtons';
import DeleteAccount from './DeleteAccount';

export const metadata: Metadata = { title: 'Settings' };

export default async function Settings() {
  const { supabase, user } = await requireUser();
  const [usage, { count: scans }] = await Promise.all([usageSummary(user!.id), supabase.from('scans').select('id', { count: 'exact', head: true })]);
  const l = usage.limits;
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <h1>Settings</h1>
      <section className="card flex flex-col gap-1 p-5">
        <h2 className="mb-2">Account</h2>
        <Row k="Signed in as" v={user!.email ?? ''} />
        <Row k="Scans stored" v={String(scans ?? 0)} />
        <Row k="Data retention" v="Scans are deleted automatically after 30 days" />
        <div className="flex justify-end pt-3"><SignOut /></div>
      </section>
      <section className="card flex flex-col gap-1 p-5">
        <h2 className="mb-2">Usage</h2>
        <MeterRow k="Scans today" used={usage.scansToday} max={l.scansDay} />
        <MeterRow k="AI calls today" used={usage.aiToday} max={l.aiDay} />
        <Row k="Scans this month" v={usage.isDemo ? 'No limit' : `${usage.scansMonth} of ${l.scansMonth}`} />
        <Row k="AI calls this month" v={usage.isDemo ? 'No limit' : `${usage.aiMonth} of ${l.aiMonth}`} />
        <p className="mt-2 text-[13px] text-ink-500">Daily limits reset at midnight IST, monthly limits on the 1st. Rule-based checks never use credits.</p>
      </section>
      <section className="card flex flex-col gap-3 p-5">
        <h2>Delete my account</h2>
        <p className="text-sm text-ink-700">Permanently deletes your InvoiceGuard account and all your scans, invoices, duplicate pairs and decisions. This cannot be undone. If you sign in with Google again, a new empty account is created. Your daily usage limits are not reset.</p>
        <DeleteAccount />
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex flex-wrap justify-between gap-3 border-b border-line-soft py-2.5 text-sm last:border-0"><span className="text-ink-500">{k}</span><span className="font-medium">{v}</span></div>;
}

// Same bar as the sidebar's usage widget (thin, blue, amber from 80%), on a light track for the white card
function MeterRow({ k, used, max }: { k: string; used: number; max: number }) {
  const pct = Math.min(100, max ? Math.round((used / max) * 100) : 0);
  return (
    <div className="flex flex-col gap-2 border-b border-line-soft py-2.5 text-sm">
      <div className="flex flex-wrap justify-between gap-3"><span className="text-ink-500">{k}</span><span className="font-medium">{used} of {max}</span></div>
      <div role="progressbar" aria-label={`${k} used`} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} className="h-1.5 rounded bg-line">
        <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: pct >= 80 ? '#F5B83D' : '#1D4ED8' }} />
      </div>
    </div>
  );
}

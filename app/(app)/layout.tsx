import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { usageSummary } from '@/lib/limits';
import Sidebar from '@/components/Sidebar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  if (!user) redirect('/login');
  const [{ count }, usage] = await Promise.all([
    supabase.from('flags').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    usageSummary(user.id)
  ]);
  return (
    <div className="flex min-h-screen flex-wrap">
      <Sidebar pending={count ?? 0} usage={usage} email={user.email ?? ''} />
      <main className="min-w-0 flex-[999_1_560px] px-5 py-7 sm:px-10 sm:py-8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

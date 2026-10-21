import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { restoreUsage } from '@/lib/usage-retention';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // a re-created account inherits the usage counts kept from its deleted predecessor; never block sign-in on this
      const { id, email } = data.user;
      if (email) await restoreUsage(createAdminClient(), id, email).catch(() => undefined);
      return NextResponse.redirect(`${origin}/queue`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=google`);
}

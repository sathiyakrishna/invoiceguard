'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function deleteMyData() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  await supabase.from('scans').delete().eq('user_id', data.user.id); // cascades to invoices and flags
  await supabase.from('vendor_matches').delete().eq('user_id', data.user.id);
  revalidatePath('/', 'layout');
  redirect('/upload?deleted=1');
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}

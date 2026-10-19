'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signInWithPassword } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full min-h-14">
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function LoginForm({ googleError }: { googleError: boolean }) {
  const [state, action] = useFormState(signInWithPassword, undefined);
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
  }

  return (
    <div className="flex flex-col gap-5">
      {googleError && <p role="alert" className="rounded-lg bg-high-row px-3 py-2 text-sm text-high-fg">Google sign-in didn’t complete. Try again.</p>}
      <button type="button" onClick={google} disabled={busy} className="flex min-h-14 items-center justify-center gap-2.5 rounded-lg border border-line-input bg-white text-[15px] font-semibold text-ink hover:bg-ground disabled:opacity-60">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.6 7l7.4 5.8c4.3-4 6.9-9.9 6.9-17.3z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <div className="flex items-center gap-3 text-[13px] text-ink-500">
        <span className="h-px flex-1 bg-line" />or use a demo account<span className="h-px flex-1 bg-line" />
      </div>
      <form action={action} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">Email
          <input name="email" type="email" autoComplete="username" required className="input" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Password
          <input name="password" type="password" autoComplete="current-password" required className="input" />
        </label>
        {state?.error && <p role="alert" className="text-sm text-high-fg">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}

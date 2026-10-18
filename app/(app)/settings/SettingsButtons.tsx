'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteMyData, signOut } from './actions';

function Confirm() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex min-h-11 items-center rounded-lg bg-high-fg px-5 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Deleting…' : 'Yes, delete everything'}</button>;
}

export function DeleteData() {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" onClick={() => setAsk(true)} className="btn-secondary self-start border-high-fg text-high-fg">Delete my data</button>;
  return (
    <form action={deleteMyData} className="flex flex-wrap items-center gap-3">
      <Confirm />
      <button type="button" onClick={() => setAsk(false)} className="btn-secondary">Cancel</button>
    </form>
  );
}

export function SignOut() {
  return (
    <form action={signOut}>
      <button className="btn-secondary">Sign out</button>
    </form>
  );
}

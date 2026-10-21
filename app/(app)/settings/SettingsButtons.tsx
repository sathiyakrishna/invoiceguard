'use client';
import { signOut } from './actions';

export function SignOut() {
  return (
    <form action={signOut}>
      <button className="btn-secondary">Sign out</button>
    </form>
  );
}

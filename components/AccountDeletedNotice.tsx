'use client';
import { useSearchParams } from 'next/navigation';

/** Shown on the landing page after Settings > Delete my account; reads the flag client-side so the page stays static. */
export default function AccountDeletedNotice() {
  if (useSearchParams().get('account_deleted') !== '1') return null;
  return (
    <p role="status" className="mx-auto max-w-[1240px] rounded-xl bg-low-bg px-5 py-3 text-base font-semibold text-low-fg">
      Your account and all your data have been deleted. You’ve been signed out.
    </p>
  );
}

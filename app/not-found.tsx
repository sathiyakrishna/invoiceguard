import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-ink-500">This page doesn’t exist, or the pair belongs to a different account.</p>
      <Link href="/queue" className="btn-primary mt-2">Go to the risk queue</Link>
    </main>
  );
}

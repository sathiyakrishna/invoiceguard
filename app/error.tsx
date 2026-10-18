'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1>This page didn’t load</h1>
      <p className="text-ink-500">Something went wrong on our side. Your data is safe. Try again.</p>
      <button onClick={reset} className="btn-primary mt-2">Try again</button>
    </main>
  );
}

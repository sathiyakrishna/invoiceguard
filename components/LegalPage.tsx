import Link from 'next/link';
import { Logo } from './Logo';

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-navy"><div className="mx-auto max-w-3xl px-6 py-4"><Link href="/"><Logo /></Link></div></header>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-12 text-[15px] leading-relaxed text-ink-700 [&_h2]:mt-4">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}

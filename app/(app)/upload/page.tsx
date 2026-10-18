import type { Metadata } from 'next';
import UploadFlow from './UploadFlow';

export const metadata: Metadata = { title: 'Upload' };

export default function UploadPage() {
  return (
    <>
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Scan a payment run</h1>
        <p className="mt-1.5 text-[15px] text-ink-500">Upload the invoice register you’re about to pay. Duplicates are flagged before any money leaves.</p>
      </div>
      <UploadFlow />
      <p className="text-[13px] leading-relaxed text-ink-500">Prototype built for the HelloPM AI PM buildathon. Use anonymized data. Your files are private to your account and deleted after 30 days.</p>
    </>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'InvoiceGuard – Catch duplicate invoices before the payment run', template: '%s · InvoiceGuard' },
  description: 'Upload your payment-run register. InvoiceGuard flags the duplicate invoices SAP’s standard check misses, explains the evidence and lets you block them in minutes.',
  openGraph: {
    title: 'InvoiceGuard – Catch duplicate invoices before the payment run',
    description: 'Flags the duplicates SAP’s standard check misses: reference format changes, cross company code postings and alternate vendor accounts.',
    type: 'website'
  }
};

export const viewport: Viewport = { themeColor: '#14213D', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Barlow:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

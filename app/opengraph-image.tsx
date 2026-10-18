import { ImageResponse } from 'next/og';

export const alt = 'InvoiceGuard – Catch duplicate invoices before the payment run';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  const rows = [
    ['High', '#FDE2E1', '#B42318', 'INV-0012 · INV0012', '₹1,25,000.00'],
    ['Medium', '#FEF0C7', '#93370D', 'LT-40417 · LT-40471', '₹2,14,900.00'],
    ['Low', '#DCFAE6', '#067647', 'WI-7730 · WI-7737', '₹36,000.00']
  ];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0B1F4D', padding: 64, color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 600, justifyContent: 'space-between' }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#7DA2FF' }}>InvoiceGuard</div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.08 }}>Catch duplicate invoices before the payment run.</div>
          <div style={{ fontSize: 26, color: '#C9D2E3' }}>The duplicates SAP’s standard check misses, with evidence for every flag.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginLeft: 48, justifyContent: 'center', flex: 1 }}>
          {rows.map(([b, bg, fg, refs, amt]) => (
            <div key={refs} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#22325A', borderRadius: 14, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignSelf: 'flex-start', background: bg, color: fg, fontSize: 20, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>{b}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24 }}><span>{refs}</span><span>{amt}</span></div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}

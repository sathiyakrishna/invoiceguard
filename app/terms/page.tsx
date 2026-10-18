import LegalPage from '@/components/LegalPage';
export const metadata = { title: 'Terms' };
export default function Terms() {
  return (
    <LegalPage title="Terms">
      <p>InvoiceGuard is provided free, as is, during a beta built for the HelloPM AI Product Management buildathon.</p>
      <h2>Decision support only</h2>
      <p>InvoiceGuard flags possible duplicates and explains the evidence. It does not approve or block payments in any system. You remain responsible for every decision and for your organisation’s payment controls.</p>
      <h2>Your data</h2>
      <p>Only upload data you are allowed to share. Do not upload live confidential company files during the beta.</p>
      <h2>Limits</h2>
      <p>Daily and monthly limits apply to scans and AI explanations, and the service may change or stop during the beta.</p>
    </LegalPage>
  );
}

import LegalPage from '@/components/LegalPage';
export const metadata = { title: 'Privacy' };
export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <p>InvoiceGuard is a free beta built as a learning project for the HelloPM AI Product Management buildathon. This page explains what happens to your data.</p>
      <h2>What we store</h2>
      <p>Your email address (from Google sign-in), the invoice registers you upload, the duplicate pairs found and the decisions and comments you record. Each account is a private workspace; no other user can see your data.</p>
      <h2>How long we keep it</h2>
      <p>Scans and everything derived from them are deleted automatically after 30 days. You can delete your account and all of your data at any time from Settings.</p>
      <p>When you delete your account, we keep only your scan and AI-call counts for the rest of that month, linked to a one-way hash of your email address rather than the address itself. This stops deleting and re-registering from resetting the usage limits. The counts are removed at the end of the month.</p>
      <h2>AI processing</h2>
      <p>Only the fields of flagged pairs (vendor, invoice number, date, amount, company code, PO and document number) and similar vendor names are sent to OpenAI to generate explanations and vendor matches. Full registers are never sent.</p>
      <h2>Please use anonymized data</h2>
      <p>During the beta, do not upload live company files. Use the sample register or an anonymized export.</p>
      <h2>Contact</h2>
      <p>Questions or deletion requests: sathiyakrishnapo@gmail.com.</p>
    </LegalPage>
  );
}

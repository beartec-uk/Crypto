// Copyright (c) 2026 BEARTEC LTD. All rights reserved.
import { Shield } from 'lucide-react';
import { LegalPageLayout, Section, LegalTable, TBC, CONTACT_EMAIL, COMPANY_DETAILS } from '@/components/legal/LegalPageLayout';
import { Seo } from '@/components/marketing/Seo';

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#00c4b4] hover:underline">{CONTACT_EMAIL}</a>;

export default function CryptoPrivacy() {
  return (
    <>
    <Seo
      title="Privacy Policy — BearTec"
      description="How BearTec collects, uses and shares personal data. BEARTEC LTD is the controller."
    />
    <LegalPageLayout title="Privacy Policy" icon={<Shield className="w-8 h-8 text-[#00c4b4]" />} lastUpdated="4 November 2026">
      <Section title="1. Who we are">
        <p>BearTec Crypto is run by {COMPANY_DETAILS} ("BEARTEC", "we", "us"). We are the controller of the personal data described in this policy. Contact: {mail}. ICO registration number: <TBC>ICO registration number</TBC>. We have not appointed a data protection officer because the law does not require one for our activities; Scott Reynolds, director, is responsible for data protection.</p>
      </Section>

      <Section title="2. The data we collect">
        <LegalTable
          head={['Category', 'What it includes', 'Where it comes from']}
          rows={[
            ['Account', 'Email address; name and profile picture if you sign in with Google or another provider; account ID', 'You, and our sign-in provider Clerk'],
            ['Subscription and billing', 'Plan (Free, Core, Pro, Elite), subscription status and dates, Stripe customer ID, payment receipts. We do not see or store your full card number; Stripe handles payment details.', 'You and Stripe'],
            ['Product use', 'Tickers and timeframes you view or nominate, watchlists, drawings and saved settings, AI requests and AI token use, alert settings', 'You'],
            ['Notifications', 'Browser push subscription details; your mobile number if you turn on SMS alerts', 'You'],
            ['Communications', 'Messages you send us, feedback board posts and contact form details', 'You'],
            ['Technical', 'IP address, device and browser type, pages requested, timestamps, error logs', 'Your device, our hosting provider'],
          ]}
        />
        <p>We do not ask for special category data and we do not ask for details of your finances, holdings or trades.</p>
      </Section>

      <Section title="3. Why we use it and our lawful basis">
        <LegalTable
          head={['Purpose', 'Lawful basis (UK GDPR article 6)']}
          rows={[
            ['Create and run your account; provide charts, indicators, AI analysis and alerts you ask for', 'Contract'],
            ['Take payments and manage subscriptions; keep tax and accounting records', 'Contract; legal obligation'],
            ['Send service messages (receipts, renewal reminders, security notices, changes to terms)', 'Contract; legal obligation (for example subscription reminders required by law)'],
            ['Send SMS or push alerts', 'Consent (you turn them on and can turn them off at any time)'],
            ['Keep the service secure, prevent abuse of AI tokens, fix errors', 'Legitimate interests (running a safe and reliable service)'],
            ['Improve the product using aggregated usage figures (for example sign-ups, plan mix, AI cost per user)', 'Legitimate interests'],
            ['Marketing emails (only if we start sending them)', 'Consent, or soft opt-in for existing customers with an easy opt-out'],
            ['Deal with complaints and legal claims', 'Legitimate interests; legal obligation'],
          ]}
        />
      </Section>

      <Section title="4. AI analysis">
        <p>When you ask for an AI reading, we send the ticker, timeframe and market data needed for that reading to xAI's API, which generates the text. We do not need to send your name or email for this. The AI is an automated software tool, not a person or an adviser. We do not use it to make decisions about you that have legal or similarly significant effects.</p>
      </Section>

      <Section title="5. Who we share data with">
        <p>We do not sell your personal data. We use these service providers (processors), which act on our instructions:</p>
        <LegalTable
          head={['Provider', 'Purpose', 'Location']}
          rows={[
            ['Clerk', 'Sign-in and account security', 'USA'],
            ['Stripe', 'Payments and subscription billing. Stripe is also an independent controller for some data (for example fraud prevention)', 'UK/EU and USA'],
            ['Vercel', 'Website hosting, serverless functions and scheduled jobs', 'USA and global edge network'],
            ['Neon', 'Database hosting', <TBC key="neon">region</TBC>],
            ['xAI', 'AI analysis', 'USA'],
            ['Twilio', 'SMS alerts (only if you turn them on)', 'USA'],
            ['Browser push services (for example Google, Mozilla, Apple)', 'Delivering push notifications to your browser', 'Various'],
          ]}
        />
        <p>We may also share data with professional advisers, or where the law requires it (for example HMRC, the police or a court order). If BEARTEC is sold or reorganised, data may pass to the new owner under this policy.</p>
      </Section>

      <Section title="6. International transfers">
        <p>Some providers process data outside the UK, mainly in the USA. Where they do, we rely on UK adequacy regulations (including the UK extension to the EU-US Data Privacy Framework where the provider is certified) or on the ICO's International Data Transfer Agreement or UK Addendum to the EU standard contractual clauses. You can ask us for details.</p>
      </Section>

      <Section title="7. How long we keep it">
        <LegalTable
          head={['Data', 'Retention']}
          rows={[
            ['Account and product data', 'While your account is open. Deleted or anonymised within 30 days after you close it'],
            ['Billing and transaction records', '6 years after the end of the financial year they relate to (tax and accounting law)'],
            ['Server and error logs', <TBC key="logs">retention period</TBC>],
            ['AI request and output logs', <TBC key="ai">retention period</TBC>],
            ['Complaints and correspondence', 'Up to 6 years after the matter closes'],
          ]}
        />
      </Section>

      <Section title="8. Your rights">
        <p>You have the right to access your data, correct it, have it erased, restrict or object to its use (including to direct marketing at any time), and receive it in a portable format. Where we rely on consent, you can withdraw it at any time. To use these rights, email {mail}; we will reply within one month. You can also complain to the Information Commissioner's Office (<a href="https://ico.org.uk" className="text-[#00c4b4] hover:underline" target="_blank" rel="noopener noreferrer">ico.org.uk</a>, 0303 123 1113), but please contact us first so we can try to help.</p>
      </Section>

      <Section title="9. Cookies and similar technologies">
        <p>We use only storage that is strictly necessary to provide the service: sign-in session cookies set by Clerk, a cookie that remembers whether the sidebar is open, and browser local storage for your chart settings. These do not need consent. We do not use advertising or analytics cookies. If we add any, we will ask for your consent first.</p>
      </Section>

      <Section title="10. Security">
        <p>We use encrypted connections (HTTPS), managed sign-in with session checks on every request, access controls and least-privilege keys for our providers. No system is completely secure. If a breach is likely to put you at high risk, we will tell you without undue delay and report it to the ICO where required.</p>
      </Section>

      <Section title="11. Children">
        <p>BearTec Crypto is for adults aged 18 and over. We do not knowingly collect data from children.</p>
      </Section>

      <Section title="12. Changes">
        <p>We will post any changes here with a new date, and tell you by email or in the app if a change is significant.</p>
      </Section>
    </LegalPageLayout>
    </>
  );
}

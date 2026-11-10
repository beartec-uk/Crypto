// Copyright (c) 2026 BEARTEC LTD. All rights reserved.
import { FileText } from 'lucide-react';
import { Link } from 'wouter';
import { LegalPageLayout, Section, LegalTable, CONTACT_EMAIL, COMPANY_DETAILS } from '@/components/legal/LegalPageLayout';

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#00c4b4] hover:underline">{CONTACT_EMAIL}</a>;

export default function CryptoTerms() {
  return (
    <LegalPageLayout title="Terms of Service" icon={<FileText className="w-8 h-8 text-[#00c4b4]" />} lastUpdated="4 November 2026">
      <Section title="1. About these terms">
        <p>These terms are a contract between you and {COMPANY_DETAILS} ("BEARTEC", "we", "us"). They apply when you use BearTec Crypto at www.beartec.uk. Please read them, together with our <Link href="/privacy" className="text-[#00c4b4] hover:underline">Privacy Policy</Link>. Contact: {mail}.</p>
      </Section>

      <Section title="2. Important: information, not advice">
        <p className="text-yellow-400 font-semibold">BearTec Crypto gives you charts, technical indicators and general, automated analysis for information and education only. It is not financial, investment, tax or legal advice, and it is not a recommendation to buy, sell or hold any cryptoasset. We do not take your personal circumstances into account. BEARTEC is not authorised or regulated by the Financial Conduct Authority. We do not hold your money or cryptoassets, and we do not place trades for you.</p>
        <p className="text-yellow-400 font-semibold">Cryptoassets are high risk and you could lose all the money you put in. Most cryptoassets are not protected by the Financial Services Compensation Scheme or the Financial Ombudsman Service. Any decision to trade is yours alone.</p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>AI analysis is software.</strong> AI readings are generated automatically by a third-party AI model (currently xAI). They are not written by a person, can be wrong or out of date, and describe possible chart scenarios only. Do not rely on them as the only basis for a decision.</li>
          <li><strong>Data.</strong> Market data comes from third-party sources and may be delayed, incomplete or wrong.</li>
        </ul>
      </Section>

      <Section title="3. Who can use BearTec Crypto">
        <p>You must be 18 or over and able to make a binding contract. The service is run from the United Kingdom and is open to users in other countries too. You are responsible for making sure you are allowed to use it where you live. You must give accurate details, keep your sign-in (provided through our sign-in provider Clerk) secure and not share your account.</p>
      </Section>

      <Section title="4. Plans and prices">
        <LegalTable
          head={['Plan', 'Price', 'AI tokens a month', 'Nominated AI tickers', 'Includes']}
          rows={[
            ['Free', '£0', '0', '0', 'Charts, indicators, drawings and Elliott Wave tools'],
            ['Core', '£15 a month', '80', '1', 'Free features plus AI analysis'],
            ['Pro', '£30 a month', '160', '3', 'Core plus push alerts'],
            ['Elite', '£50 a month', '270', '5', 'Pro plus a larger Elliott AI allowance'],
          ]}
        />
        <ul className="list-disc list-inside space-y-2">
          <li>One general reading or one deep dive uses 1 AI token. Tokens reset each billing month and do not roll over. They have no cash value and cannot be transferred.</li>
          <li>Prices are in pounds sterling. BEARTEC is not registered for VAT, so no VAT is charged. If we register for VAT, we will tell you before any change to what you pay.</li>
          <li>We will show the plan, the price, the billing frequency and how to cancel before you pay.</li>
        </ul>
      </Section>

      <Section title="5. Billing and renewal">
        <ul className="list-disc list-inside space-y-2">
          <li>Paid plans are billed monthly in advance through Stripe and renew automatically until you cancel.</li>
          <li>We will email you a reminder 7 days before each renewal.</li>
          <li>We may change prices with at least 30 days' notice. If you do not want the new price, you can cancel before it applies.</li>
          <li>If a payment fails, we will tell you and may pause paid features until it is paid.</li>
        </ul>
      </Section>

      <Section title="6. Cancelling">
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Any time.</strong> You can cancel in your account through the Stripe billing portal, or by emailing {mail}. Your paid features continue until the end of the period you have paid for, and you will not be charged again.</li>
          <li><strong>14-day right to cancel.</strong> If you are a consumer, you can cancel a new paid plan within 14 days of buying it for any reason. If you asked us to start the service straight away, and you cancel within the 14 days, we will refund what you paid less a proportionate amount for the service already provided (for example the AI tokens used). We will refund within 14 days of your cancellation, to the original payment method.</li>
          <li><strong>From 1 January 2027.</strong> Subscriptions you start or renew on or after that date will also get the cooling-off and cancellation rights in the Digital Markets, Competition and Consumers Act 2024. We will update these terms to match.</li>
        </ul>
      </Section>

      <Section title="7. If something goes wrong">
        <p>We will provide the service with reasonable care and skill. If we do not, tell us and we will try to fix it. If we cannot, you may be entitled to a price reduction or refund under the Consumer Rights Act 2015. Nothing in these terms affects your legal rights. Advice about your legal rights is available from Citizens Advice.</p>
      </Section>

      <Section title="8. Fair use">
        <p>You must not: break the law; use the service for market manipulation or fraud; scrape, copy, resell or redistribute our analysis, alerts or data; reverse engineer or overload the service; get around AI token limits or use several accounts to do so; or upload harmful code.</p>
      </Section>

      <Section title="9. Our content and yours">
        <p>The software, design, analysis and content belong to BEARTEC or its licensors (charts use TradingView lightweight-charts under its licence). We give you a personal, non-transferable right to use them for your own information while you have an account. If you post feedback, you keep ownership, but you let us use it to run and improve the service.</p>
      </Section>

      <Section title="10. Changes and availability">
        <p>We may update the service, for example to add or remove indicators or change AI models. If we make a change that materially reduces a paid plan, we will give you notice and you may cancel and get a refund for any unused prepaid period. We aim for the service to be available, but it may sometimes be interrupted for maintenance or because of third-party outages.</p>
      </Section>

      <Section title="11. Our responsibility for loss">
        <ul className="list-disc list-inside space-y-2">
          <li>If we break these terms, we are responsible for loss or damage you suffer that is a foreseeable result of our breach or our failure to use reasonable care and skill.</li>
          <li>Because BearTec Crypto provides information only and trading decisions are yours, we are not responsible for trading or investment losses, or for loss of profit, except where the law does not allow us to exclude this.</li>
          <li>We are not responsible for business losses. The service is for personal use.</li>
          <li>Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot be limited by law.</li>
        </ul>
      </Section>

      <Section title="12. Suspending or ending your account">
        <p>We may suspend or close your account if you seriously or repeatedly break these terms, if we must do so by law, or if we stop providing BearTec Crypto. We will give you reasonable notice where we can. If we close your account other than for your breach, we will refund any fees you paid in advance for the period you will not receive. You can close your account at any time by emailing us.</p>
      </Section>

      <Section title="13. Complaints">
        <p>Email {mail} with "Complaint" in the subject. We will acknowledge it within 5 working days and aim to reply in full within 14 days.</p>
      </Section>

      <Section title="14. Law and courts">
        <p>These terms are governed by the law of England and Wales. You can bring claims in the courts of England and Wales; if you live in Scotland or Northern Ireland, you can also bring claims in your local courts.</p>
      </Section>

      <Section title="15. Other">
        <p>If a court finds part of these terms invalid, the rest still applies. We may transfer this contract to another business that takes over BearTec Crypto; we will tell you, and your rights will not be reduced. Nobody else has rights under these terms.</p>
      </Section>
    </LegalPageLayout>
  );
}

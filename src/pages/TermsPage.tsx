import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';

interface TermsPageProps {
  onNavigate: (path: string) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle="The official rules, participation terms, ranking mechanics, and legal conditions governing your use of LAZY."
      lastUpdated="September 10, 2026"
      currentPath="/terms"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          1. Introduction & Overview of the Service
        </h2>
        <p>
          Welcome to <strong>LAZY</strong> (the "Platform" or "Game"), operated by and associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME] ("we", "us", or "our").
        </p>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-zinc-900 text-xs sm:text-sm font-medium leading-relaxed">
          <strong>Service Description:</strong> LAZY is an entertainment-based public pay-to-rank experience. A participant selects an amount and, after the payment is successfully verified, that verified amount determines their position on the LAZY leaderboard under the published rules.
        </div>
        <p>
          By accessing the website, initiating a claim, submitting profile information, or completing an order on LAZY, you agree to be bound by these Terms & Conditions ("Terms") and our <button type="button" onClick={() => onNavigate('/refund-cancellation')} className="text-amber-800 font-bold hover:underline cursor-pointer">Refund & Cancellation Policy</button> and <button type="button" onClick={() => onNavigate('/privacy')} className="text-amber-800 font-bold hover:underline cursor-pointer">Privacy Policy</button>. If you do not agree to these Terms, please do not use the Platform or submit any payments.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          2. Eligibility
        </h2>
        <p>
          To participate in LAZY, submit a rank claim, or complete a payment, you represent and warrant that:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>You are at least 18 years of age (or the age of legal majority in your jurisdiction of residence) and possess full legal capacity to enter into binding agreements.</li>
          <li>You are using your own legitimate payment methods (such as your own UPI ID, debit/credit card, or net-banking credentials) or have express lawful authorization from the account holder.</li>
          <li>Your participation does not violate any applicable local, state, national, or international law, regulation, or sanction.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          3. Ranking Mechanics, Ties & Displacement
        </h2>
        <p>
          The core mechanic of LAZY is transparent, deterministic, and enforced entirely server-side:
        </p>
        <div className="space-y-2.5 text-xs sm:text-sm text-zinc-700">
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 1: Higher Verified Amount = Higher Rank</strong>
            Your ranking on the public leaderboard is determined solely by the total verified amount paid in Indian Rupees (INR). A higher verified amount results in a higher rank.
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 2: Tie-Breaking by Earlier Verified Timestamp</strong>
            If two or more participants have the exact same verified payment amount, the participant whose payment was verified earlier by the server takes priority.
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 3: Live Displacement Dynamic</strong>
            The leaderboard is dynamic and competitive. If another participant completes a verified payment of a higher amount than yours, your entry will be displaced to a lower rank (e.g., from #1 to #2, or from #5 to #6). Rank displacement is a core characteristic of the game.
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 4: Projected Ranks are Non-Binding Estimates</strong>
            Any estimated or projected rank shown in the checkout interface prior to payment completion is an indicator based on existing leaderboard state. Because transactions are processed in real time, your final verified rank is assigned atomically at the instant our server verifies payment confirmation from the payment gateway.
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 5: Server-Side Authority Only</strong>
            Client-side code, browser local storage, or network query parameters have zero authority over ranking. Only transactions verified by our backend server against recognized payment aggregator webhooks count toward official ranks.
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          4. Payments & Pricing
        </h2>
        <p>
          All amounts displayed and processed on LAZY are denominated in Indian Rupees (INR). Payments are processed through secure, RBI-licensed payment aggregators (including Cashfree Payments).
        </p>
        <p>
          By clicking to pay, you authorize the payment aggregator to charge the designated amount to your chosen payment method. You agree that:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>You are paying for participation and placement in a public digital leaderboard and for access to downloadable digital share cards.</li>
          <li>Payments do not constitute an investment, financial asset, cryptocurrency, lottery ticket, or gambling wager. No financial dividends, interest, cash prizes, or commercial returns are offered or implied.</li>
          <li>Upon server verification, the digital delivery is instant and complete. For full cancellation and refund terms, please consult our <button type="button" onClick={() => onNavigate('/refund-cancellation')} className="text-amber-800 font-bold hover:underline cursor-pointer">Refund & Cancellation Policy</button>.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          5. User-Submitted Information & Public Visibility
        </h2>
        <p>
          When claiming a rank, participants may choose to provide a public display name, an optional humorous quote or statement of laziness, and optional public links (such as an Instagram handle or personal website).
        </p>
        <p>
          You acknowledge and agree that:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>This information will be displayed publicly on the LAZY leaderboard, public rank cards, and shareable 9:16 story assets.</li>
          <li>You are solely responsible for the content, accuracy, and legality of the information you submit.</li>
          <li>You warrant that submitted text, handles, or URLs do not infringe upon any third party's intellectual property, privacy, publicity, or trademark rights.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          6. Prohibited Conduct & Community Decency
        </h2>
        <p>
          Users must not engage in any of the following prohibited activities:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>Fraudulent Payments:</strong> Using stolen cards, compromised UPI credentials, or chargeback extortion.</li>
          <li><strong>Harmful Content:</strong> Submitting hate speech, violent threats, racial or religious slurs, defamation, sexually explicit content, or harassment in names, reasons, or links.</li>
          <li><strong>Malicious Links:</strong> Linking to phishing pages, malware, unauthorized gambling, scams, or illegal material.</li>
          <li><strong>Impersonation:</strong> Falsely claiming to represent another real individual, public figure, or company without authorization.</li>
          <li><strong>Technical Abuse:</strong> Exploiting APIs, launching denial-of-service attacks, spamming automated requests, or attempting to manipulate server-side verification logic.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          7. Moderation, Removal & Forfeiture
        </h2>
        <p>
          We take platform integrity seriously. We reserve the absolute right, in our sole discretion and without prior notice, to:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>Sanitize, edit, hide, or delete any display name, reason, or link that violates these Terms or our community decency standards.</li>
          <li>Forfeit or remove any leaderboard entry associated with fraudulent payments, unauthorized chargebacks, or abusive behavior.</li>
          <li>Report fraudulent transactions and malicious attacks to relevant law enforcement and payment processing partners.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          8. Intellectual Property Rights
        </h2>
        <p>
          All rights, title, and interest in and to the LAZY website, brand, logos, graphic design, canvas story-card generator, and underlying software code belong exclusively to the operator. You are granted a personal, non-exclusive, revocable license to display and share your personal rank card on social media platforms for lawful personal use.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          9. Service Availability & Disclaimers
        </h2>
        <p>
          The Platform is provided on an <em>"as is"</em> and <em>"as available"</em> basis. We make no warranty that the service will be completely uninterrupted, timely, error-free, or compatible with all devices or browsers. We reserve the right to modify, maintain, update, or discontinue the service at any time.
        </p>
        <p>
          To the maximum extent permitted by applicable law, neither LAZY, XAIVON, nor its contributors shall be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your participation.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          10. Governing Law & Dispute Resolution
        </h2>
        <p>
          These Terms and any dispute arising from or related to the Platform shall be governed by and construed in accordance with the laws of India. Any legal action or proceeding shall be subject to the exclusive jurisdiction of the courts of competent jurisdiction in India.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          11. Contact Information
        </h2>
        <p>
          For any questions, legal notices, or inquiries regarding these Terms & Conditions, please contact us at:
        </p>
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs sm:text-sm">
          <div><strong>Support & Compliance Email:</strong> <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a></div>
          <div className="mt-1"><strong>Operating Entity:</strong> Associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME]</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

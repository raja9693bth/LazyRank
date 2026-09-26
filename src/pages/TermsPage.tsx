import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_CONFIG } from '../config/legal';

interface TermsPageProps {
  onNavigate: (path: string) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle={`The official service terms, ranking mechanics, user standards, and legal conditions governing your use of ${LEGAL_CONFIG.PRODUCT_NAME}.`}
      lastUpdated="September 24, 2026"
      currentPath="/terms"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          1. Introduction & Operating Entity
        </h2>
        <p>
          Welcome to <strong>{LEGAL_CONFIG.BRAND_NAME}</strong> (also referred to as "{LEGAL_CONFIG.PRODUCT_NAME}" or the "Platform"), available at{' '}
          <a href={LEGAL_CONFIG.APP_URL} className="text-amber-800 font-bold hover:underline">
            {LEGAL_CONFIG.APP_URL}
          </a>.
        </p>
        <p>
          {LEGAL_CONFIG.OPERATING_STATEMENT} Throughout these Terms & Conditions ("Terms"), the words "we", "us", "our", and "Operator" refer to {LEGAL_CONFIG.LEGAL_BUSINESS_NAME}. The words "you", "user", and "participant" refer to any individual who accesses the website, registers a profile, or purchases digital sponsored profile placement.
        </p>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-300 text-zinc-900 text-xs sm:text-sm font-medium leading-relaxed">
          <strong>Service Description:</strong> {LEGAL_CONFIG.BRAND_NAME} is a <em>Digital Sponsored Profile Showcase and Public Leaderboard</em>. Users purchase digital visibility and optional public link placement. Leaderboard position is determined deterministically by cumulative verified sponsorship amount.
        </div>
        <p>
          By accessing the platform, creating an order, or completing a payment, you agree to be legally bound by these Terms, our{' '}
          <button type="button" onClick={() => onNavigate('/privacy')} className="text-amber-800 font-bold hover:underline cursor-pointer">
            Privacy Policy
          </button>, our{' '}
          <button type="button" onClick={() => onNavigate('/refund-cancellation')} className="text-amber-800 font-bold hover:underline cursor-pointer">
            Refund & Cancellation Policy
          </button>, and our{' '}
          <button type="button" onClick={() => onNavigate('/delivery')} className="text-amber-800 font-bold hover:underline cursor-pointer">
            Delivery Policy
          </button>. If you do not agree to all of these Terms, you must not use the service or submit any payments.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          2. Consumer Protection & Non-Gambling Disclaimers
        </h2>
        <p>
          To ensure absolute legal clarity and compliance with consumer protection and financial laws:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>No Gambling, Betting, or Chance:</strong> {LEGAL_CONFIG.BRAND_NAME} is strictly NOT a game of chance, lottery, sweepstakes, raffle, or gambling platform. Ranking is an entirely open, deterministic mathematical function of cumulative verified sponsorship amount.</li>
          <li><strong>No Cash Prizes or Monetary Winnings:</strong> There are no cash rewards, prize payouts, dividends, financial yields, or redeemable monetary returns of any kind.</li>
          <li><strong>No Investment Asset:</strong> Payments do not represent equity, shares, deposits, securities, or financial instruments.</li>
          <li><strong>Consideration for Digital Placement:</strong> Paid amounts represent non-refundable consideration for digital profile visibility, display space, and generated digital assets on our web showcase.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          3. Exact Ranking Mechanics, Ties & Displacement
        </h2>
        <p>
          The ranking engine operates strictly under the following transparent rules:
        </p>
        <div className="space-y-2.5 text-xs sm:text-sm text-zinc-700">
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 1: Cumulative Verified Sponsorship Amount</strong>
            Leaderboard rank is determined solely by the cumulative verified amount (in INR) paid toward a specific profile. Higher cumulative verified sponsorship results in a higher rank (e.g. #1 Rank has the highest verified total).
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 2: Deterministic Tie-Breaking</strong>
            In the event that two or more profiles have the exact same cumulative verified amount in INR, ties are resolved deterministically: first by earlier FIRST verified payment timestamp (first_verified_at), and subsequently by stable unique profile ID.
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 3: Live Rank Displacement Dynamic</strong>
            Ranks are dynamic and subject to displacement. Another participant can at any time contribute a higher verified sponsorship amount and displace your rank to a lower position (e.g., from #1 to #2).
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 4: No Guaranteed Permanent Duration</strong>
            Payment grants immediate digital placement based on your cumulative verified amount, but does NOT guarantee a permanent position or specific duration at any rank number. Your rank will fluctuate as others contribute.
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 5: Profile Upgrade & Cumulative Additions</strong>
            Existing profile owners can securely upgrade their profile by sponsoring additional amounts. All verified payments linked to the verified owner credential are added cumulatively to that profile's total.
          </div>
          <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">Rule 6: Server-Authoritative Verification Only</strong>
            Client-side scripts, local storage, or browser modifications possess zero authority over rank. Only transactions verified authoritatively by our backend through payment gateway webhooks or direct provider status verification are credited.
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          4. Eligibility & Capacity
        </h2>
        <p>
          By creating a profile or initiating payment, you represent and warrant that:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>You are at least 18 years of age (or the legal age of majority in your jurisdiction) and possess full legal capacity to enter into binding commercial contracts.</li>
          <li>You are using your own legitimate payment instruments (such as your own UPI ID, debit/credit card, or net-banking account) or have express lawful authorization from the account holder.</li>
          <li>Your use of the Platform complies with all applicable local, national, and international laws and regulations.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          5. User Content, Profile Links & Moderation Standards
        </h2>
        <p>
          Participants may provide a public display name, personal statement/reason, and optional public links (Instagram handle, LinkedIn profile URL, personal website). You agree that:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>All submitted text, handles, and URLs will be publicly viewable on our website and generated social share cards.</li>
          <li>You are solely responsible for all content submitted under your profile.</li>
          <li><strong>Prohibited Content:</strong> You must not submit vulgarity, hate speech, defamation, harassment, sexually explicit content, religious/racial slurs, phishing links, illegal material, or unauthorized promotional spam.</li>
          <li><strong>Moderation Rights:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} reserves the absolute right to redact, sanitize, or delete content that violates community standards, or hide non-compliant profiles without refund.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          6. Effect of Refunds, Reversals & Chargebacks on Rank
        </h2>
        <p>
          To protect leaderboard integrity and prevent fraudulent exploitation:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>Verified Reversal & Ledger Adjustment:</strong> When a payment refund or chargeback is authoritatively verified and confirmed by our payment gateway, the settled refund amount is debited from the profile's cumulative verified ledger. Leaderboard ranks are then dynamically recalculated based on actual verified totals.</li>
          <li><strong>Dispute Review Process:</strong> Bank disputes undergo documented merchant review against gateway telemetry and proof of digital fulfillment. Confirmed settled chargebacks adjust the ledger accordingly; unverified or pending inquiries do not trigger premature profile debit or removal.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          7. Limitation of Liability
        </h2>
        <p>
          To the maximum extent permitted by applicable Indian law:
        </p>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          The service is provided on an "as is" and "as available" basis. {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} disclaims all warranties, express or implied, including merchantability or fitness for a particular purpose. In no event shall {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} or its proprietor be liable for indirect, incidental, consequential, or punitive damages, or rank displacements resulting from third-party sponsorships. Our total liability for any claim arising out of your use of the service shall not exceed the actual amount paid by you for the specific transaction in dispute.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          8. Governing Law & Jurisdiction
        </h2>
        <p>
          These Terms and your use of the Platform shall be governed by, interpreted, and construed in accordance with the substantive laws of India. Any legal disputes, claims, or proceedings arising out of or related to these Terms or the Platform shall be subject to the exclusive jurisdiction of the competent courts in West Champaran, Bihar, India.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          9. Contact & Support Information
        </h2>
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm space-y-1">
          <div><strong>Operating Enterprise:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} ({LEGAL_CONFIG.ENTITY_TYPE})</div>
          <div><strong>Proprietor:</strong> {LEGAL_CONFIG.PROPRIETOR_NAME}</div>
          <div><strong>Product:</strong> {LEGAL_CONFIG.PRODUCT_NAME}</div>
          <div><strong>Address:</strong> {LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}</div>
          <div><strong>Support Email:</strong> <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a></div>
          <div><strong>Support Phone:</strong> <a href={LEGAL_CONFIG.SUPPORT_PHONE_HREF} className="hover:underline">{LEGAL_CONFIG.SUPPORT_PHONE}</a></div>
          <div><strong>Hours:</strong> {LEGAL_CONFIG.BUSINESS_HOURS}</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

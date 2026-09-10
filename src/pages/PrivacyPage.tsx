import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';

interface PrivacyPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How we collect, handle, store, and protect the information you provide while participating in LAZY."
      lastUpdated="September 10, 2026"
      currentPath="/privacy"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          1. Overview & Commitment
        </h2>
        <p>
          This Privacy Policy explains the data handling practices of <strong>LAZY</strong> ("Platform"), associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME] ("we", "us", or "our").
        </p>
        <p>
          We respect user privacy and adhere to data protection principles recognized under applicable Indian legislation, including the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023 (DPDP Act).
        </p>
        <p>
          This document describes strictly what data is collected, why it is needed, how it is secured, and how you can exercise your rights.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          2. Information We Actually Collect
        </h2>
        <p>
          We only collect data necessary to provide leaderboard rankings, process legitimate payments, verify profile ownership, prevent platform abuse, and respond to support requests. Specifically:
        </p>

        <div className="space-y-3 text-xs sm:text-sm">
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">A. Public Profile Information (Provided by you voluntarily)</strong>
            <ul className="list-disc list-inside space-y-1 text-zinc-700">
              <li><strong>Display Name:</strong> The name or moniker you choose to represent your entry on the public leaderboard.</li>
              <li><strong>Reason / Statement:</strong> An optional short quote or justification of your laziness.</li>
              <li><strong>Social & Website Links:</strong> An optional Instagram handle or website URL you provide for your public profile.</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">B. Payment & Verification Data</strong>
            <ul className="list-disc list-inside space-y-1 text-zinc-700">
              <li><strong>Email Address:</strong> Collected during checkout to deliver payment confirmations, order status, and customer support.</li>
              <li><strong>Transaction Identifiers:</strong> Internal order ID, payment aggregator reference ID, payment timestamp, verified amount in INR, and verification status.</li>
              <li><strong>Card & Banking Details (NOT stored by us):</strong> We <em>do not</em> collect, process, or store raw credit/debit card numbers, CVVs, net-banking passwords, or UPI PINs. All financial credential processing occurs directly on PCI-DSS certified, RBI-licensed payment aggregator infrastructure (such as Cashfree Payments).</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">C. Technical & Security Logs</strong>
            <ul className="list-disc list-inside space-y-1 text-zinc-700">
              <li><strong>IP Address & Request Headers:</strong> Collected in server access logs strictly to enforce rate limiting, prevent denial-of-service (DDoS) attacks, detect bot floods, and protect platform stability.</li>
              <li><strong>Browser Client Info:</strong> User-agent strings used for responsive rendering and debugging.</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">D. Client Storage (Local Storage & Session State)</strong>
            <ul className="list-disc list-inside space-y-1 text-zinc-700">
              <li><strong>Profile Ownership Tokens (`lazy_tokens`):</strong> Stored locally in your browser to verify that you are the rightful creator of your profile if you decide to upgrade your rank later, preventing unauthorized edits by other users.</li>
              <li><strong>Session Identifier (`lazy_session_id`):</strong> A pseudonymous identifier in `sessionStorage` used strictly to calculate aggregate, real-time live visitor statistics without tracking across sessions.</li>
              <li><strong>No Advertising Cookies:</strong> We do not use third-party marketing trackers, behavioral ad pixels, or cross-site tracking cookies.</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-1">E. Support Communications</strong>
            <p className="text-zinc-700">
              If you email us at <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a> or use the on-site contact form, we collect your name, email, order reference, and the content of your message to resolve your inquiry.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          3. How We Use Your Information
        </h2>
        <p>
          We use collected information solely for the following legitimate purposes:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>To calculate, order, and display your verified rank on the public LAZY leaderboard.</li>
          <li>To generate your personalized, downloadable 9:16 social story cards and verified badges.</li>
          <li>To reconcile transactions with our payment aggregator and provide proof of verified ranking.</li>
          <li>To facilitate profile upgrades and verify profile ownership using client-stored cryptographic tokens.</li>
          <li>To safeguard the Platform against cyberattacks, spam, rate-limit violations, and fraudulent payment activities.</li>
          <li>To respond promptly to customer service requests, refund evaluations, and content moderation reports.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          4. Sharing & Disclosure of Information
        </h2>
        <p>
          We respect user privacy and do not sell, rent, or trade your personal information. We disclose data only in the following limited circumstances:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>Payment Gateway Partners:</strong> Order details (order ID, amount, email) are communicated via encrypted TLS protocols to our payment aggregator (such as Cashfree Payments) to facilitate checkout and receive webhook verification confirmations.</li>
          <li><strong>Public Leaderboard Display:</strong> Your submitted display name, reason, social/website handle, verified payment amount, and derived rank are publicly visible to anyone visiting the website.</li>
          <li><strong>Legal & Regulatory Compliance:</strong> We may disclose information if strictly required to comply with an applicable law, judicial proceeding, court order, or lawful request from government authorities in India.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          5. Data Security & Storage
        </h2>
        <p>
          We implement technical and organizational security measures to protect your data, including:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>End-to-end encryption in transit via HTTPS/TLS protocols.</li>
          <li>Security HTTP headers including nosniff, strict frame controls, and Content Security Policy restrictions.</li>
          <li>Strict rate-limiting on all API endpoints to defend against brute-force attacks and automated flooding.</li>
          <li>Constant-time cryptographic key comparisons for administrative endpoints.</li>
          <li>Zero storage of sensitive financial credentials on our servers.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          6. Data Retention
        </h2>
        <p>
          Leaderboard records and verified ranks remain on the public platform for the operational duration of the game to maintain historical ranking integrity. Technical server logs and IP records are automatically rotated and purged on a regular cycle. If you request profile removal, your public record will be anonymized or deleted from active display within 7 business days of request verification.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          7. User Rights & Data Removal Requests
        </h2>
        <p>
          In accordance with applicable law, you have the right to:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>Review the personal data held about your entry.</li>
          <li>Request correction or removal of any inaccurate, defamatory, or unwanted public links/statements.</li>
          <li>Request complete removal or pseudonymization of your profile from the public leaderboard.</li>
        </ul>
        <p className="text-xs sm:text-sm text-zinc-700">
          To exercise any of these rights, please email <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a> with your profile name, order reference, and the nature of your request.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          8. Policy Updates & Contact
        </h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our legal obligations or platform features. When changes are published, the "Last updated" date at the top of this page will be revised.
        </p>
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs sm:text-sm">
          <div><strong>Grievance & Privacy Inquiries:</strong> <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a></div>
          <div className="mt-1"><strong>Entity:</strong> Associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME]</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

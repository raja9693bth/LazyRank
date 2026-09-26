import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_CONFIG } from '../config/legal';
import { ShieldCheck, Lock, Eye, AlertTriangle } from 'lucide-react';

interface PrivacyPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle={`Transparent disclosure of how personal information is collected, processed, and safeguarded when using ${LEGAL_CONFIG.PRODUCT_NAME}.`}
      lastUpdated="September 24, 2026"
      currentPath="/privacy"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          1. Who We Are & Scope of this Policy
        </h2>
        <p>
          {LEGAL_CONFIG.OPERATING_STATEMENT}
        </p>
        <p>
          This Privacy Policy explains how {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} ("we", "us", or "our") collects, uses, stores, and protects information when you visit our website ({LEGAL_CONFIG.APP_URL}), claim a rank, or use our digital services.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          2. Information We Actually Collect
        </h2>
        <p>
          We adhere to data minimization principles. We collect only what is necessary to operate our digital sponsored showcase and maintain transaction security:
        </p>
        <div className="space-y-2.5 text-xs sm:text-sm text-zinc-700">
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">A. Public Profile Information</strong>
            When you claim or upgrade a rank, you provide a public display name, an optional statement/reason of laziness, and optional public links (Instagram handle, LinkedIn profile URL, personal website). This information is published publicly on our leaderboard and share cards.
          </div>
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">B. Customer Checkout Details</strong>
            When initiating a payment, you provide your mobile phone number (required by banking networks and payment gateways for UPI/card processing) and an optional email address. These details are used exclusively to process your payment via the gateway and to associate your digital receipt.
          </div>
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">C. Contact & Support Inquiries</strong>
            If you optionally subscribe to notification alerts or submit an inquiry through our customer support desk, we collect your email address, inquiry subject, and message contents to review and respond to you.
          </div>
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">D. Transaction & Order Metadata</strong>
            When you make a payment, we record your internal order ID, gateway payment ID (e.g. Cashfree payment reference), payment timestamp, amount paid in INR, currency, and payment status (e.g. PENDING, PAID, REFUNDED).
          </div>
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">E. Technical, Security & Analytics Logs</strong>
            We record client IP addresses, browser user-agent headers, and request timestamps strictly for abuse prevention, rate-limiting, and denial-of-service mitigation. Basic anonymous aggregate event counters (e.g. claim attempts) are collected to monitor service health.
          </div>
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
            <strong className="text-zinc-950 block mb-0.5">F. Moderation & Abuse Reports</strong>
            If a user submits a report concerning inappropriate profile content, we record the reported profile ID, reason, and reporter IP to prevent malicious spam.
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          3. Local Browser Storage & Cookies Disclosure
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-zinc-700 leading-relaxed">
          <p>
            <strong>Local Storage (HTML5 localStorage):</strong> We use your device's browser local storage for operational functionality:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-xs">
            <li>
              <strong>Profile Ownership Credential:</strong> Upon claiming a profile, a private owner token is stored locally on your device (in <code>localStorage.lazy_tokens</code>). Our server stores only a secure one-way cryptographic hash (SHA-256) of this credential. This authorizes you to update or upgrade your profile without requiring a password account. <em>Note: Clearing your browser cache or site data will remove this credential from your device. Because our servers store only a one-way cryptographic hash, raw tokens cannot be retrieved from an order reference alone. If you lose device access, contact support@lazyproof.online with payment verification for manual profile re-authentication.</em>
            </li>
            <li>
              <strong>UI Preferences:</strong> We store client interface preferences (such as audio sound mute settings).
            </li>
          </ul>
          <p>
            <strong>Cookies:</strong> We do <strong>NOT</strong> use tracking cookies, advertising cookies, or third-party behavioral analytics cookies.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span>4. What We DO NOT Store (Sensitive Payment Credentials)</span>
        </h2>
        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs sm:text-sm text-emerald-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Strict Zero-Payment-Credential Storage</span>
          </div>
          <p className="leading-relaxed">
            {LEGAL_CONFIG.BRAND_NAME} <strong>NEVER</strong> collects, handles, or stores your credit/debit card numbers, CVVs, expiration dates, UPI PINs, net-banking passwords, or bank account credentials. All payment processing occurs entirely within PCI-DSS compliant payment gateways (such as Cashfree). We only receive cryptographic status tokens and transaction references.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          5. AI Processing Disclosure (Automated Roast Generation)
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          {LEGAL_CONFIG.BRAND_NAME} offers an optional humorous "AI Roast" generation feature. When invoked, your public display name, rank, paid amount, and submitted reason are sent via API to Google Gemini (an external large language model provider) solely to generate the humor text. No private contact details, emails, or payment credentials are ever transmitted to the AI provider.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          6. How We Use Collected Information
        </h2>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>To display your public profile and rank on the live showcase leaderboard.</li>
          <li>To verify payments authoritatively against gateway webhooks and grant owner tokens.</li>
          <li>To generate downloadable 9:16 social share cards and digital payment receipts.</li>
          <li>To prevent payment fraud, bot spam, and denial-of-service attacks.</li>
          <li>To respond to customer support inquiries and process eligible refund requests.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          7. Data Retention & Deletion Rights
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          Public profile data is retained as long as your profile remains active on the leaderboard. Transaction metadata and payment logs are retained for reasonable accounting, audit, dispute resolution, and tax compliance periods under applicable Indian laws. Security and technical logs are rotated periodically. You have the right to request deletion or redaction of your public display name and social links by emailing us at <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a> with your owner token or order reference.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          8. Grievance Redressal & Contact Information
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          For any questions, concerns, or data requests, please contact our designated grievance contact:
        </p>
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm space-y-1">
          <div><strong>Grievance Contact:</strong> Compliance Desk, {LEGAL_CONFIG.LEGAL_BUSINESS_NAME}</div>
          <div><strong>Entity:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} ({LEGAL_CONFIG.ENTITY_TYPE})</div>
          <div><strong>Address:</strong> {LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}</div>
          <div><strong>Email:</strong> <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a></div>
          <div><strong>Support Phone:</strong> {LEGAL_CONFIG.SUPPORT_PHONE}</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

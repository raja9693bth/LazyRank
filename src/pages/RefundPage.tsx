import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_CONFIG } from '../config/legal';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface RefundPageProps {
  onNavigate: (path: string) => void;
}

export const RefundPage: React.FC<RefundPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="Refund & Cancellation Policy"
      subtitle="Clear and transparent guidelines on payment cancellation, transaction reversals, duplicate charges, technical failures, and refund requests."
      lastUpdated="September 24, 2026"
      currentPath="/refund-cancellation"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          1. Overview of Digital Service & General Non-Refundability
        </h2>
        <p>
          {LEGAL_CONFIG.OPERATING_STATEMENT}
        </p>
        <div className="p-3.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs sm:text-sm text-zinc-800">
          <strong>Immediate Digital Fulfillment:</strong> Upon successful cryptographic verification of your payment by our backend server, your profile is immediately committed to the public leaderboard, your verified badge is activated, your ranking position is computed, and your custom share cards are rendered.
        </div>
        <p>
          Because the digital placement service and compute resources are delivered instantaneously upon server verification, <strong>successfully verified and delivered payments are non-refundable</strong>, except in the specific technical and billing scenarios defined below.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          2. Specific Payment Scenarios & Refund Eligibility
        </h2>
        <div className="space-y-3 text-xs sm:text-sm">
          {/* Scenario 1 */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950">Scenario A: Payment Abandoned or Cancelled Before Success</div>
            <p className="text-zinc-600">
              If you close the checkout modal, decline authorization at the bank or UPI app, or navigate away prior to completion, no transaction occurs. No funds are collected and no cancellation fee applies.
            </p>
          </div>

          {/* Scenario 2 */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950">Scenario B: Failed Payment (No Debit)</div>
            <p className="text-zinc-600">
              If the payment gateway declines the transaction (e.g. insufficient funds, invalid OTP, bank server outage) and no money is debited from your account, the order is marked failed. No refund is necessary.
            </p>
          </div>

          {/* Scenario 3 */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1 text-amber-900">
            <div className="font-bold">Scenario C: Money Debited But Payment Not Confirmed (Technical Timeout)</div>
            <p className="text-xs sm:text-sm leading-relaxed">
              If funds are debited from your account or UPI wallet but the order on {LEGAL_CONFIG.BRAND_NAME} is not confirmed due to network timeouts, the transaction may remain pending with the bank/gateway and may be automatically reversed or reconciled.
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 pt-1 text-xs">
              <li><strong>Automated Bank Reversal:</strong> In most cases, the payment gateway or your issuing bank automatically reverses unconfirmed debits within <strong>3 to 7 business days</strong>.</li>
              <li><strong>Assisted Reconciliation:</strong> If the funds do not reflect in your account within 7 business days, email us at <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="font-bold underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a> with your Bank Reference Number (UTR / RRN) and debit timestamp. We will coordinate directly with our payment gateway partner to expedite reconciliation.</li>
            </ul>
          </div>

          {/* Scenario 4 */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950">Scenario D: Duplicate Charge for the Same Order</div>
            <p className="text-zinc-600">
              If your bank account was debited multiple times due to a browser glitch or rapid double-clicks, the duplicate payment is 100% eligible for a full refund.
            </p>
            <p className="text-zinc-600 text-[11px]">
              <strong>Action Required:</strong> Contact customer support at <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="font-bold underline text-stone-900">{LEGAL_CONFIG.SUPPORT_EMAIL}</a> with both transaction reference IDs or UTR numbers. Once verified against gateway records, the duplicate payment will be refunded in full.
            </p>
          </div>

          {/* Scenario 5 */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950">Scenario E: Payment Confirmed But Digital Placement Not Delivered</div>
            <p className="text-zinc-600">
              If our payment gateway confirms settlement but an unexpected server exception prevented your rank from updating within 15 minutes:
            </p>
            <p className="text-zinc-600 text-[11px]">
              You may choose either: (a) immediate manual activation of your rank placement, or (b) an immediate 100% refund.
            </p>
          </div>

          {/* Scenario 6 */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <div className="font-bold text-zinc-950">Scenario F: Successfully Delivered Digital Placement</div>
            <p className="text-zinc-600">
              Once your placement has been successfully published to the live public leaderboard, rank assigned, and assets rendered, the digital service has been completely fulfilled. Fulfilled digital placements are generally non-refundable, except where required by applicable law or where an eligible duplicate charge, failed fulfillment, reversal, or other stated exception applies. Rank displacement by a subsequent participant does NOT constitute grounds for a refund.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-zinc-700" />
          <span>3. Effect of Refunds & Reversals on Leaderboard Rank</span>
        </h2>
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-900 space-y-2">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Leaderboard Integrity Rule:</span>
          </div>
          <p className="leading-relaxed">
            A refunded, reversed, or charged-back payment will <strong>immediately cease to count toward verified ranking value</strong>. Our database will atomically debit the refunded amount from the profile's cumulative verified total and recalculate all leaderboard positions. If the cumulative balance drops to zero, the profile will be unranked or removed.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          4. Refund Processing Timeline & Method
        </h2>
        <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>
            <strong>7-Calendar-Day Claim Window:</strong> Any claim for an eligible refund (such as a verified duplicate debit or unfulfilled placement due to technical failure) must be submitted within <strong>7 calendar days</strong> of the transaction timestamp. Requests received after 7 calendar days cannot be reconciled against real-time gateway records.
          </li>
          <li>
            <strong>Internal Review & Approval:</strong> Validated refund requests are reviewed and approved by {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} within <strong>1 to 2 business days</strong>.
          </li>
          <li>
            <strong>Original Payment Method Only:</strong> In strict compliance with Indian banking and anti-money laundering regulations, approved refunds are returned strictly to the original source account, card, or UPI VPA from which the payment originated. Cash or alternate-account refunds are never issued.
          </li>
          <li>
            <strong>Final Bank Credit Timing:</strong> Once initiated by us, the funds typically credit your bank account within <strong>5 to 7 business days</strong>, depending on your issuing bank and payment aggregator processing schedules.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          5. Chargebacks & Dispute Policy
        </h2>
        <p>
          We strongly urge users to contact our support team at <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a> first before initiating a bank chargeback. Unwarranted chargebacks on legitimately verified and delivered digital services cause unnecessary banking overhead. Where a fraudulent chargeback is filed, the associated profile and placement will be permanently terminated.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          6. How to Submit a Refund Request
        </h2>
        <p>
          To submit a refund request for an eligible transaction, please email us within the 7-calendar-day claim window with:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>Your registered display name and order ID</li>
          <li>Payment date, time, and exact amount in INR</li>
          <li>Payment gateway transaction ID or Bank Reference Number (UTR / RRN)</li>
          <li>Brief explanation of the technical issue or duplicate charge</li>
        </ul>
        <div className="mt-3 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs sm:text-sm space-y-1">
          <div><strong>Support Desk:</strong> <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a></div>
          <div><strong>Support Phone:</strong> <a href={LEGAL_CONFIG.SUPPORT_PHONE_HREF} className="hover:underline">{LEGAL_CONFIG.SUPPORT_PHONE}</a></div>
          <div><strong>Operating Entity:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} ({LEGAL_CONFIG.ENTITY_TYPE})</div>
          <div><strong>Proprietor:</strong> {LEGAL_CONFIG.PROPRIETOR_NAME}</div>
          <div><strong>Address:</strong> {LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}</div>
          <div><strong>Business Hours:</strong> {LEGAL_CONFIG.BUSINESS_HOURS}</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

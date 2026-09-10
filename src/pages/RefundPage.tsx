import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';

interface RefundPageProps {
  onNavigate: (path: string) => void;
}

export const RefundPage: React.FC<RefundPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="Refund & Cancellation Policy"
      subtitle="Clear and transparent guidelines on payment cancellation, transaction reversals, duplicate charges, and refund requests."
      lastUpdated="September 10, 2026"
      currentPath="/refund-cancellation"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          1. Cancellation Before Payment
        </h2>
        <p>
          You are free to cancel or abandon your rank claim at any time before completing payment. If you close the payment modal, navigate away from the page, or decline authorization at the payment gateway window, no charge is made and no transaction is created. There are no cancellation fees, penalty charges, or hidden commitments.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          2. Nature of Digital Service & Post-Verification Policy
        </h2>
        <div className="p-3.5 rounded-xl bg-zinc-100 border border-zinc-200 text-xs sm:text-sm text-zinc-800">
          <strong>Immediate Digital Delivery:</strong> Upon successful verification of your payment by our backend server, your entry is calculated and permanently registered on the public LAZY leaderboard, your verified badge is activated, and your custom 9:16 high-resolution story cards are immediately generated and ready for download.
        </div>
        <p>
          Because the digital service and entertainment value (public rank allocation, digital legitimacy certification, and downloadable assets) are fulfilled and rendered immediately upon transaction verification, <strong>successfully verified payments are generally non-refundable</strong>, except in the specific circumstances detailed below.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          3. Debited But Unconfirmed / Failed Transactions
        </h2>
        <p>
          Occasionally, due to network latency, inter-bank connectivity drops, or UPI timeout issues, funds may be debited from your bank account or UPI app while the order status on LAZY remains marked as "failed", "pending", or "expired".
        </p>
        <div className="space-y-2 text-xs sm:text-sm text-zinc-700">
          <p>
            <strong>Standard Banking Auto-Reversal:</strong> In such situations, the funds do not reach our account; they are held in the banking settlement clearing pool. Payment gateways and issuing banks have automated reconciliation engines that detect unconfirmed debits and reverse the money back to the original source account.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li><strong>Turnaround Time:</strong> Depending on your bank and UPI app, reversals typically reflect within <strong>3 to 7 business days</strong>.</li>
            <li><strong>If Not Received:</strong> If the debited amount has not reversed after 7 business days, please email us at <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a> with your Bank Reference Number (RRN / UTR number), order ID, payment date, and a screenshot of the debit entry from your banking statement. We will coordinate directly with our payment gateway partner to expedite reconciliation.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          4. Duplicate Payments for the Same Order
        </h2>
        <p>
          If you accidentally paid twice for the same rank claim (for example, due to double-clicking during checkout or simultaneous UPI authorization), you are entitled to a full refund of the duplicate charge.
        </p>
        <p className="text-xs sm:text-sm text-zinc-700">
          <strong>How to Request a Duplicate Refund:</strong> Email <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a> within 48 hours of the transaction with both payment reference numbers, the order ID, and your registered email address. Once verified by our payment gateway records, the duplicate payment will be refunded in full.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          5. Technical Service Delivery Failure
        </h2>
        <p>
          If your payment is confirmed as successfully captured by our payment aggregator, but due to an irrecoverable server error or database malfunction, your verified rank is never allocated or displayed on the public leaderboard:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>We will investigate and offer you the choice to either manually credit and publish your verified rank, or</li>
          <li>Issue a 100% full refund of the paid amount.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          6. Unauthorized or Fraudulent Charges
        </h2>
        <p>
          If you discover an unauthorized transaction on your card, net banking, or UPI account with a reference to LAZY:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>Immediately notify your issuing bank or card provider to freeze the compromised instrument.</li>
          <li>Notify our team immediately at <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a> with the transaction details. Upon receipt, we will freeze the associated leaderboard rank, conduct an audit, and cooperate with your bank and the payment gateway to process a reversal where fraud is established.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          7. Chargebacks & Payment Disputes
        </h2>
        <p>
          We encourage participants to reach out to us first at <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a> before initiating a formal bank chargeback. Unwarranted chargebacks on legitimately verified claims harm platform continuity. Where a fraudulent chargeback is filed, the associated profile and rank will be permanently removed from the leaderboard.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          8. Refund Processing Method & Timelines
        </h2>
        <p>
          All approved refunds are initiated through our payment gateway (Cashfree Payments) and returned exclusively to the original payment source (the specific UPI ID, bank account, or debit/credit card used during payment).
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>Processing Window:</strong> Once initiated by us, the refund typically reflects in your bank account within <strong>5 to 7 business days</strong>, depending on the recipient bank's standard settlement speed.</li>
          <li><strong>Zero Cash / Third-Party Refunds:</strong> Under no circumstances will refunds be issued in cash or redirected to a different individual or account number than the original payer.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          9. Support Contact for Refund Inquiries
        </h2>
        <p>
          For any refund, cancellation, or payment reconciliation assistance, please reach out to:
        </p>
        <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs sm:text-sm">
          <div><strong>Payment Support Email:</strong> <a href="mailto:raja@xaivon.com" className="text-amber-800 font-bold hover:underline">raja@xaivon.com</a></div>
          <div className="mt-1"><strong>Operating Entity:</strong> Associated with XAIVON / [INSERT VERIFIED LEGAL BUSINESS NAME]</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

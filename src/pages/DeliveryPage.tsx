import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_CONFIG } from '../config/legal';
import { CheckCircle2, Clock, Globe, ShieldCheck, AlertCircle } from 'lucide-react';

interface DeliveryPageProps {
  onNavigate: (path: string) => void;
}

export const DeliveryPage: React.FC<DeliveryPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title="Delivery & Fulfillment Policy"
      subtitle="Clear and truthful information regarding digital fulfillment, delivery timelines, payment verification, and service availability."
      lastUpdated="September 24, 2026"
      currentPath="/delivery"
      onNavigate={onNavigate}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <span>1. Nature of the Service (Digital Delivery Only)</span>
        </h2>
        <p>
          {LEGAL_CONFIG.BRAND_NAME} ({LEGAL_CONFIG.PRODUCT_NAME}), operated by {LEGAL_CONFIG.LEGAL_BUSINESS_NAME}, provides exclusively digital services consisting of <strong>Digital Sponsored Profile Placement and Leaderboard Showcase</strong> on our web platform ({LEGAL_CONFIG.APP_URL}).
        </p>
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
          <Globe className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>No Physical Goods or Shipping:</strong> There are no tangible, physical items, parcels, or postal shipments associated with this product. All service fulfillment takes place digitally through our web servers.
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          2. Step-by-Step Delivery & Fulfillment Process
        </h2>
        <p>
          When you initiate and pay for a sponsored profile placement on {LEGAL_CONFIG.BRAND_NAME}, fulfillment proceeds through the following automated, server-authoritative stages:
        </p>
        <div className="space-y-2 text-xs sm:text-sm">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-bold text-white">1</span>
            <div>
              <strong>Order Registration:</strong> You select your sponsorship amount and submit your profile details (display name, custom reason, and optional public Instagram, LinkedIn, or website links). An internal order is registered on our server.
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-bold text-white">2</span>
            <div>
              <strong>Gateway Payment Processing:</strong> You are directed to a PCI-DSS compliant payment gateway (such as Cashfree) where you complete the transaction using UPI, net banking, debit/credit cards, or other supported payment methods.
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-bold text-white">3</span>
            <div>
              <strong>Cryptographic Server Verification:</strong> Our backend server receives an authoritative, cryptographically signed webhook confirmation directly from the payment gateway. The transaction amount, currency (INR), and order ID are strictly validated.
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">4</span>
            <div>
              <strong>Atomic Fulfillment & Leaderboard Update:</strong> Upon settlement confirmation, our database transaction atomically commits your payment ledger entry, registers or upgrades your profile, recalculates all leaderboard ranks deterministically, and issues your secure owner credential.
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">5</span>
            <div>
              <strong>Immediate Access & Receipt Generation:</strong> Your public profile URL becomes active, your verified badge is displayed, social sharing cards are generated, and a downloadable digital receipt is presented immediately.
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-700" />
          <span>3. Truthful Delivery Timeline</span>
        </h2>
        <p>
          We believe in complete transparency regarding digital delivery expectations:
        </p>
        <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-zinc-700 pl-1">
          <li>
            <strong>Normal Target Delivery:</strong> Under standard operating conditions, digital delivery occurs automatically within <strong>5 to 30 seconds</strong> following payment authorization and receipt of the gateway webhook.
          </li>
          <li>
            <strong>No "0 Seconds" Guarantee:</strong> Because payment settlement relies on third-party banking networks, card processing switches, UPI server responses, and gateway webhook delivery, we do not claim or guarantee instantaneous "zero-second" delivery.
          </li>
          <li>
            <strong>Pending Verification State:</strong> If a gateway settlement response is delayed due to banking latency, the system displays a clear, truthful status: <em>"Payment Confirmation Pending"</em>. During this period, our server checks the payment state with the gateway upon your browser return or status query, and awaits verified webhook delivery before crediting rank.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          4. What If Placement Is Not Delivered?
        </h2>
        <p>
          In rare cases where your payment was successfully debited by your bank but your profile rank has not updated within 15 minutes:
        </p>
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-bold text-zinc-900">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Resolution Protocol</span>
          </div>
          <p className="text-zinc-600">
            Please check your on-site order/payment status and digital receipt, or contact our customer support desk at{' '}
            <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">
              {LEGAL_CONFIG.SUPPORT_EMAIL}
            </a>{' '}
            with your order ID or Bank Reference Number (UTR / RRN).
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-600 pl-1">
            <li>We will trace the payment directly with the payment gateway.</li>
            <li>If the payment is authoritatively confirmed by the gateway, your verified placement will be activated immediately.</li>
            <li>If you prefer a refund due to the delay, a full refund will be initiated back to your original payment method within our standard 5–7 business day refund window.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          5. Contact Information for Delivery Inquiries
        </h2>
        <div className="text-xs sm:text-sm text-zinc-700 space-y-1">
          <div><strong>Operating Entity:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} ({LEGAL_CONFIG.ENTITY_TYPE})</div>
          <div><strong>Product / Brand:</strong> {LEGAL_CONFIG.PRODUCT_NAME}</div>
          <div><strong>Platform URL:</strong> <a href={LEGAL_CONFIG.APP_URL} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.APP_URL}</a></div>
          <div><strong>Support Email:</strong> <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a></div>
          <div><strong>Support Phone:</strong> {LEGAL_CONFIG.SUPPORT_PHONE}</div>
          <div><strong>Address:</strong> {LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}</div>
          <div><strong>Business Hours:</strong> {LEGAL_CONFIG.BUSINESS_HOURS}</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

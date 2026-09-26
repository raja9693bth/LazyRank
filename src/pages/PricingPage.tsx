import React from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_CONFIG } from '../config/legal';
import { ShieldCheck, ArrowUpDown, Info, CreditCard, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  return (
    <LegalPageLayout
      title={`Pricing & Placement Policy — ${LEGAL_CONFIG.BRAND_NAME}`}
      subtitle="Complete, transparent breakdown of how sponsorship pricing works, dynamic rank minimums, digital delivery, and current checkout status."
      lastUpdated="September 26, 2026"
      currentPath="/pricing"
      onNavigate={onNavigate}
    >
      {/* 1. Core Positioning & Service Purchased */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <span>1. What You Are Purchasing</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          {LEGAL_CONFIG.BRAND_NAME} is a <strong>{LEGAL_CONFIG.POSITIONING_TITLE}</strong> operated by {LEGAL_CONFIG.LEGAL_BUSINESS_NAME}.
          When you submit a payment on {LEGAL_CONFIG.BRAND_NAME}, you are purchasing <em>digital sponsored profile placement</em> on our public leaderboard.
        </p>
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs sm:text-sm text-zinc-800">
          <p className="font-semibold text-zinc-900">Your digital sponsorship purchase includes:</p>
          <ul className="list-disc list-inside space-y-1.5 text-zinc-700 pl-1">
            <li><strong>Public Showcase Placement:</strong> An active, publicly visible profile card featuring your submitted display name, personal statement, and optional external profile links (Website, LinkedIn, Instagram, or X).</li>
            <li><strong>Algorithmic Ranking:</strong> Deterministic placement on the leaderboard determined strictly by your cumulative verified INR sponsorship amount.</li>
            <li><strong>Digital Proof Card Generation:</strong> An on-demand, shareable 9:16 high-resolution digital image asset certifying your verified rank and sponsorship statement.</li>
            <li><strong>Cryptographic Profile Ownership:</strong> A private owner token stored client-side in your browser, enabling you to manage your profile and cumulatively upgrade your rank anytime without creating duplicate accounts.</li>
          </ul>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p>
            <strong>Consumer Notice:</strong> This purchase is for a digital promotional and entertainment showcase service. It is NOT an investment, financial instrument, lottery, game of chance, or betting scheme. It offers no financial return, dividend, or cash payout.
          </p>
        </div>
      </section>

      {/* 2. Minimum Sponsorship & Dynamic Rank Calculation */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-600" />
          <span>2. Pricing Structure & Minimum Sponsorship Rules</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          The pricing model on {LEGAL_CONFIG.BRAND_NAME} is strictly open and deterministic. We do not charge subscription fees or recurring memberships.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Base Entry Minimum</span>
            <div className="text-2xl font-black text-zinc-900 font-mono-numbers">₹1.00 INR</div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              The minimum amount to claim an initial spot on the leaderboard is ₹1 INR. Any verified payment of ₹1 or more establishes your profile on the verified public board.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Minimum to Take #1 Spot</span>
            <div className="text-2xl font-black text-amber-950 font-mono-numbers">Dynamic (Current #1 + ₹1)</div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              The price to claim rank #1 changes dynamically in real time based on active leaderboard competition. It is always exactly ₹1 higher than the current cumulative verified amount of the top profile. If no #1 is claimed, the cost is ₹1.00 INR.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Real-Time Dynamic Displacement */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5 text-amber-600" />
          <span>3. Dynamic Displacement & Rank Tenure</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          Because {LEGAL_CONFIG.BRAND_NAME} is an active, competitive digital showcase, <strong>rankings are subject to real-time displacement</strong>.
        </p>
        <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-zinc-700 pl-1">
          <li><strong>No Guaranteed Rank Duration:</strong> Your payment guarantees immediate digital placement corresponding to your verified cumulative amount, but does not guarantee a permanent rank or tenure at any specific position.</li>
          <li><strong>Displacement by Subsequent Sponsors:</strong> If another user contributes a higher verified cumulative amount than yours, your profile is automatically pushed down to the next appropriate rank.</li>
          <li><strong>Cumulative Profile Upgrades:</strong> If your rank is displaced, you can sponsor an additional amount at any time using your saved owner token. Your new payment is added cumulatively to your existing total to regain your target rank.</li>
        </ul>
      </section>

      {/* 4. Authoritative Final Quote & Tax Transparency */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>4. Currency, Authoritative Quotes & Taxes</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          All financial calculations, ledger credits, and payment gateway interactions are conducted strictly in <strong>Indian Rupees (INR)</strong> with minor-unit (paise) mathematical precision.
        </p>
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm space-y-2">
          <p className="font-semibold text-zinc-900">Authoritative Checkout Quote Presentation:</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-700 pl-1">
            <li>Before any payment is initiated, the checkout drawer presents the exact, binding sponsorship consideration in INR.</li>
            <li>Any applicable gateway convenience fees or statutory indirect taxes (such as GST, where applicable under prevailing Indian tax laws) will be clearly disclosed on the authoritative checkout summary prior to payment confirmation.</li>
            <li>No hidden fees, recurring charges, or surprise deductions are ever applied. The amount authorized is the exact amount settled.</li>
          </ul>
        </div>
      </section>

      {/* 5. Current Gateway Availability Status */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>5. Current Checkout Availability & Merchant Status</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          We maintain absolute transparency regarding our operating status:
        </p>
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 text-xs sm:text-sm space-y-2 text-zinc-800">
          <p className="font-bold text-amber-950">Current Operating Mode: Pre-Launch Gateway Underwriting</p>
          <p className="text-zinc-700 leading-relaxed">
            Live public checkouts on LazyProof are currently <strong>disabled</strong> (<code className="px-1.5 py-0.5 bg-zinc-200/80 rounded font-mono text-xs">PAYMENT_MODE=disabled</code>) while banking aggregator KYC, merchant categorization review, and compliance underwriting are finalized.
          </p>
          <p className="text-zinc-700 leading-relaxed">
            During this period, no real customer funds can be charged. Once merchant account activation is formally granted by our payment gateway partners, live INR checkouts will open with full automated webhook reconciliation.
          </p>
        </div>
      </section>

      {/* 6. Digital Delivery & Non-Refundability */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          6. Delivery & Cancellation Summary
        </h2>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          Digital profile placement and digital asset generation are delivered automatically upon server verification of the gateway transaction, typically within <strong>5 to 30 seconds</strong>.
        </p>
        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
          Because digital placement is consumed and fulfilled immediately upon payment verification, delivered digital placements are <strong>non-refundable</strong>. For full details regarding technical duplicate debit resolutions, please review our{' '}
          <button type="button" onClick={() => onNavigate('/refund-cancellation')} className="text-amber-800 font-bold hover:underline cursor-pointer">
            Refund & Cancellation Policy
          </button>{' '}
          and{' '}
          <button type="button" onClick={() => onNavigate('/delivery')} className="text-amber-800 font-bold hover:underline cursor-pointer">
            Delivery Policy
          </button>.
        </p>
      </section>

      {/* 7. Business & Support Contact */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-zinc-950 border-b border-zinc-200 pb-2">
          7. Operating Entity & Commercial Inquiries
        </h2>
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm space-y-1">
          <div><strong>Operating Enterprise:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} ({LEGAL_CONFIG.ENTITY_TYPE})</div>
          <div><strong>Proprietor:</strong> {LEGAL_CONFIG.PROPRIETOR_NAME}</div>
          <div><strong>Address:</strong> {LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}</div>
          <div><strong>Support Email:</strong> <a href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`} className="text-amber-800 font-bold hover:underline">{LEGAL_CONFIG.SUPPORT_EMAIL}</a></div>
          <div><strong>Support Telephone:</strong> <a href={LEGAL_CONFIG.SUPPORT_PHONE_HREF} className="hover:underline">{LEGAL_CONFIG.SUPPORT_PHONE}</a></div>
          <div><strong>Business Hours:</strong> {LEGAL_CONFIG.BUSINESS_HOURS}</div>
        </div>
      </section>
    </LegalPageLayout>
  );
};

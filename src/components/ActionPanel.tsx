import React, { useState, useEffect } from 'react';
import { Trophy, ArrowRight, Loader2, Globe, Instagram, Linkedin, MessageSquareQuote, ShieldCheck, Minus, Plus } from 'lucide-react';
import { UserProfile } from '../types.ts';

interface ActionPanelProps {
  topAmount: number;
  minAmountToBeatTop: number;
  initialAmount?: number;
  profiles: UserProfile[];
  upgradingProfile?: UserProfile | null;
  onCancelUpgrade?: () => void;
  onStartPayment: (data: {
    name: string;
    amount: number;
    customerPhone: string;
    customerEmail?: string;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
    profileId?: string;
    ownerToken?: string;
    consentAccepted: boolean;
    consentTimestamp: string;
    consentVersion: string;
  }) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  topAmount,
  minAmountToBeatTop,
  initialAmount,
  profiles,
  upgradingProfile,
  onCancelUpgrade,
  onStartPayment,
  isLoading = false,
  errorMessage
}) => {
  const [amount, setAmount] = useState<number>(initialAmount ?? minAmountToBeatTop);
  const [amountTouched, setAmountTouched] = useState<boolean>(false);
  const [name, setName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [reason, setReason] = useState('');
  const [showOptionalLinks, setShowOptionalLinks] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!amountTouched) {
      setAmount(initialAmount ?? minAmountToBeatTop);
    }
  }, [initialAmount, minAmountToBeatTop, amountTouched]);

  useEffect(() => {
    if (upgradingProfile) {
      setAmountTouched(false);
      setName(upgradingProfile.name);
      setInstagram(upgradingProfile.instagram || '');
      setLinkedin(upgradingProfile.linkedin || '');
      setWebsite(upgradingProfile.website || '');
      setReason(upgradingProfile.reason || '');
      if (upgradingProfile.instagram || upgradingProfile.linkedin || upgradingProfile.website || upgradingProfile.reason) {
        setShowOptionalLinks(true);
      }
    }
  }, [upgradingProfile]);

  // Compute expected rank based on verified amount
  const getExpectedRank = (val: number): number => {
    if (val >= minAmountToBeatTop) return 1;
    let rank = 1;
    for (const p of profiles) {
      if (p.amount > val) {
        rank++;
      } else {
        break;
      }
    }
    return rank;
  };

  const expectedRank = getExpectedRank(amount);
  const willTakeTop = amount >= minAmountToBeatTop;

  const handleAdjustAmount = (delta: number) => {
    setAmountTouched(true);
    setAmount(prev => Math.max(1, prev + delta));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError('Please enter your display name.');
      return;
    }
    if (trimmedName.length > 30) {
      setLocalError('Display name must be 30 characters or fewer.');
      return;
    }
    if (isNaN(amount) || amount < 1) {
      setLocalError('Minimum payment is ₹1.');
      return;
    }

    const cleanedPhone = customerPhone.replace(/\D/g, '');
    if (!cleanedPhone || cleanedPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanedPhone)) {
      setLocalError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    if (customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        setLocalError('Please enter a valid email address or leave it blank.');
        return;
      }
    }

    if (!termsAccepted) {
      setLocalError('Please read and agree to the Terms & Conditions and Privacy Policy, and acknowledge the Refund Policy.');
      return;
    }

    let storedOwnerToken: string | undefined;
    if (upgradingProfile?.id) {
      try {
        const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
        storedOwnerToken = tokens[upgradingProfile.id];
      } catch {}
    }

    onStartPayment({
      name: trimmedName,
      amount: Math.round(amount),
      customerPhone: cleanedPhone,
      customerEmail: customerEmail.trim() || undefined,
      instagram: instagram.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      website: website.trim() || undefined,
      reason: reason.trim() || undefined,
      profileId: upgradingProfile?.id,
      ownerToken: storedOwnerToken,
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '2026-09-24'
    });
  };

  return (
    <div id="action-panel-section" className="w-full max-w-2xl mx-auto mb-5 sm:mb-6">
      <div className="rounded-2xl border border-[#ede5db] bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        {/* Upgrading existing profile banner */}
        {upgradingProfile && (
          <div className="mb-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
            <div className="text-xs text-amber-900 font-medium">
              <strong className="font-bold">Upgrading:</strong> {upgradingProfile.name} (Current Rank #{upgradingProfile.rank}, ₹{upgradingProfile.amount.toLocaleString('en-IN')})
            </div>
            {onCancelUpgrade && (
              <button
                type="button"
                onClick={onCancelUpgrade}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Panel Header */}
        <div className="border-b border-[#f0eae1] pb-3 mb-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#b44b1c]" />
              <span>Pay to Prove Your Legitimacy</span>
            </h2>

            <div className="text-xs font-mono-numbers text-stone-500 font-semibold">
              Current #1: <span className="text-stone-900 font-bold">₹{topAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 leading-relaxed">
            Your verified payment amount determines your rank. Higher payment = higher rank.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Row 1: Name and Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
            {/* Display Name Input */}
            <div className="sm:col-span-7">
              <label htmlFor="claim-name-input" className="block text-[11px] font-bold text-stone-700 mb-1">
                Display Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="claim-name-input"
                type="text"
                placeholder="e.g. Rahul S."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (localError) setLocalError(null);
                }}
                maxLength={30}
                required
                className="w-full rounded-xl border border-[#ede5da] bg-[#faf8f4]/80 px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-stone-800 focus:outline-none transition-all"
              />
            </div>

            {/* Payment Amount Input with Controls */}
            <div className="sm:col-span-5">
              <label htmlFor="claim-amount-input" className="block text-[11px] font-bold text-stone-700 mb-1">
                Amount to pay (INR) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center rounded-xl border border-[#ede5da] bg-[#faf8f4]/80 overflow-hidden focus-within:border-stone-800 focus-within:bg-white transition-all">
                <button
                  type="button"
                  onClick={() => handleAdjustAmount(-10)}
                  className="px-2.5 py-2 text-stone-500 hover:text-stone-900 hover:bg-[#f0eae1] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                  title="Decrease amount by ₹10"
                  aria-label="Decrease payment amount by ₹10"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="relative flex-1 flex items-center">
                  <span className="pl-2 font-bold text-xs sm:text-sm text-stone-400 font-mono-numbers">₹</span>
                  <input
                    id="claim-amount-input"
                    type="number"
                    min={1}
                    step={1}
                    value={amount || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setAmountTouched(true);
                      setAmount(isNaN(val) ? 0 : val);
                      if (localError) setLocalError(null);
                    }}
                    required
                    className="w-full py-2 px-1 text-xs sm:text-sm font-black font-mono-numbers text-stone-900 bg-transparent focus:outline-none text-left focus-visible:ring-1 focus-visible:ring-stone-800"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleAdjustAmount(10)}
                  className="px-2.5 py-2 text-stone-500 hover:text-stone-900 hover:bg-[#f0eae1] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                  title="Increase amount by ₹10"
                  aria-label="Increase payment amount by ₹10"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Customer Mobile (Required) and Email (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label htmlFor="claim-phone-input" className="block text-[11px] font-bold text-stone-700 mb-1">
                Mobile Number (for Payment Gateway) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center rounded-xl border border-[#ede5da] bg-[#faf8f4]/80 overflow-hidden focus-within:border-stone-800 focus-within:bg-white transition-all">
                <span className="pl-3 pr-1 text-xs font-bold text-stone-500 select-none">+91</span>
                <input
                  id="claim-phone-input"
                  type="tel"
                  placeholder="9876543210"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    if (localError) setLocalError(null);
                  }}
                  maxLength={10}
                  required
                  className="w-full py-2 pr-3 text-xs sm:text-sm font-semibold text-stone-900 bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="claim-email-input" className="block text-[11px] font-bold text-stone-700 mb-1">
                Email Address <span className="text-stone-400 font-normal">(optional, for digital receipt)</span>
              </label>
              <input
                id="claim-email-input"
                type="email"
                placeholder="name@example.com"
                value={customerEmail}
                onChange={(e) => {
                  setCustomerEmail(e.target.value);
                  if (localError) setLocalError(null);
                }}
                maxLength={80}
                className="w-full rounded-xl border border-[#ede5da] bg-[#faf8f4]/80 px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-stone-800 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-bold text-stone-400 mr-0.5">Quick:</span>

            <button
              type="button"
              aria-pressed={amount === minAmountToBeatTop}
              onClick={() => {
                setAmountTouched(true);
                setAmount(minAmountToBeatTop);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono-numbers transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e86638] focus-visible:ring-offset-1 ${
                amount === minAmountToBeatTop
                  ? 'bg-[#e86638] text-white shadow-2xs'
                  : 'bg-[#faeee5] hover:bg-[#f5ded0] text-[#9c3a16] border border-[#f2ded0]'
              }`}
            >
              Take #1 (₹{minAmountToBeatTop.toLocaleString('en-IN')})
            </button>

            {[100, 250, 500, 1000].map(chipVal => (
              <button
                key={chipVal}
                type="button"
                aria-pressed={amount === chipVal}
                onClick={() => {
                  setAmountTouched(true);
                  setAmount(chipVal);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono-numbers transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1 ${
                  amount === chipVal
                    ? 'bg-stone-800 text-white'
                    : 'bg-[#f3ede5] hover:bg-[#eae2d6] text-stone-700'
                }`}
              >
                ₹{chipVal}
              </button>
            ))}
          </div>

          {/* Dynamic Rank Estimate Banner */}
          <div className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs transition-colors ${
            willTakeTop
              ? 'bg-[#faeee5]/80 border-[#f2ded0] text-[#843212]'
              : 'bg-[#faf8f4] border-[#ede5da] text-stone-800'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className={`w-3.5 h-3.5 shrink-0 ${willTakeTop ? 'text-[#b44b1c]' : 'text-stone-400'}`} />
              <div className="font-medium truncate">
                {willTakeTop ? (
                  <span>
                    <strong className="font-extrabold text-[#9c3a16]">₹{amount.toLocaleString('en-IN')} takes #1</strong> on the leaderboard!
                  </span>
                ) : (
                  <span>
                    ₹{amount.toLocaleString('en-IN')} puts you at approximately{' '}
                    <strong className="font-extrabold text-stone-900">Rank #{expectedRank}</strong>.
                  </span>
                )}
              </div>
            </div>

            {!willTakeTop && (
              <button
                type="button"
                onClick={() => setAmount(minAmountToBeatTop)}
                className="text-[11px] font-bold text-[#b44b1c] hover:underline shrink-0 self-start sm:self-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b44b1c] rounded"
              >
                Need ₹{minAmountToBeatTop.toLocaleString('en-IN')} for #1 →
              </button>
            )}
          </div>

          {/* Toggle Optional Links & Confession */}
          <div>
            {!showOptionalLinks ? (
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setShowOptionalLinks(true)}
                className="text-[11px] sm:text-xs text-stone-500 hover:text-stone-900 font-semibold underline underline-offset-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded"
              >
                + Add Instagram, LinkedIn, Website, or confession (optional)
              </button>
            ) : (
              <div className="space-y-2.5 pt-2 border-t border-[#f0eae1] animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Instagram handle (First) */}
                  <div>
                    <label htmlFor="claim-instagram-input" className="block text-[11px] font-bold text-stone-600 mb-0.5 flex items-center gap-1">
                      <Instagram className="w-3 h-3 text-stone-500 shrink-0" />
                      <span>Instagram</span>
                    </label>
                    <input
                      id="claim-instagram-input"
                      type="text"
                      placeholder="@handle"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      maxLength={60}
                      className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-800"
                    />
                  </div>

                  {/* LinkedIn Profile (Second) */}
                  <div>
                    <label htmlFor="claim-linkedin-input" className="block text-[11px] font-bold text-stone-600 mb-0.5 flex items-center gap-1">
                      <Linkedin className="w-3 h-3 text-stone-500 shrink-0" />
                      <span>LinkedIn</span>
                    </label>
                    <input
                      id="claim-linkedin-input"
                      type="text"
                      placeholder="in/profile"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-800"
                    />
                  </div>

                  {/* Website URL (Third) */}
                  <div>
                    <label htmlFor="claim-website-input" className="block text-[11px] font-bold text-stone-600 mb-0.5 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-stone-500 shrink-0" />
                      <span>Website</span>
                    </label>
                    <input
                      id="claim-website-input"
                      type="text"
                      placeholder="mywebsite.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-800"
                    />
                  </div>
                </div>

                {/* Short Laziness Reason */}
                <div>
                  <label htmlFor="claim-reason-input" className="block text-[11px] font-bold text-stone-600 mb-0.5 flex items-center gap-1">
                    <MessageSquareQuote className="w-3 h-3 text-stone-500 shrink-0" />
                    <span>Laziness Statement / Confession</span>
                  </label>
                  <input
                    id="claim-reason-input"
                    type="text"
                    placeholder="e.g. Paid so nobody expects anything from me this quarter."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={140}
                    className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-800"
                  />
                  <div className="text-[10px] text-stone-400 text-right mt-0.5 font-mono-numbers">
                    {reason.length}/140
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error display */}
          {(localError || errorMessage) && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              {localError || errorMessage}
            </div>
          )}

          {/* Pricing & Checkout Transparency Box (Section 3F) */}
          <div className="p-3.5 rounded-xl border border-[#ede5da] bg-[#faf8f4] text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-stone-900 border-b border-[#ede5da] pb-1.5">
              <span>Service Item</span>
              <span>Amount</span>
            </div>
            <div className="flex items-center justify-between text-stone-700">
              <span className="truncate pr-2">Digital Sponsored Profile Placement & Showcase</span>
              <span className="font-mono-numbers font-bold">₹{amount.toLocaleString('en-IN')} INR</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>Tax Consideration</span>
              <span>Inclusive of applicable taxes</span>
            </div>
            <div className="flex items-center justify-between text-xs font-black text-stone-950 border-t border-[#ede5da] pt-1.5">
              <span>Final Payable Total</span>
              <span className="font-mono-numbers text-sm text-[#9c3a16]">₹{amount.toLocaleString('en-IN')} INR</span>
            </div>

            <div className="text-[11px] text-stone-500 space-y-1 pt-1 border-t border-[#ede5da]/60 leading-relaxed">
              <p>
                <strong>What you receive:</strong> Public leaderboard placement, verified badge, downloadable 9:16 story cards, and optional public social/website links.
              </p>
              <p>
                <strong>Ranking Mechanics:</strong> Leaderboard position is determined deterministically by cumulative verified sponsorship. Another participant may sponsor a higher amount and displace your rank at any time.
              </p>
            </div>

            {/* Terms & Refund Policy Agreement Checkbox */}
            <label className="flex items-start gap-2 pt-1.5 cursor-pointer text-[11px] text-stone-700 font-medium">
              <input
                id="terms-checkbox"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (localError) setLocalError(null);
                }}
                className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-800"
              />
              <span>
                I have read and agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold underline text-stone-900 hover:text-[#9c3a16]">
                  Terms &amp; Conditions
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold underline text-stone-900 hover:text-[#9c3a16]">
                  Privacy Policy
                </a>
                , and I acknowledge the{' '}
                <a href="/refund-cancellation" target="_blank" rel="noopener noreferrer" className="font-bold underline text-stone-900 hover:text-[#9c3a16]">
                  Refund &amp; Cancellation Policy
                </a>
                . I understand ranking is dynamic and based deterministically on cumulative verified sponsorship.
              </span>
            </label>
          </div>

          {/* Primary Submit Button */}
          <button
            id="prove-your-laziness-btn"
            type="submit"
            disabled={isLoading || !name.trim() || amount < 1 || !termsAccepted || customerPhone.replace(/\D/g, '').length !== 10}
            aria-label={`Prove your laziness - pay ₹${amount.toLocaleString('en-IN')}`}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#e86638] hover:bg-[#d8582b] py-3 px-5 text-xs sm:text-sm font-black text-white shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e86638] focus-visible:ring-offset-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Preparing Payment...</span>
              </>
            ) : (
              <>
                <span>PROVE YOUR LAZINESS — PAY ₹{amount.toLocaleString('en-IN')}</span>
                <ArrowRight className="w-4 h-4 text-white shrink-0" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

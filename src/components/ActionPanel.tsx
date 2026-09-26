import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Globe, Instagram, Linkedin, MessageSquareQuote, ShieldCheck, Minus, Plus, Tag } from 'lucide-react';
import { UserProfile } from '../types.ts';
import { BROWSE_CATEGORIES } from '../utils/showcase.ts';

interface ActionPanelProps {
  topAmount: number;
  minAmountToBeatTop: number;
  initialAmount?: number;
  initialName?: string;
  initialCategory?: string;
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
    lazyReason?: string;
    profileId?: string;
    ownerToken?: string;
    consentAccepted: boolean;
    consentTimestamp: string;
    consentVersion: string;
  }) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  taxDisclosure?: string;
  taxReady?: boolean;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  topAmount,
  minAmountToBeatTop,
  initialAmount,
  initialName = '',
  initialCategory = '',
  profiles,
  upgradingProfile,
  onCancelUpgrade,
  onStartPayment,
  isLoading = false,
  errorMessage,
  taxDisclosure,
  taxReady = false
}) => {
  const [amount, setAmount] = useState<number>(initialAmount ?? minAmountToBeatTop);
  const [amountTouched, setAmountTouched] = useState<boolean>(false);
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<string>(initialCategory);
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

  // Update name / category when prefilled from outside
  useEffect(() => {
    if (initialName && !name) {
      setName(initialName);
    }
  }, [initialName]);

  useEffect(() => {
    if (initialCategory && !category) {
      setCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (upgradingProfile) {
      setAmountTouched(false);
      setName(upgradingProfile.name);
      setInstagram(upgradingProfile.instagram || '');
      setLinkedin(upgradingProfile.linkedin || '');
      setWebsite(upgradingProfile.website || '');
      setReason(upgradingProfile.reason || '');
      if (upgradingProfile.lazyReason) {
        setCategory(upgradingProfile.lazyReason);
      }
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
      if (!storedOwnerToken) {
        setLocalError('Cannot upgrade: Owner token for this profile is missing from this browser. You cannot upgrade without your original credentials.');
        return;
      }
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
      lazyReason: category || undefined,
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name Input */}
          <div>
            <label htmlFor="claim-name-input" className="block text-xs font-bold text-stone-700 mb-1">
              Your Display Name or Alias <span className="text-[#b44b1c]">*</span>
            </label>
            <input
              id="claim-name-input"
              type="text"
              required
              maxLength={30}
              placeholder="e.g. Master of Snooze, Alex G."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#ede5db] bg-[#faf8f4] px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-stone-800 focus:outline-none transition-colors"
            />
          </div>

          {/* Lazy Category Select */}
          <div>
            <label htmlFor="claim-category-select" className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-stone-500" />
              <span>Laziness Category (Optional)</span>
            </label>
            <select
              id="claim-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[#ede5db] bg-[#faf8f4] px-3 py-2 text-xs sm:text-sm font-semibold text-stone-800 focus:bg-white focus:border-stone-800 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">Select a category...</option>
              {BROWSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input & Stepper */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="claim-amount-input" className="text-xs font-bold text-stone-700">
                Payment Amount (INR) <span className="text-[#b44b1c]">*</span>
              </label>
              <span className="text-[11px] font-semibold text-stone-500 font-mono-numbers">
                Min to beat #1: <strong className="text-stone-900">₹{minAmountToBeatTop.toLocaleString('en-IN')}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustAmount(-10)}
                aria-label="Decrease amount by 10 rupees"
                className="w-10 h-10 rounded-xl border border-[#ede5db] bg-[#faf8f4] hover:bg-stone-100 flex items-center justify-center text-stone-700 font-bold active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 font-bold text-sm">
                  ₹
                </span>
                <input
                  id="claim-amount-input"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={amount || ''}
                  onChange={(e) => {
                    setAmountTouched(true);
                    setAmount(Math.max(1, parseInt(e.target.value || '1', 10)));
                  }}
                  className="w-full rounded-xl border border-[#ede5db] bg-[#faf8f4] pl-8 pr-3 py-2 text-sm sm:text-base font-extrabold text-stone-900 font-mono-numbers focus:bg-white focus:border-stone-800 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAdjustAmount(10)}
                aria-label="Increase amount by 10 rupees"
                className="w-10 h-10 rounded-xl border border-[#ede5db] bg-[#faf8f4] hover:bg-stone-100 flex items-center justify-center text-stone-700 font-bold active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[minAmountToBeatTop, minAmountToBeatTop + 50, minAmountToBeatTop + 100, 500, 1000].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setAmountTouched(true);
                    setAmount(chip);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono-numbers transition-all cursor-pointer ${
                    amount === chip
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'bg-[#faf8f4] border border-[#ede5db] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  ₹{chip.toLocaleString('en-IN')}
                </button>
              ))}
            </div>

            {/* Expected Rank Callout */}
            <div className={`mt-2.5 p-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
              willTakeTop ? 'bg-amber-50 border border-amber-200 text-amber-950' : 'bg-stone-50 border border-stone-200 text-stone-700'
            }`}>
              <span>Estimated Rank with ₹{amount.toLocaleString('en-IN')}:</span>
              <span className="font-extrabold font-mono-numbers text-stone-900">
                {willTakeTop ? '🔥 #1 Rank (New Leader!)' : `#${expectedRank}`}
              </span>
            </div>
          </div>

          {/* Mandatory Phone & Optional Email for Payment & Receipt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#f0eae1]">
            <div>
              <label htmlFor="claim-phone-input" className="block text-xs font-bold text-stone-700 mb-1">
                Indian Mobile Number <span className="text-[#b44b1c]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs pointer-events-none">
                  +91
                </span>
                <input
                  id="claim-phone-input"
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full rounded-xl border border-[#ede5db] bg-[#faf8f4] pl-11 pr-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 font-mono-numbers placeholder:text-stone-400 focus:bg-white focus:border-stone-800 focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[10px] text-stone-400 mt-0.5">Required for Cashfree payment receipt</p>
            </div>

            <div>
              <label htmlFor="claim-email-input" className="block text-xs font-bold text-stone-700 mb-1">
                Email Address <span className="text-stone-400 font-normal">(Optional)</span>
              </label>
              <input
                id="claim-email-input"
                type="email"
                placeholder="you@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-xl border border-[#ede5db] bg-[#faf8f4] px-3 py-2 text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-stone-800 focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-stone-400 mt-0.5">For payment confirmation receipt & support inquiries</p>
            </div>
          </div>

          {/* Collapsible Optional Public Links */}
          <div className="pt-1 border-t border-[#f0eae1]">
            <button
              type="button"
              onClick={() => setShowOptionalLinks(!showOptionalLinks)}
              className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1 cursor-pointer"
            >
              <span>{showOptionalLinks ? '− Hide Social & Website Links' : '+ Add Optional Social / Bio Links'}</span>
            </button>

            {showOptionalLinks && (
              <div className="mt-2.5 space-y-2.5 p-3 rounded-xl bg-[#faf8f4] border border-[#ede5db]">
                <div>
                  <label htmlFor="claim-website-input" className="block text-[11px] font-bold text-stone-600 mb-0.5 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-stone-500 shrink-0" />
                    <span>Website URL</span>
                  </label>
                  <input
                    id="claim-website-input"
                    type="url"
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-lg border border-[#ede5da] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-stone-800 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="claim-instagram-input" className="block text-[11px] font-bold text-stone-600 mb-0.5 flex items-center gap-1">
                      <Instagram className="w-3 h-3 text-stone-500 shrink-0" />
                      <span>Instagram Handle</span>
                    </label>
                    <input
                      id="claim-instagram-input"
                      type="text"
                      placeholder="@yourhandle"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      maxLength={30}
                      className="w-full rounded-lg border border-[#ede5da] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-stone-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="claim-linkedin-input" className="block text-[11px] font-bold text-stone-600 mb-0.5 flex items-center gap-1">
                      <Linkedin className="w-3 h-3 text-stone-500 shrink-0" />
                      <span>LinkedIn Profile</span>
                    </label>
                    <input
                      id="claim-linkedin-input"
                      type="text"
                      placeholder="linkedin.com/in/username"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-lg border border-[#ede5da] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-stone-800 focus:outline-none"
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
                    className="w-full rounded-lg border border-[#ede5da] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-stone-800 focus:outline-none"
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
              <span>Quote Item</span>
              <span>Amount</span>
            </div>
            <div className="flex items-center justify-between text-stone-700">
              <span className="truncate pr-2">Base Amount</span>
              <span className="font-mono-numbers font-bold">₹{amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-start justify-between gap-2 text-[11px] text-stone-500">
              <span>
                <strong>Goods &amp; Services Tax (GST)</strong>
                <small className="block">
                  {taxDisclosure || (taxReady
                    ? 'Unregistered (Turnover below threshold under Section 22 CGST Act) — ₹0'
                    : 'GST status being verified — checkout unavailable')}
                </small>
              </span>
              <span className="font-mono-numbers">₹0</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>Platform Fee</span>
              <span className="font-mono-numbers">₹0</span>
            </div>
            <div className="flex items-center justify-between text-xs font-black text-stone-950 border-t border-[#ede5da] pt-1.5">
              <span>Total Payable</span>
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
            disabled={isLoading || !taxReady || !name.trim() || amount < 1 || !termsAccepted || customerPhone.replace(/\D/g, '').length !== 10}
            aria-label={taxReady ? `Prove your laziness - pay ₹${amount.toLocaleString('en-IN')}` : 'Checkout unavailable pending payment and tax verification'}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#e86638] hover:bg-[#d8582b] py-3 px-5 text-xs sm:text-sm font-black text-white shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e86638] focus-visible:ring-offset-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Preparing Payment...</span>
              </>
            ) : !taxReady ? (
              <span>CHECKOUT UNAVAILABLE — TAX &amp; PAYMENT VERIFICATION PENDING</span>
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

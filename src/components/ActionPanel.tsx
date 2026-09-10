import React, { useState, useEffect } from 'react';
import { Trophy, ArrowRight, Loader2, Globe, Instagram, Linkedin, MessageSquareQuote, ShieldCheck, Minus, Plus } from 'lucide-react';
import { UserProfile } from '../types.ts';

interface ActionPanelProps {
  topAmount: number;
  minAmountToBeatTop: number;
  initialAmount?: number;
  profiles: UserProfile[];
  onStartPayment: (data: {
    name: string;
    amount: number;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
  }) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  topAmount,
  minAmountToBeatTop,
  initialAmount,
  profiles,
  onStartPayment,
  isLoading = false,
  errorMessage
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number>(initialAmount || minAmountToBeatTop);
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [reason, setReason] = useState('');
  const [showOptionalLinks, setShowOptionalLinks] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAmount && initialAmount > 0) {
      setAmount(initialAmount);
    }
  }, [initialAmount]);

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

    onStartPayment({
      name: trimmedName,
      amount: Math.round(amount),
      instagram: instagram.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      website: website.trim() || undefined,
      reason: reason.trim() || undefined
    });
  };

  return (
    <div id="action-panel-section" className="w-full max-w-2xl mx-auto my-3 sm:my-4">
      <div className="rounded-2xl border border-[#ede5db] bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
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
                  className="px-2.5 py-2 text-stone-500 hover:text-stone-900 hover:bg-[#f0eae1] transition-colors cursor-pointer"
                  title="Decrease amount by ₹10"
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
                      setAmount(isNaN(val) ? 0 : val);
                      if (localError) setLocalError(null);
                    }}
                    required
                    className="w-full py-2 px-1 text-xs sm:text-sm font-black font-mono-numbers text-stone-900 bg-transparent focus:outline-none text-left"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleAdjustAmount(10)}
                  className="px-2.5 py-2 text-stone-500 hover:text-stone-900 hover:bg-[#f0eae1] transition-colors cursor-pointer"
                  title="Increase amount by ₹10"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-bold text-stone-400 mr-0.5">Quick:</span>

            <button
              type="button"
              onClick={() => setAmount(minAmountToBeatTop)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono-numbers transition-all cursor-pointer ${
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
                onClick={() => setAmount(chipVal)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono-numbers transition-all cursor-pointer ${
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
                className="text-[11px] font-bold text-[#b44b1c] hover:underline shrink-0 self-start sm:self-auto cursor-pointer"
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
                onClick={() => setShowOptionalLinks(true)}
                className="text-[11px] sm:text-xs text-stone-500 hover:text-stone-900 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
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
                      className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none"
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
                      className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none"
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
                      className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none"
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
                    className="w-full rounded-lg border border-[#ede5da] bg-[#faf8f4]/80 px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-800 focus:outline-none"
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

          {/* Primary Submit Button */}
          <button
            id="prove-your-laziness-btn"
            type="submit"
            disabled={isLoading || !name.trim() || amount < 1}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#e86638] hover:bg-[#d8582b] py-3 px-5 text-xs sm:text-sm font-black text-white shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

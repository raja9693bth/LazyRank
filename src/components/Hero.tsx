import React from 'react';
import { Flame, Trophy, Loader2, RefreshCw } from 'lucide-react';
import { formatDisplayCurrency } from '../utils/showcase.ts';

interface HeroProps {
  topAmount: number;
  topProfileName?: string;
  minAmountToBeatTop: number;
  isLoadingMinAmount?: boolean;
  hasLeaderboardError?: boolean;
  onRetryLeaderboard?: () => void;
  onClaimAmount: (amount: number) => void;
  currencyMode?: 'INR' | 'USD';
  canClaim?: boolean;
}

export const Hero: React.FC<HeroProps> = ({
  topAmount,
  topProfileName,
  minAmountToBeatTop,
  isLoadingMinAmount = false,
  hasLeaderboardError = false,
  onRetryLeaderboard,
  onClaimAmount,
  currencyMode = 'INR',
  canClaim = true
}) => {
  const hasTopHolder = topAmount > 0 && Boolean(topProfileName);
  const formattedTopAmount = formatDisplayCurrency(topAmount, currencyMode);
  const formattedBeatAmount = formatDisplayCurrency(minAmountToBeatTop, currencyMode);

  return (
    <section className="pt-4 sm:pt-8 pb-4 max-w-5xl mx-auto px-3 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left Column: Headline, Price Callout, and Primary Action (Desktop col-span-7) */}
        <div className="md:col-span-7 text-center md:text-left space-y-3.5 sm:space-y-4">
          {/* Dynamic #1 Price Callout */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#faeee5] border border-[#f2ded0] text-[#7c2d12] text-xs font-semibold shadow-2xs">
            <Trophy className="w-3.5 h-3.5 text-[#b44b1c] shrink-0" />
            {isLoadingMinAmount ? (
              <span className="flex items-center gap-1.5 text-stone-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading current #1 spot...</span>
              </span>
            ) : hasLeaderboardError ? (
              <span className="flex items-center gap-1.5 text-rose-700">
                <span>Rank status unavailable</span>
                {onRetryLeaderboard && (
                  <button
                    type="button"
                    onClick={onRetryLeaderboard}
                    className="underline font-bold hover:text-rose-900 cursor-pointer flex items-center gap-0.5 ml-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Retry</span>
                  </button>
                )}
              </span>
            ) : hasTopHolder ? (
              <span>
                Current #1: <strong className="font-extrabold text-stone-900">{topProfileName}</strong> with{' '}
                <strong className="font-mono-numbers font-extrabold text-[#9c3a16]">{formattedTopAmount}</strong>
                <span className="text-stone-300 mx-1.5">·</span>
                <span>Take #1 for <strong className="text-stone-900 font-mono-numbers">{formattedBeatAmount}</strong></span>
              </span>
            ) : (
              <span>
                No #1 claimed yet <span className="text-stone-300 mx-1.5">·</span>
                <span>Claim #1 for <strong className="text-stone-900 font-mono-numbers">{formattedBeatAmount}</strong></span>
              </span>
            )}
          </div>

          {/* Main Headline */}
          <h1 className="text-2xl sm:text-4xl lg:text-[2.75rem] font-black tracking-tight text-stone-900 uppercase leading-[1.15] font-mono-numbers">
            WHO IS THE LAZIEST PERSON ALIVE?
          </h1>

          {/* Accurate Subheading */}
          <p className="text-xs sm:text-base font-semibold text-stone-600 max-w-lg mx-auto md:mx-0">
            Pay to prove it. The more you pay, the higher you rank.
          </p>

          {/* ONE Main CTA Button */}
          <div className="pt-1 flex justify-center md:justify-start">
            <button
              id="hero-take-rank1-btn"
              type="button"
              disabled={!canClaim || isLoadingMinAmount || hasLeaderboardError}
              onClick={() => onClaimAmount(minAmountToBeatTop)}
              aria-label={
                isLoadingMinAmount
                  ? 'Loading rank price'
                  : hasLeaderboardError
                  ? 'Rank price currently unavailable'
                  : hasTopHolder
                  ? `Take #1 for ${formattedBeatAmount}`
                  : `Claim #1 for ${formattedBeatAmount}`
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e86638] focus-visible:ring-offset-2"
            >
              <Flame className="w-4 h-4 text-white fill-white shrink-0" />
              <span>
                {isLoadingMinAmount ? (
                  'Loading minimum price...'
                ) : hasLeaderboardError ? (
                  'Price unavailable'
                ) : hasTopHolder ? (
                  `Take #1 for ${formattedBeatAmount}`
                ) : (
                  `Claim #1 for ${formattedBeatAmount}`
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Contained Sloth Mascot (Desktop col-span-5, hidden on mobile) */}
        <div className="hidden md:flex md:col-span-5 justify-center lg:justify-end items-center">
          <div className="w-[300px] lg:w-[350px] max-w-full">
            <img
              src="/mascot/lazyproof-sloth.png"
              alt="LazyProof Sloth Mascot on orange beanbag with laptop"
              width={350}
              height={350}
              className="w-full h-auto object-contain select-none drop-shadow-md transition-transform duration-300 hover:scale-103"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

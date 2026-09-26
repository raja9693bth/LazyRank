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
  period?: 'all' | 'today';
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
  canClaim = true,
  period = 'all'
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
                Current {period === 'today' ? 'all-time ' : ''}#1: <strong className="font-extrabold text-stone-900">{topProfileName}</strong> with{' '}
                <strong className="font-mono-numbers font-extrabold text-[#9c3a16]">{formattedTopAmount}</strong>
                <span className="text-stone-300 mx-1.5">·</span>
                <span>{period === 'today' ? 'Take all-time #1 for ' : 'Take #1 for '}<strong className="text-stone-900 font-mono-numbers">{formattedBeatAmount}</strong></span>
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
            Claim your spot. Sponsor higher. Rank higher. Make them knock you off.
          </p>

          {/* ONE Main CTA Button & Explanation */}
          <div className="pt-1 flex flex-col items-center md:items-start gap-2">
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
                  ? period === 'today'
                    ? `Take All-time #1 for ${formattedBeatAmount}`
                    : `Take #1 for ${formattedBeatAmount}`
                  : period === 'today'
                  ? `Claim All-time #1 for ${formattedBeatAmount}`
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
                  period === 'today' ? `Take All-time #1 for ${formattedBeatAmount}` : `Take #1 for ${formattedBeatAmount}`
                ) : (
                  period === 'today' ? `Claim All-time #1 for ${formattedBeatAmount}` : `Claim #1 for ${formattedBeatAmount}`
                )}
              </span>
            </button>
            {!canClaim && (
              <p className="text-xs text-amber-800 bg-amber-50/90 border border-amber-200/80 px-3 py-1.5 rounded-lg text-center md:text-left font-medium">
                Checkout is temporarily unavailable while payment setup is being verified.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Contained Sloth Mascot + Restrained Handwritten Annotation (Desktop col-span-5, hidden on mobile) */}
        <div className="hidden md:flex md:col-span-5 justify-center lg:justify-end items-center relative">
          {/* Handwritten Annotation near mascot with curved arrow */}
          <div className="absolute -top-3 left-4 lg:left-0 flex items-center gap-1.5 select-none pointer-events-none z-10">
            <span
              className="text-xs lg:text-sm font-medium italic text-[#8c5a45] tracking-wide whitespace-nowrap"
              style={{ fontFamily: '"Caveat", "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive, serif' }}
            >
              Maximum effort in doing nothing
            </span>
            <svg
              className="w-7 h-7 lg:w-8 lg:h-8 text-[#a36b53] shrink-0 transform translate-y-1"
              viewBox="0 0 36 36"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M 6 8 Q 20 6 24 22" />
              <path d="M 18 19 L 24 22 L 26 15" />
            </svg>
          </div>

          <div className="w-[300px] lg:w-[350px] max-w-full pt-4">
            <picture>
              <source srcSet="/mascot/lazyproof-sloth.webp" type="image/webp" />
              <img
                src="/mascot/lazyproof-sloth.png"
                alt="LazyProof Sloth Mascot on orange beanbag with laptop"
                width={360}
                height={240}
                className="w-full h-auto object-contain select-none drop-shadow-md transition-transform duration-300 hover:scale-103"
                loading="eager"
                decoding="async"
              />
            </picture>
          </div>
        </div>
      </div>
    </section>
  );
};

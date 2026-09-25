import React from 'react';
import { ArrowDown, Flame, Trophy } from 'lucide-react';
import { formatDisplayCurrency } from '../utils/showcase.ts';

interface HeroProps {
  topAmount: number;
  topProfileName?: string;
  minAmountToBeatTop: number;
  onClaimAmount: (amount: number) => void;
  onScrollToLeaderboard: () => void;
  currencyMode?: 'INR' | 'USD';
}

export const Hero: React.FC<HeroProps> = ({
  topAmount,
  topProfileName,
  minAmountToBeatTop,
  onClaimAmount,
  onScrollToLeaderboard,
  currencyMode = 'INR'
}) => {
  const hasTopHolder = topAmount > 0 && topProfileName;
  const formattedTopAmount = formatDisplayCurrency(topAmount, currencyMode);
  const formattedBeatAmount = formatDisplayCurrency(minAmountToBeatTop, currencyMode);

  return (
    <section className="pt-4 sm:pt-7 pb-4 text-center max-w-2xl mx-auto px-3">
      {/* Dynamic #1 Price Callout */}
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#faeee5] border border-[#f2ded0] text-[#7c2d12] text-xs font-semibold mb-4 shadow-2xs">
        <Trophy className="w-3.5 h-3.5 text-[#b44b1c] shrink-0" />
        {hasTopHolder ? (
          <span>
            Current #1: <strong className="font-extrabold text-stone-900">{topProfileName}</strong> with{' '}
            <strong className="font-mono-numbers font-extrabold text-[#9c3a16]">{formattedTopAmount}</strong>
            <span className="text-stone-300 mx-1.5">·</span>
            <span>Take #1 for <strong className="text-stone-900 font-mono-numbers">{formattedBeatAmount}</strong></span>
          </span>
        ) : (
          <span>
            No #1 claimed yet for this period <span className="text-stone-300 mx-1.5">·</span>
            <span>Claim #1 for <strong className="text-stone-900 font-mono-numbers">{formattedBeatAmount}</strong></span>
          </span>
        )}
      </div>

      {/* Sloth Mascot Showcase */}
      <div className="my-2 sm:my-3 flex justify-center">
        <div className="relative group">
          <img
            src="/mascot/lazyproof-sloth.png"
            alt="LazyProof Sloth Mascot on beanbag with laptop"
            width={240}
            height={240}
            className="w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 object-contain drop-shadow-md select-none transition-transform duration-300 hover:scale-105"
            loading="eager"
          />
        </div>
      </div>

      {/* Main Headline */}
      <h1 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold tracking-tight text-stone-900 uppercase leading-tight font-mono-numbers">
        WHO IS THE LAZIEST PERSON ALIVE?
      </h1>

      <p className="mt-2 text-xs sm:text-sm font-semibold text-stone-600 max-w-md mx-auto">
        Pay to prove it. The more you pay, the higher you rank.
      </p>

      {/* Quick CTAs */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        <button
          id="hero-take-rank1-btn"
          type="button"
          onClick={() => onClaimAmount(minAmountToBeatTop)}
          aria-label={hasTopHolder ? `Take #1 for ${formattedBeatAmount}` : `Claim #1 for ${formattedBeatAmount}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white text-xs sm:text-sm font-black shadow-xs transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e86638] focus-visible:ring-offset-2"
        >
          <Flame className="w-4 h-4 text-white fill-white shrink-0" />
          <span>{hasTopHolder ? `Take #1 for ${formattedBeatAmount}` : `Claim #1 for ${formattedBeatAmount}`}</span>
        </button>

        <button
          id="hero-view-leaderboard-btn"
          type="button"
          onClick={onScrollToLeaderboard}
          aria-label="Scroll to live leaderboard"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#eae2d6] text-stone-700 text-xs sm:text-sm font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-600 focus-visible:ring-offset-2"
        >
          <span>View Leaderboard</span>
          <ArrowDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
        </button>
      </div>
    </section>
  );
};

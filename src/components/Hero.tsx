import React from 'react';
import { ArrowDown, Flame, Trophy } from 'lucide-react';

interface HeroProps {
  topAmount: number;
  topProfileName?: string;
  minAmountToBeatTop: number;
  onClaimAmount: (amount: number) => void;
  onScrollToLeaderboard: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  topAmount,
  topProfileName,
  minAmountToBeatTop,
  onClaimAmount,
  onScrollToLeaderboard
}) => {
  const hasTopHolder = topAmount > 0 && topProfileName;

  return (
    <section className="pt-3 sm:pt-5 pb-2 text-center max-w-2xl mx-auto px-2">
      {/* Current #1 Dynamic Banner */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faeee5] border border-[#f2ded0] text-[#7c2d12] text-xs font-semibold mb-2.5 shadow-2xs">
        <Trophy className="w-3.5 h-3.5 text-[#b44b1c] shrink-0" />
        {hasTopHolder ? (
          <span>
            Current #1: <strong className="font-extrabold text-stone-900">{topProfileName}</strong> with{' '}
            <strong className="font-mono-numbers font-extrabold text-[#9c3a16]">₹{topAmount.toLocaleString('en-IN')}</strong>
            <span className="text-stone-300 mx-1.5">·</span>
            <span>Take #1 for <strong className="text-stone-900 font-mono-numbers">₹{minAmountToBeatTop.toLocaleString('en-IN')}</strong></span>
          </span>
        ) : (
          <span>
            No #1 claimed yet for this period <span className="text-stone-300 mx-1.5">·</span>
            <span>Claim #1 for <strong className="text-stone-900 font-mono-numbers">₹{minAmountToBeatTop.toLocaleString('en-IN')}</strong></span>
          </span>
        )}
      </div>

      {/* Main Headline */}
      <h1 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-extrabold tracking-tight text-stone-900 uppercase leading-tight font-mono-numbers">
        Who’s the laziest person in the world?
      </h1>

      <p className="mt-1.5 text-xs sm:text-sm font-semibold text-stone-600">
        Pay to prove it. The more you pay, the higher you rank.
      </p>

      {/* Quick CTAs */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          id="hero-take-rank1-btn"
          type="button"
          onClick={() => onClaimAmount(minAmountToBeatTop)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <Flame className="w-3.5 h-3.5 text-white fill-white shrink-0" />
          <span>{hasTopHolder ? `Take #1 for ₹${minAmountToBeatTop.toLocaleString('en-IN')}` : `Claim #1 for ₹${minAmountToBeatTop.toLocaleString('en-IN')}`}</span>
        </button>

        <button
          id="hero-view-leaderboard-btn"
          type="button"
          onClick={onScrollToLeaderboard}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white border border-[#eae2d6] text-stone-700 text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          <span>View Leaderboard</span>
          <ArrowDown className="w-3 h-3 text-stone-400 shrink-0" />
        </button>
      </div>
    </section>
  );
};


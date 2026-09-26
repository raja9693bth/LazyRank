import React, { useState } from 'react';
import { UserProfile } from '../types.ts';
import {
  Trophy,
  Loader2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { ProfileCard } from './ProfileCard.tsx';
import { SHOWCASE_CATEGORIES, ShowcaseCategory, matchesCategory, formatDisplayCurrency } from '../utils/showcase.ts';

interface LeaderboardProps {
  profiles: UserProfile[];
  onSelectProfile: (profile: UserProfile) => void;
  onVoteProfile?: (id: string) => void;
  onReportProfile?: (id: string) => void;
  onClaimSpecificRank?: (targetAmount: number) => void;
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  totalCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  currentFilter?: 'verified' | 'all';
  onSelectFilter?: (filter: 'verified' | 'all') => void;
  currencyMode?: 'INR' | 'USD';
  minAmountToBeatTop?: number;
  period?: 'all' | 'today';
  onPeriodChange?: (period: 'all' | 'today') => void;
  canClaim?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  profiles,
  onSelectProfile,
  onVoteProfile,
  onReportProfile,
  onClaimSpecificRank,
  isLoading = false,
  hasError = false,
  onRetry,
  totalCount = profiles.length,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  currentFilter = 'verified',
  onSelectFilter,
  currencyMode = 'INR',
  minAmountToBeatTop = 1,
  period = 'all',
  onPeriodChange,
  canClaim = true
}) => {
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>('All');

  // Filter currently loaded profiles by activeCategory
  const categoryFilteredProfiles = activeCategory === 'All'
    ? profiles
    : profiles.filter(p => matchesCategory(p, activeCategory));

  const formattedMinPrice = formatDisplayCurrency(minAmountToBeatTop, currencyMode);

  return (
    <section id="leaderboard-section" className="w-full">
      {/* Leaderboard Header: Scope Switcher + Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-stone-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#b44b1c]" />
            <span>{period === 'today' ? 'Leaderboard Showcase · Today (IST)' : 'Leaderboard Showcase'}</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {period === 'today'
              ? 'Verified sponsorship added since 12:00 AM IST.'
              : 'Ranked deterministically by cumulative verified sponsorship.'}
          </p>
        </div>

        {/* Scope Filter: Verified vs All */}
        {onSelectFilter && (
          <div className="flex items-center bg-[#ede5db] p-0.5 rounded-xl text-xs font-bold shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => onSelectFilter('verified')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                currentFilter === 'verified'
                  ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Verified Only
            </button>
            {period !== 'today' && (
              <button
                type="button"
                onClick={() => onSelectFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  currentFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Claims
              </button>
            )}
          </div>
        )}
      </div>

      {/* Accessible Timeframe Switcher: All-time | Today (Centered in Leaderboard column) */}
      {onPeriodChange && (
        <div className="flex flex-col items-center justify-center gap-1.5 mb-4 w-full">
          <div
            role="group"
            aria-label="Leaderboard timeframe selection"
            className="inline-flex items-center p-1 rounded-full bg-[#f4ebe1] border border-[#e8ded2] shadow-2xs"
          >
            <button
              type="button"
              id="leaderboard-period-toggle-all"
              onClick={() => onPeriodChange('all')}
              aria-pressed={period === 'all'}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                period === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All-time
            </button>
            <button
              type="button"
              id="leaderboard-period-toggle-today"
              onClick={() => onPeriodChange('today')}
              aria-pressed={period === 'today'}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                period === 'today'
                  ? 'bg-white text-stone-900 shadow-2xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Today
            </button>
          </div>
          {period === 'today' && (
            <p className="text-[11px] text-stone-500 font-medium text-center max-w-md px-2">
              Verified sponsorship added since 12:00 AM IST. Your all-time profile and checkout price are unchanged.
            </p>
          )}
        </div>
      )}

      {/* Category Pill Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-3">
        {SHOWCASE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              activeCategory === category
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#ede5db]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Honest Count Description */}
      {!isLoading && !hasError && profiles.length > 0 && (
        <div className="text-[11px] text-stone-500 mb-3 flex items-center justify-between">
          <span>
            {activeCategory === 'All'
              ? `Showing all ${profiles.length} currently loaded profile${profiles.length === 1 ? '' : 's'}.`
              : `Showing ${categoryFilteredProfiles.length} of ${profiles.length} loaded profile${profiles.length === 1 ? '' : 's'} in "${activeCategory}".`}
          </span>
          <span className="font-mono-numbers font-semibold">
            Total records: {totalCount}
          </span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4 EXPLICIT STATES                                            */}
      {/* ============================================================ */}

      {/* STATE 1: LOADING SKELETON */}
      {isLoading && profiles.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={`skeleton-${n}`}
              className="rounded-2xl border border-[#ede5db] bg-white p-5 animate-pulse flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 flex-1">
                <div className="w-8 h-8 rounded-xl bg-stone-200 shrink-0" />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-stone-200 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-stone-200 rounded w-1/3" />
                  <div className="h-3 bg-stone-100 rounded w-2/3" />
                </div>
              </div>
              <div className="w-20 h-6 bg-stone-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* STATE 2: API ERROR */}
      {!isLoading && hasError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 sm:p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-sm sm:text-base font-bold text-rose-950">
            Unable to load rankings
          </h3>
          <p className="text-xs text-rose-700 mt-1 max-w-sm mx-auto">
            We could not fetch the verified leaderboard. Please check your network connection.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* STATE 3: ZERO VERIFIED PROFILES (EMPTY-STATE PREVIEW ROWS) */}
      {!isLoading && !hasError && profiles.length === 0 && (
        <div className="space-y-3">
          {/* Row #1: #FFF4EE background, dashed border, empty avatar placeholder, clear CTA */}
          <div className="rounded-2xl border-2 border-dashed border-[#f2ded0] bg-[#fff4ee] p-5 sm:p-6 transition-all shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Left Column: Rank + Avatar */}
              <div className="flex items-center gap-3.5 sm:gap-4 shrink-0">
                <span className="w-9 h-9 rounded-xl bg-[#e86638] text-white flex items-center justify-center font-black text-sm font-mono-numbers shrink-0 shadow-2xs">
                  #1
                </span>
                {/* Tasteful Empty Avatar Placeholder */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-dashed border-amber-300 bg-white/80 flex items-center justify-center text-amber-500 shrink-0">
                  <Trophy className="w-6 h-6 stroke-[1.5]" />
                </div>
              </div>

              {/* Middle Column: Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-stone-900 truncate">
                    {period === 'today' ? 'No Claims Recorded Today' : 'Spot #1 is Unclaimed'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-white text-[#9c3a16] text-[10px] font-extrabold border border-amber-200 whitespace-nowrap">
                    {period === 'today' ? 'Today (IST)' : 'Open for Claim'}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-1 max-w-md leading-relaxed">
                  {period === 'today'
                    ? 'No verified sponsorships have been recorded since 12:00 AM IST today. The all-time leaderboard remains active.'
                    : 'Dynamic sponsored placement · Rank adjusts as new sponsored payments are verified'}
                </p>
              </div>

              {/* Right Column: CTA Button */}
              {onClaimSpecificRank && (
                <div className="shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={!canClaim}
                    onClick={() => onClaimSpecificRank(minAmountToBeatTop)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{period === 'today' ? `Claim All-time #1 for ${formattedMinPrice}` : `Claim #1 for ${formattedMinPrice}`}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Full-width Line Below Card Row for Payment Disablement Notice */}
            {!canClaim && (
              <div className="mt-3.5 pt-3 border-t border-amber-200/60 text-xs text-amber-800 font-medium text-center sm:text-left">
                Checkout is temporarily unavailable while payment setup is being verified.
              </div>
            )}
          </div>

          {/* Row #2: Clearly marked as future/open position */}
          <div className="rounded-2xl border border-dashed border-[#ede5db] bg-white/70 p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <span className="w-8 h-8 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs font-mono-numbers shrink-0">
                #2
              </span>
              <div className="w-12 h-12 rounded-2xl border border-dashed border-stone-300 bg-[#faf8f4] flex items-center justify-center text-stone-400 shrink-0">
                <span className="text-xs font-bold">#2</span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-stone-700 truncate">
                  {period === 'today' ? 'Today Spot #2' : 'Future Spot #2'}
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {period === 'today'
                    ? 'Assigned automatically to the second highest verified sponsorship today.'
                    : 'Assigned automatically to the second highest cumulative verified sponsorship.'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0">
              Open Position
            </span>
          </div>

          {/* Row #3: Clearly marked as future/open position */}
          <div className="rounded-2xl border border-dashed border-[#ede5db] bg-white/70 p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs font-mono-numbers shrink-0">
                #3
              </span>
              <div className="w-12 h-12 rounded-2xl border border-dashed border-stone-300 bg-[#faf8f4] flex items-center justify-center text-stone-400 shrink-0">
                <span className="text-xs font-bold">#3</span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-stone-700 truncate">
                  {period === 'today' ? 'Today Spot #3' : 'Future Spot #3'}
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {period === 'today'
                    ? 'Assigned automatically to the third highest verified sponsorship today.'
                    : 'Assigned automatically to the third highest cumulative verified sponsorship.'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0">
              Open Position
            </span>
          </div>
        </div>
      )}

      {/* STATE 4: POPULATED WITH REAL PROFILES (NO DUPLICATE PODIUM) */}
      {!isLoading && !hasError && profiles.length > 0 && (
        <>
          {categoryFilteredProfiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#ede5db] bg-white p-8 text-center text-stone-500">
              <ShieldCheck className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <h4 className="text-sm font-bold text-stone-800">
                No loaded profiles found in "{activeCategory}"
              </h4>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                Category filtering applies to currently loaded profiles. Switch back to "All" or load more profiles below.
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="mt-3 px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold cursor-pointer"
              >
                View All Loaded
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {categoryFilteredProfiles.map((p) => (
                <ProfileCard
                  key={p.id || `profile-${p.rank}`}
                  profile={p}
                  currencyMode={currencyMode}
                  onSelect={onSelectProfile}
                  onVote={onVoteProfile}
                  onReport={onReportProfile}
                  onBeatRank={onClaimSpecificRank}
                  isTop1={period === 'today' ? (p.periodRank ?? p.rank) === 1 : p.rank === 1}
                  period={period}
                />
              ))}
            </div>
          )}

          {/* Pagination / Load More Button */}
          {hasMore && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#ede5db] text-xs font-extrabold text-stone-800 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
                    <span>Loading More...</span>
                  </>
                ) : (
                  <>
                    <span>Load More Profiles ({profiles.length} of {totalCount})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

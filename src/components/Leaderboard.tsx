import React, { useState } from 'react';
import { UserProfile } from '../types.ts';
import {
  Trophy,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { ProfileCard } from './ProfileCard.tsx';
import { SHOWCASE_CATEGORIES, ShowcaseCategory, matchesCategory, formatDisplayCurrency } from '../utils/showcase.ts';

interface LeaderboardProps {
  profiles: UserProfile[];
  allTimeTop3?: UserProfile[];
  onSelectProfile: (profile: UserProfile) => void;
  onVoteProfile?: (id: string) => void;
  onReportProfile?: (id: string) => void;
  onClaimSpecificRank?: (targetAmount: number) => void;
  isLoading?: boolean;
  totalCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  currentFilter?: 'verified' | 'all';
  onSelectFilter?: (filter: 'verified' | 'all') => void;
  actionPanelSlot?: React.ReactNode;
  currencyMode?: 'INR' | 'USD';
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  profiles,
  allTimeTop3,
  onSelectProfile,
  onVoteProfile,
  onReportProfile,
  onClaimSpecificRank,
  isLoading = false,
  totalCount = profiles.length,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  currentFilter = 'verified',
  onSelectFilter,
  actionPanelSlot,
  currencyMode = 'INR'
}) => {
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>('All');

  // Filter currently loaded profiles by activeCategory
  const categoryFilteredProfiles = activeCategory === 'All'
    ? profiles
    : profiles.filter(p => matchesCategory(p, activeCategory));

  // Persistent All-Time Top 3 (Global Benchmark Layer)
  const persistentPodium = (allTimeTop3 && allTimeTop3.length > 0)
    ? allTimeTop3
    : profiles.filter(p => p.isVerified && p.amount > 0).slice(0, 3);

  return (
    <section id="leaderboard-section" className="w-full max-w-3xl mx-auto my-4 sm:my-6 px-3">
      {/* Optional action panel slot if passed and drawer is not exclusive */}
      {actionPanelSlot}

      {/* 1. PERSISTENT ALL-TIME TOP 3 (Permanent Benchmark Layer) */}
      <div className="mb-6">
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#b44b1c] shrink-0" />
              <span>World's Top 3 (All-Time)</span>
            </h2>
            <p className="text-[11px] text-stone-500 mt-0.5">
              The highest verified payments in LAZY history.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#faeee5] border border-[#f2ded0] text-[#7c2d12] text-[10px] font-extrabold shadow-2xs">
            Permanent Hall of Fame
          </span>
        </div>

        {/* Top 3 Cards */}
        <div className="grid grid-cols-1 gap-2.5">
          {[0, 1, 2].map((idx) => {
            const prof = persistentPodium[idx];
            const rankNum = idx + 1;

            if (!prof) {
              return (
                <div
                  key={`open-slot-${rankNum}`}
                  className="rounded-2xl border border-dashed border-[#e6ded3] bg-[#faf8f4]/70 p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-xl bg-[#f0eae1] text-stone-500 text-xs font-bold font-mono-numbers shrink-0">
                      #{rankNum} Open
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-stone-500 truncate">
                        Unclaimed Spot
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Pay {formatDisplayCurrency(1, currencyMode)}+ to claim #{rankNum}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                    <div className="font-mono-numbers font-black text-sm sm:text-base text-stone-300">
                      {formatDisplayCurrency(0, currencyMode)}
                    </div>
                    {onClaimSpecificRank && (
                      <button
                        type="button"
                        onClick={() => onClaimSpecificRank(1)}
                        aria-label={`Claim open spot rank #${rankNum} for 1 rupee`}
                        className="py-1.5 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-extrabold border border-[#ede5db] transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                      >
                        Claim Spot →
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <ProfileCard
                key={prof.id || `podium-${prof.rank}`}
                profile={prof}
                currencyMode={currencyMode}
                onSelect={onSelectProfile}
                onVote={onVoteProfile}
                onReport={onReportProfile}
                onBeatRank={onClaimSpecificRank}
                isTop1={rankNum === 1}
              />
            );
          })}
        </div>
      </div>

      {/* 2. FULL LEADERBOARD BROWSE & CATEGORIES */}
      <div className="border-t border-[#ede5db] pt-6 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Full Ranked Showcase</span>
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Explore participants ranked by cumulative verified payment.
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
            </div>
          )}
        </div>

        {/* Category Pill Tabs (Filtered locally over loaded profiles with honest subtext) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-2">
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

        {/* Honest Category Filtering Note */}
        <div className="text-[10px] text-stone-500 mb-3 flex items-center justify-between">
          <span>
            {activeCategory === 'All' ? (
              `Showing all ${profiles.length} currently loaded profile${profiles.length === 1 ? '' : 's'}.`
            ) : (
              `Showing ${categoryFilteredProfiles.length} of ${profiles.length} currently loaded profile${profiles.length === 1 ? '' : 's'} matching "${activeCategory}".`
            )}
          </span>
          <span className="font-mono-numbers">
            Total recorded: {totalCount}
          </span>
        </div>

        {/* Profiles List */}
        {isLoading ? (
          <div className="py-12 text-center text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#e86638] mb-2" />
            <p className="text-xs font-semibold">Loading verified leaderboard...</p>
          </div>
        ) : categoryFilteredProfiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ede5db] bg-white p-8 text-center text-stone-500">
            <Filter className="w-8 h-8 mx-auto text-stone-300 mb-2" />
            <h4 className="text-sm font-bold text-stone-800">
              No loaded profiles found in "{activeCategory}"
            </h4>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Category filter applies to currently loaded profiles. Switch back to "All" or load more profiles below.
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
                isTop1={p.rank === 1}
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
      </div>
    </section>
  );
};

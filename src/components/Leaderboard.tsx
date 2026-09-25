import React from 'react';
import { UserProfile } from '../types.ts';
import { 
  Trophy, 
  ExternalLink, 
  Globe, 
  Instagram, 
  Linkedin,
  MessageSquareQuote, 
  ShieldAlert, 
  Share2,
  Clock,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Flame,
  ArrowRight
} from 'lucide-react';

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
  actionPanelSlot
}) => {
  // Compact editorial empty states
  const getEmptyStateText = () => {
    return currentFilter === 'all'
      ? 'No participants yet.'
      : 'No verified claims recorded yet.';
  };

  // Persistent All-Time Top 3 (Global Benchmark Layer)
  const persistentPodium = (allTimeTop3 && allTimeTop3.length > 0)
    ? allTimeTop3
    : profiles.filter(p => p.isVerified && p.amount > 0).slice(0, 3);

  return (
    <section id="leaderboard-section" className="w-full max-w-2xl mx-auto my-4 sm:my-5">
      {/* 1. PERSISTENT ALL-TIME TOP 3 (Permanent Global Benchmark Layer) */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center justify-between pb-2.5">
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
            Current All-Time Top 3
          </span>
        </div>

        {/* Vertical 3-Row Ranking Block (Row 1 = #1, Row 2 = #2, Row 3 = #3) - NO GIANT CONTAINER */}
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((idx) => {
            const prof = persistentPodium[idx];
            const rankNum = idx + 1;
            const isFirst = rankNum === 1;
            const isSecond = rankNum === 2;

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
                        Pay ₹1+ to claim #{rankNum}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                    <div className="font-mono-numbers font-black text-sm sm:text-base text-stone-300">
                      ₹0
                    </div>
                    {onClaimSpecificRank && (
                      <button
                        type="button"
                        onClick={() => onClaimSpecificRank(1)}
                        aria-label={`Claim open spot rank #${rankNum} for ₹1`}
                        className="py-1.5 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-extrabold border border-[#ede5db] transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1"
                      >
                        Claim Spot →
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={prof.id}
                role="button"
                tabIndex={0}
                aria-label={`View verified profile for ${prof.name}, rank ${rankNum}, ₹${prof.amount.toLocaleString('en-IN')}`}
                onClick={() => onSelectProfile(prof)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectProfile(prof);
                  }
                }}
                className={`group rounded-2xl p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer border outline-hidden focus-visible:ring-2 focus-visible:ring-[#9c3a16] focus-visible:ring-offset-2 ${
                  isFirst
                    ? 'bg-[#fff8f2] border-[#f3ded0] hover:border-[#ebbfa7] shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
                    : isSecond
                    ? 'bg-[#fbf7f1] border-[#eee5d9] hover:border-[#dfd3c3] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                    : 'bg-[#faf8f4] border-[#eae3d9] hover:border-[#ded5ca] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                }`}
              >
                {/* Left: Rank, Name, Metadata, Links */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  {/* Rank Badge */}
                  <span
                    className={`inline-flex items-center justify-center font-black font-mono-numbers text-xs sm:text-sm px-2.5 py-1 rounded-xl shrink-0 ${
                      isFirst
                        ? 'bg-[#fae2d4] text-[#9c3a16] border border-[#f5cbba] shadow-2xs'
                        : isSecond
                        ? 'bg-[#f0eae1] text-stone-700 border border-[#e4dcce]'
                        : 'bg-[#f0eae1] text-stone-600 border border-[#e4dcce]'
                    }`}
                  >
                    #{rankNum}
                  </span>

                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-stone-900 group-hover:text-[#9c3a16] transition-colors truncate max-w-[150px] sm:max-w-[260px]">
                        {prof.name}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" title="Verified Proof of Payment" />
                      {isFirst && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-[#fae7dc] text-[#913813] border border-[#f2cfbd]">
                          Current Leader
                        </span>
                      )}
                      {!isFirst && prof.badge && (
                        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f0eae1] text-stone-700 border border-[#e4dcce]">
                          {prof.badge}
                        </span>
                      )}
                      {prof.lazyStreakDays && prof.lazyStreakDays > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200"
                          title={`${prof.lazyStreakDays} consecutive days maintained in Top 10`}
                        >
                          <Flame className="w-2.5 h-2.5 text-orange-600 fill-orange-500" />
                          <span>{prof.lazyStreakDays}d streak</span>
                        </span>
                      )}
                    </div>

                    {/* Statement / Confession */}
                    {prof.reason && (
                      <p className="text-[11px] text-stone-500 italic truncate max-w-[220px] sm:max-w-[360px] mt-0.5">
                        "{prof.reason}"
                      </p>
                    )}

                    {/* Social links strictly: Instagram → LinkedIn → Website */}
                    <div className="flex items-center gap-2.5 mt-1 text-[11px] flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {prof.instagram && (
                        <a
                          href={`https://instagram.com/${prof.instagram.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-stone-500 hover:text-pink-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-sm"
                          title={`@${prof.instagram.replace(/^@/, '')}`}
                          aria-label={`${prof.name}'s Instagram profile`}
                        >
                          <Instagram className="w-3 h-3 text-stone-400 hover:text-pink-500 shrink-0" />
                          <span className="truncate max-w-[90px]">@{prof.instagram.replace(/^@/, '')}</span>
                        </a>
                      )}
                      {prof.linkedin && (
                        <a
                          href={prof.linkedin.startsWith('http') ? prof.linkedin : `https://${prof.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-stone-500 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-sm"
                          title={prof.linkedin}
                          aria-label={`${prof.name}'s LinkedIn profile`}
                        >
                          <Linkedin className="w-3 h-3 text-stone-400 hover:text-blue-500 shrink-0" />
                          <span>LinkedIn</span>
                        </a>
                      )}
                      {prof.website && (
                        <a
                          href={prof.website.startsWith('http') ? prof.website : `https://${prof.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-stone-500 hover:text-sky-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-sm"
                          title={prof.website}
                          aria-label={`${prof.name}'s personal website`}
                        >
                          <Globe className="w-3 h-3 text-stone-400 hover:text-sky-500 shrink-0" />
                          <span>Website</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Beat Action */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#f0eae1]">
                  <div className="text-left sm:text-right">
                    <div className="font-mono-numbers font-black text-base sm:text-lg text-stone-900 leading-tight">
                      ₹{prof.amount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-stone-400 font-bold">
                      VERIFIED
                    </div>
                  </div>

                  {onClaimSpecificRank && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClaimSpecificRank(prof.amount + 1);
                      }}
                      className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1 ${
                        isFirst
                          ? 'bg-[#fae7dc] hover:bg-[#f5dacb] text-[#913813] border border-[#f2cfbe]'
                          : 'bg-white hover:bg-stone-50 text-stone-700 border border-[#e5ded4]'
                      }`}
                      title={`Beat ₹${prof.amount.toLocaleString('en-IN')}`}
                      aria-label={`Beat ${prof.name}'s rank with ₹${(prof.amount + 1).toLocaleString('en-IN')}`}
                    >
                      Beat ₹{prof.amount.toLocaleString('en-IN')} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. PAY TO PROVE YOUR LEGITIMACY (Slot for ActionPanel) */}
      {actionPanelSlot}

      {/* 3. SELECTED PERIOD CONTEXT & CONTROLS */}
      <div className="pt-2 pb-2.5 border-b border-[#eee6dc]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-stone-900 flex items-center gap-1.5">
              <span>All-Time Leaderboard</span>
              <span className="text-xs font-mono-numbers font-bold text-stone-400">
                ({totalCount})
              </span>
            </h2>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {currentFilter === 'verified'
                ? 'Verified profiles ranked by cumulative settled sponsorship.'
                : 'All participants, including unverified profiles.'}
            </p>
          </div>
        </div>

        {/* Sub-bar: Scope Filter & Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          {onSelectFilter && (
            <div className="inline-flex items-center rounded-lg bg-[#f0eae1]/80 p-0.5 text-[10px] font-bold text-stone-600" role="group" aria-label="Ranking filter options">
              <button
                type="button"
                onClick={() => onSelectFilter('verified')}
                aria-pressed={currentFilter === 'verified'}
                className={`px-2 py-0.5 rounded-md tracking-tight cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1 ${
                  currentFilter === 'verified'
                    ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Verified Rankings
              </button>
              <button
                type="button"
                onClick={() => onSelectFilter('all')}
                aria-pressed={currentFilter === 'all'}
                className={`px-2 py-0.5 rounded-md tracking-tight cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1 ${
                  currentFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                All Participants
              </button>
            </div>
          )}

          <div className="text-[11px] text-stone-400 font-medium">
            {profiles.length > 0 ? (
              <span>
                Showing 1–{profiles.length} of {totalCount}{' '}
                {currentFilter === 'all' ? 'participants' : 'verified rankings'}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* COMPACT EDITORIAL EMPTY STRIP (If selected period has 0 rows) */}
      {!isLoading && profiles.length === 0 && (
        <div className="py-2.5 px-3.5 rounded-xl border border-[#ede5db] bg-[#faf8f4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 my-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <div>
              <span className="font-bold text-stone-900">{getEmptyStateText()}</span>
              <span className="text-stone-500 ml-1.5 hidden sm:inline">
                Be the first to claim #{1} for ₹1.
              </span>
            </div>
          </div>
          {onClaimSpecificRank && (
            <button
              type="button"
              onClick={() => onClaimSpecificRank(1)}
              className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-lg bg-[#e86638] hover:bg-[#d8582b] text-white font-black text-xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
            >
              <span>Claim #{1} for ₹1 →</span>
            </button>
          )}
        </div>
      )}

      {/* 4. FULL LEADERBOARD LIST - RESPONSIVE CARD-BASED LAYOUT ON MOBILE, SLEEK ROWS ON DESKTOP */}
      {isLoading && profiles.length === 0 ? (
        <div className="py-12 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
          <span>Loading rankings...</span>
        </div>
      ) : profiles.length > 0 && (
        <div className="my-3">
          {/* Desktop Table Column Header */}
          <div className="hidden sm:flex items-center justify-between px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
            <div className="flex items-center gap-3">
              <span className="w-8 text-center">Rank</span>
              <span>Participant</span>
            </div>
            <div className="flex items-center gap-6 text-right">
              <span>Claim Amount</span>
              <span className="w-24 text-center">Action</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:gap-1.5">
            {profiles.map((profile) => {
              const isVerified = profile.isVerified && profile.amount > 0;
              const isTop1 = isVerified && profile.rank === 1;
              const isTop2 = isVerified && profile.rank === 2;
              const isTop3 = isVerified && profile.rank === 3;

              return (
                <div key={profile.id} className="w-full">
                  {/* MOBILE CARD ROW (<640px) */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`View verified profile for ${profile.name}, rank #${profile.rank}, ₹${profile.amount.toLocaleString('en-IN')}`}
                    onClick={() => onSelectProfile(profile)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectProfile(profile);
                      }
                    }}
                    className={`sm:hidden rounded-2xl p-3.5 border flex flex-col gap-2.5 transition-all active:scale-[0.99] cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-2 ${
                      isTop1
                        ? 'bg-[#fff8f2] border-[#f3ded0] shadow-[0_2px_4px_rgba(180,75,28,0.05)]'
                        : isTop2
                        ? 'bg-[#fbf7f1] border-[#eee5d9]'
                        : isTop3
                        ? 'bg-[#faf8f4] border-[#eae3d9]'
                        : 'bg-white border-[#ece6de]'
                    }`}
                  >
                    {/* Top Row: Rank Badge & Name on Left; Claim Amount on Right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Rank Number Badge */}
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-xl bg-[#fae2d4] text-[#9c3a16] font-black font-mono-numbers text-xs border border-[#f5cbba] shadow-2xs shrink-0">
                            <Trophy className="w-3.5 h-3.5 text-[#b44b1c]" />
                            #1
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-[#f0eae1] text-stone-800 font-black font-mono-numbers text-xs border border-[#e4dcce] shrink-0">
                            #2
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-[#f0eae1] text-stone-700 font-black font-mono-numbers text-xs border border-[#e4dcce] shrink-0">
                            #3
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-stone-100 text-stone-600 font-extrabold font-mono-numbers text-xs border border-stone-200/80 shrink-0">
                            #{profile.rank}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-extrabold text-sm text-stone-900 truncate">
                            {profile.name}
                          </span>
                          {isVerified ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" title="Verified Proof of Payment" />
                          ) : (
                            <span className="text-[9px] font-semibold text-stone-400 px-1 py-0.2 bg-stone-100 rounded shrink-0">
                              Unverified
                            </span>
                          )}
                          {profile.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#faeee5] text-[#913813] border border-[#f2ded0] shrink-0">
                              {profile.badge}
                            </span>
                          )}
                          {profile.rank <= 10 && profile.lazyStreakDays && profile.lazyStreakDays > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200 shrink-0"
                              title={`${profile.lazyStreakDays} consecutive days maintained in Top 10`}
                            >
                              <Flame className="w-2.5 h-2.5 text-orange-600 fill-orange-500" />
                              <span>{profile.lazyStreakDays}d streak</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 'Claim' Amount & Status on Mobile */}
                      <div className="text-right shrink-0">
                        <div className="font-mono-numbers font-black text-base text-stone-950 leading-tight">
                          ₹{profile.amount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider font-bold text-stone-400">
                          {isVerified ? 'CLAIMED' : 'PENDING'}
                        </div>
                      </div>
                    </div>

                    {/* Statement / Confession if present */}
                    {profile.reason && (
                      <p className="text-xs text-stone-600 italic bg-[#faf8f5] px-2.5 py-1.5 rounded-lg border border-[#f0eae1] leading-relaxed">
                        "{profile.reason}"
                      </p>
                    )}

                    {/* Social Links */}
                    {(profile.instagram || profile.linkedin || profile.website) && (
                      <div className="flex items-center gap-2 text-xs flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {profile.instagram && (
                          <a
                            href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-50 border border-stone-200 text-stone-600 hover:text-pink-600 transition-colors text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                            aria-label={`${profile.name}'s Instagram profile`}
                          >
                            <Instagram className="w-3 h-3 text-pink-500 shrink-0" />
                            <span className="truncate max-w-[110px]">@{profile.instagram.replace(/^@/, '')}</span>
                          </a>
                        )}
                        {profile.linkedin && (
                          <a
                            href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-50 border border-stone-200 text-stone-600 hover:text-blue-600 transition-colors text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                            aria-label={`${profile.name}'s LinkedIn profile`}
                          >
                            <Linkedin className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>LinkedIn</span>
                          </a>
                        )}
                        {profile.website && (
                          <a
                            href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-50 border border-stone-200 text-stone-600 hover:text-sky-600 transition-colors text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                            aria-label={`${profile.name}'s website`}
                          >
                            <Globe className="w-3 h-3 text-sky-500 shrink-0" />
                            <span>Website</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Card Footer: Beat / Claim Action & Share Card */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#f0eae1]">
                      {onClaimSpecificRank && isVerified ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClaimSpecificRank(profile.amount + 1);
                          }}
                          aria-label={`Beat ${profile.name}'s rank with ₹${(profile.amount + 1).toLocaleString('en-IN')}`}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#fae7dc] hover:bg-[#f5dacb] text-[#913813] text-xs font-black border border-[#f2cfbe] flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[42px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#913813] focus-visible:ring-offset-1"
                        >
                          <span>Beat with ₹{(profile.amount + 1).toLocaleString('en-IN')}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-stone-400 font-semibold font-mono-numbers">
                          Verified Public Rank #{profile.rank}
                        </span>
                      )}

                      <button
                        type="button"
                        title="View Public Proof & Share Card"
                        aria-label={`View public proof and share card for ${profile.name}, rank #${profile.rank}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProfile(profile);
                        }}
                        className="py-2 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px] shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1"
                      >
                        <Share2 className="w-3.5 h-3.5 text-stone-600" />
                        <span>Proof</span>
                      </button>
                    </div>
                  </div>

                  {/* DESKTOP TABLE ROW (>=640px) */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`View verified profile for ${profile.name}, rank #${profile.rank}, ₹${profile.amount.toLocaleString('en-IN')}`}
                    onClick={() => onSelectProfile(profile)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectProfile(profile);
                      }
                    }}
                    className={`hidden sm:flex group rounded-xl px-4 py-2.5 sm:py-3 border items-center justify-between gap-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-2 ${
                      isTop1
                        ? 'bg-[#fff8f2] border-[#f3ded0] hover:border-[#ebbfa7] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                        : isTop2
                        ? 'bg-[#fbf7f1] border-[#eee5d9] hover:border-[#dfd3c3] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                        : isTop3
                        ? 'bg-[#faf8f4] border-[#eae3d9] hover:border-[#ded5ca] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                        : 'bg-white border-[#ece6de] hover:bg-[#faf8f5] shadow-[0_1px_2px_rgba(0,0,0,0.015)]'
                    }`}
                  >
                    {/* Left Side: Rank, Avatar/Badge, Name, Links */}
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      {/* Rank Badge */}
                      <div className="w-8 text-center shrink-0">
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#fae2d4] text-[#9c3a16] font-black text-xs font-mono-numbers">
                            1
                          </span>
                        ) : isTop2 ? (
                          <span className="text-xs font-bold text-stone-700 font-mono-numbers">
                            #2
                          </span>
                        ) : isTop3 ? (
                          <span className="text-xs font-bold text-stone-600 font-mono-numbers">
                            #3
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-stone-400 font-mono-numbers">
                            #{profile.rank}
                          </span>
                        )}
                      </div>

                      {/* Profile Details */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-[#9c3a16] transition-colors truncate max-w-[140px] sm:max-w-[220px]">
                            {profile.name}
                          </span>

                          {isVerified ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" title="Verified Proof of Payment" />
                          ) : (
                            <span className="text-[9px] font-semibold text-stone-400 px-1 py-0.2 bg-stone-100 rounded">
                              Unverified
                            </span>
                          )}

                          {profile.badge && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#faeee5] text-[#913813] border border-[#f2ded0]">
                              {profile.badge}
                            </span>
                          )}
                          {profile.rank <= 10 && profile.lazyStreakDays && profile.lazyStreakDays > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-orange-50 text-orange-800 border border-orange-200"
                              title={`${profile.lazyStreakDays} consecutive days maintained in Top 10`}
                            >
                              <Flame className="w-2.5 h-2.5 text-orange-600 fill-orange-500" />
                              <span>{profile.lazyStreakDays}d streak</span>
                            </span>
                          )}
                        </div>

                        {/* Statement / Confession (if present) */}
                        {profile.reason && (
                          <p className="text-[11px] text-stone-500 italic truncate max-w-[200px] sm:max-w-[340px] mt-0.5">
                            "{profile.reason}"
                          </p>
                        )}

                        {/* Social Links: Instagram → LinkedIn → Website */}
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {profile.instagram && (
                            <a
                              href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-stone-400 hover:text-pink-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-sm"
                              title={`@${profile.instagram.replace(/^@/, '')}`}
                              aria-label={`${profile.name}'s Instagram profile`}
                            >
                              <Instagram className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[80px]">@{profile.instagram.replace(/^@/, '')}</span>
                            </a>
                          )}
                          {profile.linkedin && (
                            <a
                              href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-stone-400 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-sm"
                              title={profile.linkedin}
                              aria-label={`${profile.name}'s LinkedIn profile`}
                            >
                              <Linkedin className="w-3 h-3 shrink-0" />
                              <span>LinkedIn</span>
                            </a>
                          )}
                          {profile.website && (
                            <a
                              href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-stone-400 hover:text-sky-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-sm"
                              title={profile.website}
                              aria-label={`${profile.name}'s website`}
                            >
                              <Globe className="w-3 h-3 shrink-0" />
                              <span>Website</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Amount & Beat Action */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-mono-numbers font-black text-xs sm:text-sm text-stone-900">
                          ₹{profile.amount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-stone-400 font-semibold">
                          {isVerified ? 'Verified' : 'Pending'}
                        </div>
                      </div>

                      {/* Beat This Rank Action */}
                      {onClaimSpecificRank && isVerified && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClaimSpecificRank(profile.amount + 1);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-[#faf8f4] hover:bg-[#f0eae1] text-stone-700 hover:text-stone-950 border border-[#ede5da] text-[11px] font-black transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1"
                          title={`Beat ₹${profile.amount.toLocaleString('en-IN')}`}
                          aria-label={`Beat ${profile.name}'s rank with ₹${(profile.amount + 1).toLocaleString('en-IN')}`}
                        >
                          Beat ₹{profile.amount.toLocaleString('en-IN')} →
                        </button>
                      )}

                      {/* Share Card Trigger */}
                      <button
                        type="button"
                        title="View & Share Result Card"
                        aria-label={`View and share proof card for ${profile.name}, rank #${profile.rank}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProfile(profile);
                        }}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination / Load More Controls */}
      {hasMore && onLoadMore && (
        <div className="mt-3 flex flex-col items-center justify-center gap-1">
          <button
            id="leaderboard-load-more-btn"
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full sm:w-auto px-5 py-2 rounded-xl border border-[#ede5db] bg-white hover:bg-[#faf8f4] text-stone-900 font-extrabold text-xs tracking-tight shadow-2xs hover:shadow-xs transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                <span>Loading rankings...</span>
              </>
            ) : (
              <span>Show {Math.min(100, Math.max(1, totalCount - profiles.length))} more</span>
            )}
          </button>
          <span className="text-[10px] text-stone-400 font-mono-numbers">
            Showing 1–{profiles.length} of {totalCount} {currentFilter === 'all' ? 'participants' : 'verified rankings'}
          </span>
        </div>
      )}

      {!hasMore && profiles.length > 0 && (
        <div className="mt-2 text-center py-1">
          <span className="text-[11px] text-stone-400 font-mono-numbers">
            Showing 1–{profiles.length} of {totalCount} {currentFilter === 'all' ? 'participants' : 'verified rankings'} · All rankings accessible
          </span>
        </div>
      )}
    </section>
  );
};

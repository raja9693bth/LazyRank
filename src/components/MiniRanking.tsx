import React from 'react';
import { Trophy, Flame, CheckCircle2, ChevronRight } from 'lucide-react';
import { UserProfile } from '../types.ts';
import { formatDisplayCurrency, getWittyTag } from '../utils/showcase.ts';

interface MiniRankingProps {
  topProfiles: UserProfile[];
  claimsToday: number;
  onSelectProfile: (profile: UserProfile) => void;
  currencyMode?: 'INR' | 'USD';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const MiniRanking: React.FC<MiniRankingProps> = ({
  topProfiles,
  claimsToday,
  onSelectProfile,
  currencyMode = 'INR'
}) => {
  const displayProfiles = topProfiles.slice(0, 5);

  return (
    <aside aria-label="Top spots summary" className="w-full rounded-2xl border border-[#ede5db] bg-white p-4 shadow-2xs">
      {/* Header */}
      <div className="border-b border-[#f0eae1] pb-3 mb-3">
        <div className="flex items-center justify-between gap-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-[#b44b1c]" />
            <span>All-Time Top Spots</span>
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[#9c3a16] text-[10px] font-extrabold">
            Hall of Fame
          </span>
        </div>
        <p className="text-[11px] text-stone-500 mt-1 leading-snug">
          Highest verified payments in platform history.
        </p>
      </div>

      {/* Claims Today Banner */}
      <div className="mb-3 px-3 py-2 rounded-xl bg-[#faf8f4] border border-[#ede5db] flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-stone-600 font-semibold text-[11px]">
          <Flame className="w-3.5 h-3.5 text-[#e86638]" />
          <span>Claims Today:</span>
        </span>
        <span className="font-extrabold text-stone-900 font-mono-numbers">
          {claimsToday} verified
        </span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {displayProfiles.length === 0 ? (
          <div className="p-4 text-center text-xs text-stone-400">
            No verified profiles yet.
          </div>
        ) : (
          displayProfiles.map((p, idx) => {
            const rank = idx + 1;
            const isFirst = rank === 1;
            return (
              <button
                key={p.id || `mini-rank-${rank}`}
                type="button"
                onClick={() => onSelectProfile(p)}
                className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isFirst
                    ? 'border-amber-200 bg-[#fffbf7] hover:bg-[#fff7ef]'
                    : 'border-transparent hover:border-[#ede5db] hover:bg-[#faf8f4]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs font-mono-numbers shrink-0 ${
                      isFirst
                        ? 'bg-[#e86638] text-white'
                        : rank === 2
                        ? 'bg-stone-300 text-stone-800'
                        : rank === 3
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    #{rank}
                  </span>

                  {/* Initials Avatar */}
                  <div className="w-7 h-7 rounded-full bg-[#f0eae1] flex items-center justify-center text-[10px] font-black text-stone-700 shrink-0">
                    {getInitials(p.name)}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 truncate flex items-center gap-1">
                      <span className="truncate">{p.name}</span>
                      {p.isVerified && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 fill-emerald-100 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] text-stone-500 truncate">
                      {getWittyTag(p)}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <div className="text-xs font-black text-stone-900 font-mono-numbers">
                    {formatDisplayCurrency(p.amount, currencyMode)}
                  </div>
                  <div className="text-[9px] text-stone-400 uppercase font-bold">
                    Verified
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

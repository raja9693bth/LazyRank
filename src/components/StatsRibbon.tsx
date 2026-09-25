import React from 'react';
import { ShieldCheck, EyeOff, Flame, Layers } from 'lucide-react';
import { BROWSE_CATEGORIES } from '../utils/showcase.ts';

interface StatsRibbonProps {
  verifiedCount: number;
  claimsToday: number;
}

export const StatsRibbon: React.FC<StatsRibbonProps> = ({
  verifiedCount,
  claimsToday
}) => {
  return (
    <section aria-label="Platform Statistics" className="w-full max-w-4xl mx-auto my-4 sm:my-6 px-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Stat 1: Verified Profiles */}
        <div className="rounded-2xl border border-[#ede5db] bg-white p-3.5 text-center shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified Users</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono-numbers">
            {verifiedCount.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            Confirmed via payment
          </div>
        </div>

        {/* Stat 2: Profile Views (Explicitly Untracked / Unavailable) */}
        <div className="rounded-2xl border border-[#ede5db] bg-white p-3.5 text-center shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">
            <EyeOff className="w-3.5 h-3.5 text-stone-400" />
            <span>Profile Views</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-stone-400">
            Unavailable
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            Not tracked by system
          </div>
        </div>

        {/* Stat 3: Claims Today */}
        <div className="rounded-2xl border border-[#ede5db] bg-white p-3.5 text-center shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Flame className="w-3.5 h-3.5 text-[#e86638]" />
            <span>Claims Today</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono-numbers">
            {claimsToday.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            Real daily verified activity
          </div>
        </div>

        {/* Stat 4: Browse Categories */}
        <div className="rounded-2xl border border-[#ede5db] bg-white p-3.5 text-center shadow-2xs">
          <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>Categories</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono-numbers">
            {BROWSE_CATEGORIES.length}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            Distinct laziness styles
          </div>
        </div>
      </div>
    </section>
  );
};

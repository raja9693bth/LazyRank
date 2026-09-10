import React from 'react';
import { RankPeriod, LiveStats } from '../types.ts';
import { ShieldAlert, Swords, Trophy, Activity } from 'lucide-react';
import { LazyLogo } from './LazyLogo';

interface HeaderProps {
  currentPeriod: RankPeriod;
  onSelectPeriod: (period: RankPeriod) => void;
  onOpenAbout: () => void;
  onOpenRules: () => void;
  onOpenChallenge: () => void;
  onOpenAdmin: () => void;
  onLogoClick: () => void;
  liveStats?: LiveStats | null;
  onOpenLiveStats?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPeriod,
  onSelectPeriod,
  onOpenAbout,
  onOpenRules,
  onOpenChallenge,
  onOpenAdmin,
  onLogoClick,
  liveStats,
  onOpenLiveStats
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#eee6dc] bg-[#fbf9f5]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1140px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Brand + Live Status Badge */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <button
              id="brand-logo-btn"
              onClick={onLogoClick}
              className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
              aria-label="LAZY Home"
            >
              <LazyLogo variant="horizontal" size="sm" className="group-hover:opacity-85 transition-opacity" />
              <span className="hidden sm:inline-block text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-[#fae7dc] text-[#913813] border border-[#f2cfbd]">
                PAY-TO-RANK
              </span>
            </button>
          </div>

          {/* Genuine Live Activity Indicator (Section 4, 5, 6, 7) */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-stone-600 bg-white/80 border border-[#ede5da] px-2.5 py-1 rounded-full shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-stone-900 font-mono-numbers">
              {liveStats?.online || 1}
            </span>
            <span className="text-stone-500">online</span>
            <span className="text-stone-300">·</span>
            <span className="font-bold text-stone-900 font-mono-numbers">
              {liveStats?.visitsToday || 1}
            </span>
            <span className="text-stone-500">visits today</span>
            {onOpenLiveStats && (
              <>
                <span className="text-stone-300">·</span>
                <button
                  type="button"
                  onClick={onOpenLiveStats}
                  className="font-bold text-[#b44b1c] hover:text-[#913813] hover:underline cursor-pointer transition-colors"
                >
                  Live stats →
                </button>
              </>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-stone-600 ml-2">
            <button
              id="nav-tab-today"
              onClick={() => onSelectPeriod('today')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold tracking-tight transition-colors cursor-pointer ${
                currentPeriod === 'today'
                  ? 'bg-stone-800 text-stone-100 shadow-2xs'
                  : 'hover:bg-stone-200/50 text-stone-600'
              }`}
            >
              Today
            </button>
            <button
              id="nav-tab-week"
              onClick={() => onSelectPeriod('week')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold tracking-tight transition-colors cursor-pointer ${
                currentPeriod === 'week'
                  ? 'bg-stone-800 text-stone-100 shadow-2xs'
                  : 'hover:bg-stone-200/50 text-stone-600'
              }`}
            >
              This Week
            </button>
            <button
              id="nav-tab-month"
              onClick={() => onSelectPeriod('month')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold tracking-tight transition-colors cursor-pointer ${
                currentPeriod === 'month'
                  ? 'bg-stone-800 text-stone-100 shadow-2xs'
                  : 'hover:bg-stone-200/50 text-stone-600'
              }`}
            >
              This Month
            </button>
            <button
              id="nav-tab-all"
              onClick={() => onSelectPeriod('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold tracking-tight transition-colors cursor-pointer ${
                currentPeriod === 'all'
                  ? 'bg-stone-800 text-stone-100 shadow-2xs'
                  : 'hover:bg-stone-200/50 text-stone-600'
              }`}
            >
              All Time
            </button>
            <span className="mx-1 h-3 w-px bg-stone-200" />
            <button
              id="nav-about-btn"
              onClick={onOpenAbout}
              className="px-2 py-1 text-xs text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              id="nav-rules-btn"
              onClick={onOpenRules}
              className="px-2 py-1 text-xs text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
            >
              Rules
            </button>
          </nav>
        </div>

        {/* Right CTA */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onOpenLiveStats && (
            <button
              onClick={onOpenLiveStats}
              title="View live stats"
              className="sm:hidden flex items-center gap-1 text-[11px] font-bold text-stone-700 bg-white border border-[#ede5da] px-2 py-1 rounded-lg cursor-pointer transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Live</span>
            </button>
          )}

          <button
            id="header-admin-btn"
            onClick={onOpenAdmin}
            title="Admin Moderation"
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-200/50 transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
          
          <button
            id="header-challenge-btn"
            onClick={onOpenChallenge}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white font-extrabold text-xs tracking-tight shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Challenge</span>
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Sub-Navigation */}
      <div className="flex lg:hidden items-center justify-between px-4 py-1.5 border-t border-[#eee6dc] bg-[#f7f3ec]/90 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSelectPeriod('today')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentPeriod === 'today' ? 'bg-stone-800 text-stone-100' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => onSelectPeriod('week')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentPeriod === 'week' ? 'bg-stone-800 text-stone-100' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onSelectPeriod('month')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentPeriod === 'month' ? 'bg-stone-800 text-stone-100' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onSelectPeriod('all')}
            className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
              currentPeriod === 'all' ? 'bg-stone-800 text-stone-100' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            All Time
          </button>
        </div>
        <div className="flex items-center gap-2 text-stone-500 text-[11px]">
          <button onClick={onOpenAbout} className="hover:text-stone-900 cursor-pointer">About</button>
          <span>•</span>
          <button onClick={onOpenRules} className="hover:text-stone-900 cursor-pointer">Rules</button>
        </div>
      </div>
    </header>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { RankPeriod, LiveStats } from '../types.ts';
import { ShieldCheck, Swords, Sliders, MoreHorizontal, Info, BookOpen } from 'lucide-react';
import { LazyLogo } from './LazyLogo';
import { LazyGoalProgress } from './LazyGoalProgress';

interface HeaderProps {
  onOpenAbout: () => void;
  onOpenRules: () => void;
  onOpenChallenge: () => void;
  onOpenAdmin: () => void;
  onLogoClick: () => void;
  liveStats?: LiveStats | null;
  onOpenLiveStats?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAbout,
  onOpenRules,
  onOpenChallenge,
  onOpenAdmin,
  onLogoClick,
  liveStats,
  onOpenLiveStats,
  onOpenSettings
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e8dfd3] bg-[#fbf9f5]/95 backdrop-blur-md">
      {/* ========================================================================= */}
      {/* ROW 1: BRAND IDENTITY + VIRAL CHALLENGE ACTION                            */}
      {/* Desktop (sm+): houses Brand on left, Period Tabs in center, Challenge CTA */}
      {/* Mobile (<sm): dedicated Row 1 with Brand on left and Challenge CTA on right */}
      {/* ========================================================================= */}
      <div className="mx-auto max-w-[1140px] px-3.5 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand / Logo + PAY-TO-RANK */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button
            id="brand-logo-btn"
            onClick={onLogoClick}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none select-none shrink-0"
            aria-label="LAZY Home"
          >
            {/* The LAZY brand is always visible and never clipped or truncated */}
            <LazyLogo variant="horizontal" size="sm" className="group-hover:opacity-85 transition-opacity shrink-0" />
            <span className="inline-block text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-[#fae7dc] text-[#913813] border border-[#f2cfbd] shrink-0">
              PAY-TO-RANK
            </span>
          </button>
        </div>

        {/* Center: Semantic link to Leaderboard */}
        <div className="hidden sm:flex items-center gap-2">
          <a
            href="/#leaderboard-section"
            className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-xs font-bold text-stone-800 transition-colors"
          >
            All-Time Leaderboard
          </a>
        </div>

        {/* Right: Primary Viral Action (Challenge CTA) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="header-challenge-btn"
            type="button"
            onClick={onOpenChallenge}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 min-h-[34px] sm:min-h-[36px] rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white font-black text-xs tracking-tight shadow-xs transition-all active:scale-95 cursor-pointer select-none shrink-0"
          >
            <Swords className="w-3.5 h-3.5 shrink-0" />
            <span>Challenge</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 3 (Desktop Row 2 / Mobile Row 3): QUIET SECONDARY UTILITY & STATUS    */}
      {/* Intentionally calmed & subdued: low-contrast text, unobtrusive indicators */}
      {/* Does not compete with the primary leaderboard period navigation           */}
      {/* ========================================================================= */}
      <div
        id="header-secondary-utility-row"
        className="border-t border-[#eee6dc]/70 bg-[#f6f2ea]/60 px-3.5 sm:px-6 lg:px-8 py-0.5 transition-colors"
      >
        <div className="mx-auto max-w-[1140px] flex items-center justify-between gap-2 sm:gap-3 text-[10.5px] text-stone-400">
          {/* Left: Quiet Live Activity Telemetry & Daily Goal */}
          <div className="flex items-center gap-2 sm:gap-2.5 truncate min-w-0">
            {/* Live Stats indicator - soft, muted presence */}
            <div className="flex items-center gap-1.5 text-stone-500 font-normal shrink-0">
              <span className="relative flex h-1.5 w-1.5 shrink-0 opacity-80">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-stone-600 font-mono-numbers">
                {liveStats?.online || 1}
              </span>
              <span>online</span>
              <span className="text-stone-300/80">·</span>
              <span className="font-semibold text-stone-600 font-mono-numbers">
                {liveStats?.visitsToday || 1}
              </span>
              <span className="hidden xs:inline">visits today</span>
              {onOpenLiveStats && (
                <>
                  <span className="text-stone-300/80">·</span>
                  <button
                    type="button"
                    id="secondary-live-stats-btn"
                    onClick={onOpenLiveStats}
                    className="font-normal text-stone-500 hover:text-stone-700 transition-colors cursor-pointer underline underline-offset-2 decoration-stone-300"
                  >
                    Live stats
                  </button>
                </>
              )}
            </div>

            <span className="text-stone-300/70 hidden sm:inline">|</span>

            {/* Daily Lazy Goal Progress Circle (Desktop placement) */}
            <div className="hidden sm:inline-flex items-center opacity-85 hover:opacity-100 transition-opacity">
              <LazyGoalProgress onOpenChallenge={onOpenChallenge} compact />
            </div>
          </div>

          {/* Right: Subdued Utility Navigation Links */}
          <div className="flex items-center gap-2 sm:gap-3 text-stone-400 text-[10.5px] font-normal shrink-0">
            {/* Desktop view (>640px): calm, low-contrast text links */}
            <div className="hidden sm:flex items-center gap-2.5">
              <button
                type="button"
                id="nav-about-btn"
                onClick={onOpenAbout}
                className="hover:text-stone-700 transition-colors cursor-pointer"
              >
                About
              </button>
              <span className="text-stone-300/70">·</span>
              <button
                type="button"
                id="nav-rules-btn"
                onClick={onOpenRules}
                className="hover:text-stone-700 transition-colors cursor-pointer"
              >
                Rules
              </button>
              {onOpenSettings && (
                <>
                  <span className="text-stone-300/70">·</span>
                  <button
                    type="button"
                    id="header-settings-btn"
                    onClick={onOpenSettings}
                    title="User Settings"
                    className="hover:text-stone-700 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Sliders className="w-2.5 h-2.5 text-stone-400" />
                    <span>Settings</span>
                  </button>
                </>
              )}
              <span className="text-stone-300/70">·</span>
              <button
                type="button"
                id="header-admin-btn"
                onClick={onOpenAdmin}
                title="Server-Verified Safety & Admin Verification"
                className="hover:text-stone-700 text-stone-400 transition-colors cursor-pointer flex items-center gap-1"
              >
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600/70" />
                <span>Safety</span>
              </button>
            </div>

            {/* Mobile view (<640px): Compact Goal Badge + Subdued Overflow Button */}
            <div className="flex sm:hidden items-center gap-1.5" ref={mobileMenuRef}>
              <div className="opacity-90 hover:opacity-100 transition-opacity">
                <LazyGoalProgress onOpenChallenge={onOpenChallenge} compact />
              </div>

              <div className="relative">
                <button
                  type="button"
                  id="mobile-utility-overflow-btn"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-expanded={isMobileMenuOpen}
                  aria-label="More options (About, Rules, Settings, Safety)"
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/40 active:bg-stone-200/70 transition-colors cursor-pointer flex items-center justify-center"
                  title="More utility options"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>

                {/* Mobile Overflow Menu Dropdown */}
                {isMobileMenuOpen && (
                  <div
                    id="mobile-utility-dropdown"
                    className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-white border border-[#e4dcce] shadow-lg p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5 text-xs text-stone-700"
                  >
                    <button
                      type="button"
                      id="mobile-overflow-about-btn"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenAbout();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-stone-100 text-stone-800 font-semibold text-left transition-colors cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5 text-stone-500" />
                      <span>About LAZY</span>
                    </button>

                    <button
                      type="button"
                      id="mobile-overflow-rules-btn"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenRules();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-stone-100 text-stone-800 font-semibold text-left transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                      <span>Rules & Proof</span>
                    </button>

                    {onOpenSettings && (
                      <button
                        type="button"
                        id="mobile-overflow-settings-btn"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onOpenSettings();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-stone-100 text-stone-800 font-semibold text-left transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-stone-600" />
                        <span>Settings</span>
                      </button>
                    )}

                    <button
                      type="button"
                      id="mobile-overflow-safety-btn"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-stone-100 text-stone-800 font-semibold text-left transition-colors cursor-pointer border-t border-stone-100 pt-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Safety & Moderation</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

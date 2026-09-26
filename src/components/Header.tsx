import React, { useState, useRef, useEffect } from 'react';
import { LiveStats } from '../types.ts';
import { Swords, Sliders, MoreHorizontal, Info, BookOpen, Sparkles } from 'lucide-react';
import { LazyLogo } from './LazyLogo';
import { LazyGoalProgress } from './LazyGoalProgress';
import { LEGAL_CONFIG } from '../config/legal.ts';

interface HeaderProps {
  onOpenAbout: () => void;
  onOpenRules: () => void;
  onOpenChallenge: () => void;
  onOpenAdmin: () => void;
  onLogoClick: () => void;
  liveStats?: LiveStats | null;
  onOpenLiveStats?: () => void;
  onOpenSettings?: () => void;
  currencyMode?: 'INR' | 'USD';
  onToggleCurrency?: () => void;
  onOpenClaim?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAbout,
  onOpenRules,
  onOpenChallenge,
  onOpenAdmin,
  onLogoClick,
  liveStats,
  onOpenLiveStats,
  onOpenSettings,
  currencyMode = 'INR',
  onToggleCurrency,
  onOpenClaim
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
    <header className="sticky top-0 z-40 w-full border-b border-[#e8dfd3] bg-[#faf7f2]/95 backdrop-blur-md">
      {/* ROW 1: BRAND IDENTITY + CURRENCY SWITCH + PRIMARY ACTIONS */}
      <div className="mx-auto max-w-[1140px] px-3.5 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand / Logo + Sponsored Showcase */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button
            id="brand-logo-btn"
            onClick={onLogoClick}
            className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none select-none shrink-0"
            aria-label={`${LEGAL_CONFIG.BRAND_NAME} Home`}
          >
            <LazyLogo variant="horizontal" size="sm" className="group-hover:opacity-85 transition-opacity shrink-0" />
            <span className="hidden sm:inline-block text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#f2ede4] text-stone-700 border border-[#e4dcce] shrink-0">
              Sponsored Showcase
            </span>
          </button>
        </div>

        {/* Center: Desktop Navigation & Links */}
        <nav aria-label="Desktop primary" className="hidden md:flex items-center gap-2">
          <a
            href="/#leaderboard-section"
            className="px-3 py-1.5 rounded-xl hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors"
          >
            Leaderboard
          </a>
          <button
            type="button"
            onClick={onOpenAbout}
            className="px-3 py-1.5 rounded-xl hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors cursor-pointer"
          >
            About
          </button>
          <button
            type="button"
            onClick={onOpenRules}
            className="px-3 py-1.5 rounded-xl hover:bg-stone-100 text-xs font-bold text-stone-700 transition-colors cursor-pointer"
          >
            Rules
          </button>
        </nav>

        {/* Right: Currency Toggle + Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Currency Mode Switch: INR / USD display toggle */}
          {onToggleCurrency && (
            <div className="flex items-center bg-[#ede5db] p-0.5 rounded-xl text-[11px] font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => currencyMode !== 'INR' && onToggleCurrency()}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  currencyMode === 'INR'
                    ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Display in Indian Rupees (Canonical payment currency)"
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => currencyMode !== 'USD' && onToggleCurrency()}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  currencyMode === 'USD'
                    ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Illustrative display (~$1 = ₹85). All checkouts processed in INR."
              >
                ~$ USD
              </button>
            </div>
          )}

          {/* Claim Rank CTA (if drawer trigger provided) */}
          {onOpenClaim && (
            <button
              type="button"
              onClick={onOpenClaim}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-extrabold text-xs tracking-tight shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Claim Rank</span>
            </button>
          )}

          {/* Primary Viral Action (Challenge CTA) */}
          <button
            id="header-challenge-btn"
            type="button"
            onClick={onOpenChallenge}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 min-h-[34px] sm:min-h-[36px] rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white font-black text-xs tracking-tight shadow-xs transition-all active:scale-95 cursor-pointer select-none shrink-0"
          >
            <Swords className="w-3.5 h-3.5 shrink-0" />
            <span>Challenge</span>
          </button>

          {/* Settings / Overflow for mobile & desktop */}
          <div className="relative" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 sm:p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label="More navigation options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMobileMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-stone-200 shadow-lg py-1.5 z-50 text-xs font-semibold text-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAbout();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-stone-500" />
                  <span>About LazyProof</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenRules();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                  <span>Rules &amp; Verification</span>
                </button>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2 cursor-pointer border-t border-stone-100"
                  >
                    <Sliders className="w-3.5 h-3.5 text-stone-500" />
                    <span>My Profile &amp; Settings</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-stone-50 flex items-center gap-2 cursor-pointer text-stone-400 hover:text-stone-600 text-[11px]"
                >
                  <span>Operator Login</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 2: QUIET SECONDARY UTILITY & STATUS */}
      <div
        id="header-secondary-utility-row"
        className="mx-auto max-w-[1140px] px-3.5 sm:px-6 lg:px-8 h-8 sm:h-9 flex items-center justify-between border-t border-[#f0eae1] text-[11px] text-stone-500"
      >
        {/* Left: Live Status & Goal */}
        <div className="flex items-center gap-2 sm:gap-3">
          {liveStats && (
            <button
              type="button"
              onClick={onOpenLiveStats}
              className="inline-flex items-center gap-1.5 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
              title="Verified platform activity"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold">{liveStats.online}</span>
              <span className="text-stone-400">online</span>
            </button>
          )}
          <span className="text-stone-300">·</span>
          <LazyGoalProgress onOpenChallenge={onOpenChallenge} compact={true} />
        </div>

        {/* Right: Explicit Illustrative Currency Disclosure */}
        <div className="text-[10px] text-stone-400 hidden sm:block">
          {currencyMode === 'USD' ? (
            <span>*USD display calculated at fixed illustrative rate ₹85/$1. All checkout processed in INR.</span>
          ) : (
            <span>Public ranking verified via secure INR payment.</span>
          )}
        </div>
      </div>
    </header>
  );
};

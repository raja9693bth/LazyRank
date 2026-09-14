import React, { useState, useEffect, useRef } from 'react';
import { Target, Swords, Check, Sparkles, Flame, X, ChevronRight, Share2, Award } from 'lucide-react';
import { getDailyGoal, recordNominationGoal, DailyGoalStatus } from '../utils/dailyGoal';

interface LazyGoalProgressProps {
  onOpenChallenge: () => void;
  compact?: boolean;
}

export const LazyGoalProgress: React.FC<LazyGoalProgressProps> = ({ onOpenChallenge, compact = false }) => {
  const [goal, setGoal] = useState<DailyGoalStatus>(getDailyGoal);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync state on mount and on custom event
  useEffect(() => {
    const update = () => setGoal(getDailyGoal());
    update();

    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent<DailyGoalStatus>;
      if (custom.detail) {
        setGoal(custom.detail);
      } else {
        update();
      }
    };

    window.addEventListener('lazy_daily_goal_updated', handleCustomEvent);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener('lazy_daily_goal_updated', handleCustomEvent);
      window.removeEventListener('storage', update);
    };
  }, []);

  // Handle click outside to close popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const { count, target, completed, streakDays } = goal;
  const clampedCount = Math.min(count, target);
  const percentage = Math.round((clampedCount / target) * 100);

  // SVG circular calculation (r = 10 -> circumference = 2 * PI * 10 = ~62.83)
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Larger SVG circular calculation for popover (r = 26 -> circumference = ~163.36)
  const bigRadius = 26;
  const bigCircumference = 2 * Math.PI * bigRadius;
  const bigStrokeDashoffset = bigCircumference - (percentage / 100) * bigCircumference;

  const handleActionClick = () => {
    setIsOpen(false);
    onOpenChallenge();
  };

  return (
    <div className="relative inline-block text-left">
      {/* Small Header Progress Circle Button */}
      <button
        ref={buttonRef}
        id="header-lazy-goal-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Daily Lazy Goal: Nominate 3 friends today (${count} of ${target} completed)`}
        title={`Daily Lazy Goal: Nominate 3 friends today (${count}/${target} completed)`}
        className={
          compact
            ? `group flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer select-none text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 ${
                completed
                  ? 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200/80 text-emerald-900'
                  : count > 0
                  ? 'bg-amber-50/60 hover:bg-amber-100/60 border-amber-200/70 text-amber-950'
                  : 'bg-transparent hover:bg-stone-200/50 border-stone-200/80 text-stone-600'
              }`
            : `group flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-full border transition-all cursor-pointer active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-1 ${
                completed
                  ? 'bg-emerald-50/90 hover:bg-emerald-100/90 border-emerald-300 text-emerald-950 shadow-2xs'
                  : count > 0
                  ? 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-300/80 text-amber-950 shadow-2xs'
                  : 'bg-white hover:bg-stone-50 border-[#ede5da] text-stone-700 shadow-2xs'
              }`
        }
      >
        {/* Circular SVG Ring */}
        <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
          <svg
            className="w-6 h-6 -rotate-90 transform"
            viewBox="0 0 28 28"
            aria-hidden="true"
          >
            {/* Background Track */}
            <circle
              cx="14"
              cy="14"
              r={radius}
              stroke="currentColor"
              strokeWidth="2.8"
              className={
                completed
                  ? 'text-emerald-200'
                  : count > 0
                  ? 'text-amber-200'
                  : 'text-stone-200'
              }
              fill="none"
            />
            {/* Active Progress */}
            <circle
              cx="14"
              cy="14"
              r={radius}
              stroke="currentColor"
              strokeWidth="2.8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`transition-all duration-500 ease-out ${
                completed
                  ? 'text-emerald-600'
                  : count > 0
                  ? 'text-[#e86638]'
                  : 'text-stone-400'
              }`}
              fill="none"
            />
          </svg>

          {/* Center Content in Circle */}
          <div className="absolute inset-0 flex items-center justify-center">
            {completed ? (
              <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
            ) : (
              <span className="text-[9px] font-extrabold tracking-tighter text-stone-800">
                {count}
              </span>
            )}
          </div>
        </div>

        {/* Text Label on Desktop / Tablet */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold tracking-tight">
          {completed ? (
            <span className="text-emerald-800 flex items-center gap-1 font-extrabold">
              <span>Goal Met</span>
              <span className="text-[9px]">🎉</span>
            </span>
          ) : (
            <div className="flex items-center gap-1 text-stone-700">
              <span className="text-stone-500 font-medium">Goal:</span>
              <span className="font-extrabold text-stone-900 font-mono-numbers">
                {count}/{target}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          ref={popoverRef}
          id="lazy-goal-popover"
          role="dialog"
          aria-label="Daily Lazy Goal details"
          className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 mt-2 w-80 max-w-[92vw] sm:w-84 rounded-2xl bg-white p-4 sm:p-5 shadow-2xl border border-stone-200/90 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg ${
                  completed
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-[#b44b1c]'
                }`}
              >
                {completed ? (
                  <Sparkles className="w-4 h-4" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900">
                  Daily Lazy Goal
                </h3>
                <p className="text-[10px] text-stone-500 font-medium">
                  {completed
                    ? 'Daily milestone achieved!'
                    : 'Personal daily engagement target'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
              aria-label="Close goal dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Center Radial Progress & Goal Description */}
          <div className="py-4 flex items-center gap-4">
            {/* Big Progress Circle */}
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg
                className="w-16 h-16 -rotate-90 transform"
                viewBox="0 0 64 64"
                aria-hidden="true"
              >
                <circle
                  cx="32"
                  cy="32"
                  r={bigRadius}
                  stroke="currentColor"
                  strokeWidth="5"
                  className={completed ? 'text-emerald-100' : 'text-stone-100'}
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={bigRadius}
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeDasharray={bigCircumference}
                  strokeDashoffset={bigStrokeDashoffset}
                  strokeLinecap="round"
                  className={`transition-all duration-700 ease-out ${
                    completed
                      ? 'text-emerald-600'
                      : count > 0
                      ? 'text-[#e86638]'
                      : 'text-stone-300'
                  }`}
                  fill="none"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {completed ? (
                  <Check className="w-6 h-6 text-emerald-600 stroke-[3]" />
                ) : (
                  <>
                    <span className="text-base font-black text-stone-900 font-mono-numbers leading-none">
                      {count}
                    </span>
                    <span className="text-[9px] font-bold text-stone-400 leading-none mt-0.5">
                      of {target}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Goal Text & Subtitle */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-1 bg-[#fae7dc] text-[#913813] border border-[#f2cfbd]">
                <span>🎯 Nominate 3 Friends Today</span>
              </div>
              <p className="text-xs font-bold text-stone-800 leading-snug">
                {completed
                  ? 'All 3 friends nominated!'
                  : `${target - clampedCount} more nomination${
                      target - clampedCount === 1 ? '' : 's'
                    } to complete today's goal.`}
              </p>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                Dare your friends to beat your laziness legitimacy. Provoking competition unlocks viral bragging rights!
              </p>
            </div>
          </div>

          {/* Milestone Step Indicators */}
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-stone-50 border border-stone-200/70 text-center">
            {[1, 2, 3].map((step) => {
              const isDone = count >= step;
              const nomination = goal.nominations?.[step - 1];
              return (
                <div
                  key={step}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    isDone
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      : 'bg-white border-stone-200/80 text-stone-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {isDone ? (
                      <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 inline-block" />
                    )}
                    <span className="text-[10px] font-bold">Friend {step}</span>
                  </div>
                  <span className="text-[9px] truncate block max-w-full text-stone-600 font-medium">
                    {isDone ? nomination?.name || 'Nominated' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Motivational Incentive Footer */}
          <div className="mt-3 text-center">
            <button
              type="button"
              id="popover-nominate-friend-btn"
              onClick={handleActionClick}
              aria-label={completed ? 'Nominate another friend' : 'Nominate a friend for daily goal'}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-extrabold text-xs transition-all active:scale-98 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                completed
                  ? 'bg-stone-900 hover:bg-stone-800 text-white'
                  : 'bg-[#e86638] hover:bg-[#d8582b] text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>
                {completed ? 'Nominate Another Friend' : 'Nominate a Friend (+1)'}
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="mt-2 flex items-center justify-between text-[10px] text-stone-400 px-1">
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" />
                <span className="font-semibold text-stone-600">
                  {streakDays} Day Streak
                </span>
              </span>
              <span>Refreshes at midnight</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

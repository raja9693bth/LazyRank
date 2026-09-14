import React, { useState, useEffect } from 'react';
import { Clock, Flame, Crown, ArrowRight, Info, ShieldAlert, Sparkles } from 'lucide-react';

export interface TodayResetCountdownProps {
  onClaimClick?: () => void;
  topParticipantName?: string;
  topParticipantAmount?: number;
  onReset?: () => void;
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * Calculates the exact millisecond timestamp of the next Today leaderboard reset.
 * Authoritatively aligned with Indian Standard Time (IST, UTC+05:30) midnight (00:00:00 IST),
 * matching the server-side LazyDatabase.getPeriodCutoff('today').
 */
export function getNextTodayResetTime(): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  const nowIst = new Date(nowUtc + IST_OFFSET_MS);

  // Next midnight in IST calendar
  const nextMidnightUtc =
    Date.UTC(
      nowIst.getUTCFullYear(),
      nowIst.getUTCMonth(),
      nowIst.getUTCDate() + 1,
      0,
      0,
      0,
      0
    ) - IST_OFFSET_MS;

  return nextMidnightUtc;
}

export const TodayResetCountdown: React.FC<TodayResetCountdownProps> = ({
  onClaimClick,
  topParticipantName,
  topParticipantAmount,
  onReset,
  variant = 'full',
  className = ''
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  }>(() => calculateTimeLeft());

  const [showInfoModal, setShowInfoModal] = useState(false);

  function calculateTimeLeft() {
    const target = getNextTodayResetTime();
    const diff = Math.max(0, target - Date.now());
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { hours, minutes, seconds, totalSeconds };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining.totalSeconds <= 0 && onReset) {
        onReset();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [onReset]);

  // Is within the final 2 hours? (High urgency stage)
  const isFinalStretch = timeLeft.hours < 2;

  const padZero = (n: number) => n.toString().padStart(2, '0');

  // Compact variant: sleek one-liner
  if (variant === 'compact') {
    return (
      <div
        id="today-reset-countdown-compact"
        data-testid="today-reset-countdown-compact"
        className={`rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs transition-all ${
          isFinalStretch
            ? 'bg-[#fff5ec] border-[#fcd8bf] text-orange-950'
            : 'bg-[#faf8f4] border-[#ebe3d7] text-stone-700'
        } ${className}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 font-bold">
            <Clock className={`w-3.5 h-3.5 shrink-0 ${isFinalStretch ? 'text-orange-600 animate-spin' : 'text-amber-700'}`} />
            <span>{isFinalStretch ? 'Final Stretch:' : "Today's Leaderboard Resets In:"}</span>
          </span>
          <span className="font-mono-numbers font-black tracking-tight text-stone-900 bg-white border border-[#e2d8cb] px-2 py-0.5 rounded-md shadow-2xs">
            {padZero(timeLeft.hours)}h : {padZero(timeLeft.minutes)}m : {padZero(timeLeft.seconds)}s
          </span>
          <span className="text-[10px] text-stone-400 hidden sm:inline">(12:00 AM IST)</span>
        </div>

        <div className="flex items-center gap-2">
          {onClaimClick && (
            <button
              type="button"
              onClick={onClaimClick}
              aria-label={isFinalStretch ? 'Beat rank #1 before today resets' : 'Claim a rank on today leaderboard'}
              className="font-bold text-xs text-stone-900 hover:text-orange-600 inline-flex items-center gap-1 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-md"
            >
              <span>{isFinalStretch ? 'Beat #1 Now' : 'Claim Rank'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full variant: rich anticipation & daily participation card
  return (
    <div
      id="today-reset-countdown"
      data-testid="today-reset-countdown"
      className={`rounded-2xl border transition-all ${
        isFinalStretch
          ? 'bg-[#fff5ec] border-[#fcd8bf] shadow-sm'
          : 'bg-[#faf8f4] border-[#ebe3d7] shadow-2xs'
      } p-3.5 sm:p-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Indicator & Status Text */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isFinalStretch
                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                  : 'bg-amber-100/80 text-amber-900 border border-amber-200/80'
              }`}
            >
              <Clock className={`w-3 h-3 ${isFinalStretch ? 'text-orange-600 animate-spin' : 'text-amber-700'}`} />
              <span>{isFinalStretch ? 'FINAL STRETCH' : "TODAY'S CROWN RESET"}</span>
            </span>

            <span className="text-[11px] font-bold text-stone-500">
              Resets at 12:00 AM IST
            </span>

            <button
              type="button"
              onClick={() => setShowInfoModal(!showInfoModal)}
              className="text-stone-400 hover:text-stone-700 transition-colors p-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-md"
              title="How does the daily reset work?"
              aria-label="Daily reset details"
              aria-expanded={showInfoModal}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-stone-600 font-medium">
            {topParticipantName ? (
              <span>
                <strong className="text-stone-900 font-bold">{topParticipantName}</strong> leads today with{' '}
                <strong className="font-mono-numbers text-stone-900">
                  ₹{topParticipantAmount?.toLocaleString('en-IN')}
                </strong>
                . Winner locks the daily title & Lazy Streak.
              </span>
            ) : (
              <span>Whoever holds #1 at midnight locks the daily crown & verified Hall of Fame record.</span>
            )}
          </p>
        </div>

        {/* Right: Digital Countdown Blocks & Beat Action */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 self-start sm:self-auto">
          {/* Digits Container */}
          <div className="flex items-center gap-1 sm:gap-1.5 font-mono-numbers text-center">
            {/* Hours Block */}
            <div className="flex flex-col items-center">
              <div className="bg-white border border-[#e2d8cb] rounded-xl px-2 sm:px-2.5 py-1 text-sm sm:text-base font-black text-stone-900 shadow-2xs min-w-[36px] sm:min-w-[40px]">
                {padZero(timeLeft.hours)}
              </div>
              <span className="text-[9px] font-extrabold text-stone-400 tracking-wider mt-0.5">HRS</span>
            </div>

            <span className="text-stone-400 font-black text-base -mt-3.5">:</span>

            {/* Minutes Block */}
            <div className="flex flex-col items-center">
              <div className="bg-white border border-[#e2d8cb] rounded-xl px-2 sm:px-2.5 py-1 text-sm sm:text-base font-black text-stone-900 shadow-2xs min-w-[36px] sm:min-w-[40px]">
                {padZero(timeLeft.minutes)}
              </div>
              <span className="text-[9px] font-extrabold text-stone-400 tracking-wider mt-0.5">MIN</span>
            </div>

            <span className="text-stone-400 font-black text-base -mt-3.5">:</span>

            {/* Seconds Block */}
            <div className="flex flex-col items-center">
              <div
                className={`bg-white border rounded-xl px-2 sm:px-2.5 py-1 text-sm sm:text-base font-black shadow-2xs min-w-[36px] sm:min-w-[40px] ${
                  isFinalStretch ? 'border-orange-300 text-orange-600' : 'border-[#e2d8cb] text-stone-900'
                }`}
              >
                {padZero(timeLeft.seconds)}
              </div>
              <span className="text-[9px] font-extrabold text-stone-400 tracking-wider mt-0.5">SEC</span>
            </div>
          </div>

          {/* Claim Before Reset Action Button */}
          {onClaimClick && (
            <button
              type="button"
              id="countdown-claim-btn"
              onClick={onClaimClick}
              aria-label={isFinalStretch ? 'Beat rank #1 before today resets' : 'Claim a rank on today leaderboard'}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 ${
                isFinalStretch
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-stone-900 hover:bg-stone-800 text-white'
              }`}
            >
              <span>{isFinalStretch ? 'Beat #1 Now' : 'Claim Rank'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Explanation Explainer */}
      {showInfoModal && (
        <div className="mt-3 pt-3 border-t border-[#ede3d5] text-xs text-stone-600 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-bold text-stone-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>How Daily Leaderboard Resets Work</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-stone-600">
            <li>
              <strong>Midnight (12:00 AM IST)</strong>: Today's ranks lock in. The #1 rank holder permanently earns the <em>Daily Champion</em> badge in their profile history.
            </li>
            <li>
              <strong>Lazy Streak Progression</strong>: Top 10 participants at reset advance their daily streak (+1 day), defending their position on the Hall of Fame.
            </li>
            <li>
              <strong>All-Time Board Unaffected</strong>: All-time rankings, total amounts, and lifetime verified stats remain permanent and never reset.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

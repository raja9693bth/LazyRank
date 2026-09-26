import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, getLazyReasonEmoji } from '../types.ts';
import { ShareCardPreview, CardTemplateType } from './ShareCardPreview.tsx';
import { safeWebsiteUrl, safeLinkedInUrl, safeInstagramUrl, safeTwitterUrl } from './ProfileCard.tsx';
import {
  Share2,
  Copy,
  Check,
  ArrowLeft,
  Flame,
  Instagram,
  Linkedin,
  Globe,
  Trophy,
  ShieldCheck,
  PlusCircle,
  Swords,
  RotateCw,
  Sparkles,
  Bell,
  Eye,
  TrendingUp,
  Crown,
  Target,
  History,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Timer,
  Info,
  Tag,
  Lock
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import confetti from 'canvas-confetti';

interface ResultViewProps {
  profile: UserProfile;
  isNewClaim?: boolean;
  topProfile?: UserProfile | null;
  topAmount?: number;
  nextRankProfile?: UserProfile | null;
  minAmountToBeatTop?: number;
  onBackToLeaderboard: () => void;
  onOpenChallenge: (targetRank?: number, initialTab?: 'challenge' | 'notify' | 'reason', defaultName?: string) => void;
  onUpgradeRank: (profile: UserProfile) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  profile,
  isNewClaim = false,
  topProfile,
  topAmount,
  nextRankProfile,
  minAmountToBeatTop,
  onBackToLeaderboard,
  onOpenChallenge,
  onUpgradeRank,
  onProfileUpdated
}) => {
  const [activeTemplate, setActiveTemplate] = useState<CardTemplateType>('clean_white');
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [showTopShareTooltip, setShowTopShareTooltip] = useState(false);

  // AI Lazy Roast State
  const [roast, setRoast] = useState<string>(profile.roast || '');
  const [isGeneratingRoast, setIsGeneratingRoast] = useState(false);
  const [copiedRoast, setCopiedRoast] = useState(false);
  const [includeRoastOnCard, setIncludeRoastOnCard] = useState(true);

  const fetchRoast = async (force = false) => {
    if (isGeneratingRoast) return;
    setIsGeneratingRoast(true);
    try {
      let storedToken: string | undefined;
      try {
        const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
        storedToken = tokens[profile.id];
      } catch {}

      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedToken ? { 'x-profile-token': storedToken } : {})
        },
        body: JSON.stringify({ profileId: profile.id, forceRegenerate: force })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.roast) {
          setRoast(data.roast);
        }
      }
    } catch {
      // Fallback handled gracefully
    } finally {
      setIsGeneratingRoast(false);
    }
  };

  // Canvas-based full celebration explosion effect for claims and rank climbs
  const triggerCelebration = (forceExplosion: boolean = false) => {
    try {
      // If it's a new claim / higher rank or explicitly triggered, fire the grand explosion
      const isGrand = isNewClaim || forceExplosion || profile.rank === 1;

      if (isGrand) {
        // Stage 1: Big central firework explosion
        confetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.55 },
          colors: ['#e86638', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#fbbf24', '#ffffff'],
          startVelocity: 45,
          scalar: 1.2,
          disableForReducedMotion: true
        });

        // Stage 2: Left angled burst
        setTimeout(() => {
          confetti({
            particleCount: 65,
            angle: 55,
            spread: 70,
            origin: { x: 0.1, y: 0.65 },
            colors: ['#e86638', '#f59e0b', '#fbbf24', '#ffffff'],
            startVelocity: 50,
            scalar: 1.1,
            disableForReducedMotion: true
          });
        }, 150);

        // Stage 3: Right angled burst
        setTimeout(() => {
          confetti({
            particleCount: 65,
            angle: 125,
            spread: 70,
            origin: { x: 0.9, y: 0.65 },
            colors: ['#10b981', '#6366f1', '#ec4899', '#ffffff'],
            startVelocity: 50,
            scalar: 1.1,
            disableForReducedMotion: true
          });
        }, 300);

        // Stage 4: Top gold/amber shower for #1 or top ranks
        if (profile.rank <= 3) {
          setTimeout(() => {
            confetti({
              particleCount: 50,
              spread: 120,
              origin: { y: 0.2 },
              gravity: 0.9,
              colors: ['#ffd700', '#f59e0b', '#ffffff'],
              scalar: 1.3,
              disableForReducedMotion: true
            });
          }, 500);
        }
      } else {
        // Standard gentle celebration for profile inspection
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#e86638', '#f59e0b', '#10b981', '#6366f1'],
          disableForReducedMotion: true
        });
      }
    } catch {
      // Confetti fallback
    }
  };

  useEffect(() => {
    // Detect if this is a first-time new higher rank claim
    let isFirstTimeHigherRank = isNewClaim;
    try {
      const storageKey = 'lazy_highest_claimed_rank';
      const prevHighestStr = localStorage.getItem(storageKey);
      const prevHighestRank = prevHighestStr ? parseInt(prevHighestStr, 10) : null;

      if (isNewClaim) {
        // If no previous highest or current rank is better (lower numerical rank)
        if (prevHighestRank === null || profile.rank < prevHighestRank) {
          isFirstTimeHigherRank = true;
          localStorage.setItem(storageKey, String(profile.rank));
        }
      }
    } catch {
      // LocalStorage access safe fallback
    }

    // Trigger the grand confetti explosion automatically
    triggerCelebration(isFirstTimeHigherRank);

    // Auto-fetch roast if not already present on profile
    if (!profile.roast && profile.id) {
      fetchRoast(false);
    }
  }, [profile.id, isNewClaim]);

  // Rank Progression States & Live Target Discovery
  const [progressTarget, setProgressTarget] = useState<'next' | 'top1'>(
    profile.rank <= 2 ? 'top1' : 'next'
  );
  const [fetchedNextRankAmount, setFetchedNextRankAmount] = useState<number | null>(null);
  const [fetchedNextRankName, setFetchedNextRankName] = useState<string | null>(null);
  const [fetchedTopAmount, setFetchedTopAmount] = useState<number | null>(null);
  const [fetchedTopName, setFetchedTopName] = useState<string | null>(null);
  const [fetchedSecondAmount, setFetchedSecondAmount] = useState<number | null>(null);
  const [fetchedSecondName, setFetchedSecondName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard?period=all&offset=0&limit=50&filter=all')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.profiles)) {
          const topP = data.profiles.find((p: UserProfile) => p.rank === 1);
          if (topP) {
            setFetchedTopAmount(topP.amount);
            setFetchedTopName(topP.name);
          }
          const secondP = data.profiles.find((p: UserProfile) => p.rank === 2);
          if (secondP) {
            setFetchedSecondAmount(secondP.amount);
            setFetchedSecondName(secondP.name);
          }
          if (profile.rank > 1) {
            const nextP = data.profiles.find((p: UserProfile) => p.rank === profile.rank - 1);
            if (nextP) {
              setFetchedNextRankAmount(nextP.amount);
              setFetchedNextRankName(nextP.name);
            }
          }
        }
      })
      .catch(() => {});
  }, [profile.rank, profile.amount]);

  const isRankOne = profile.rank === 1;

  // Next rank target metrics
  const nextTargetRank = Math.max(1, profile.rank - 1);
  const nextProfileName = nextRankProfile?.name || fetchedNextRankName || `Rank #${nextTargetRank}`;
  const baseNextAmount = nextRankProfile?.amount ?? fetchedNextRankAmount ?? (profile.amount + 20);
  const amountToBeatNext = baseNextAmount + 1;
  const diffToNext = Math.max(1, amountToBeatNext - profile.amount);
  const percentToNext = Math.min(99, Math.max(8, Math.round((profile.amount / amountToBeatNext) * 100)));

  // Top 1 Crown target metrics
  const topProfileName = topProfile?.name || fetchedTopName || 'The Sloth King';
  const baseTopAmount = topProfile?.amount ?? topAmount ?? fetchedTopAmount ?? 5001;
  const amountToBeatTop = baseTopAmount + 1;
  const diffToTop = Math.max(1, amountToBeatTop - profile.amount);
  const percentToTop = isRankOne ? 100 : Math.min(99, Math.max(5, Math.round((profile.amount / amountToBeatTop) * 100)));

  // Lead metrics for #1
  const secondAmount = fetchedSecondAmount || 5001;
  const secondName = fetchedSecondName || 'Runner-up';
  const leadOverSecond = Math.max(0, profile.amount - secondAmount);

  // Rank Trajectory Data from Claim History (for Recharts line chart)
  const trajectoryData = useMemo(() => {
    if (!profile.claimHistory || profile.claimHistory.length < 2) return [];

    return profile.claimHistory.map((item, idx) => {
      const d = new Date(item.timestamp);
      const formattedDate = isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) +
          ' at ' +
          d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      return {
        id: item.id || `claim-${idx}`,
        claimIndex: idx + 1,
        shortLabel: `Claim #${idx + 1}`,
        rank: item.rank,
        amount: item.amount,
        totalAmount: item.totalAmount,
        note: item.note || (idx === 0 ? 'Initial Claim' : 'Rank Boost'),
        formattedDate
      };
    });
  }, [profile.claimHistory]);

  const hasMultipleClaims = trajectoryData.length >= 2;

  const { minRank, maxRank } = useMemo(() => {
    if (trajectoryData.length === 0) return { minRank: 1, maxRank: 10 };
    const ranks = trajectoryData.map(d => d.rank);
    return {
      minRank: Math.min(...ranks),
      maxRank: Math.max(...ranks)
    };
  }, [trajectoryData]);



  const handleCopyRoast = async () => {
    if (!roast) return;
    try {
      await navigator.clipboard.writeText(`"${roast}"\n\nOfficial Rank #${profile.rank} on LAZY: ${shareUrl}`);
      setCopiedRoast(true);
      setTimeout(() => setCopiedRoast(false), 2000);
    } catch {
      // Fallback
    }
  };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?rank=${profile.id}`
    : `https://lazyproof.online/?rank=${profile.id}`;

  const formattedAmount = `₹${profile.amount.toLocaleString('en-IN')}`;

  // Customized share message including user's rank, claim amount, and the app link
  const customShareMessage = roast
    ? `I paid ${formattedAmount} to prove my laziness on LAZY and claimed Rank #${profile.rank}!\n\n"${roast}"\n\nCan you beat my rank? Check it out here: ${shareUrl}`
    : `I paid ${formattedAmount} to prove my laziness on LAZY and claimed Rank #${profile.rank}!\n\nCan you beat my rank? Check it out here: ${shareUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${customShareMessage}`);
      setCopiedLink(true);
      setShareFeedback('Share details copied to clipboard!');
      setTimeout(() => {
        setCopiedLink(false);
        setShareFeedback(null);
      }, 2500);
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'shareClicks' })
      }).catch(() => {});
    } catch {
      // Fallback
    }
  };

  const handleWebShare = async () => {
    const shareData = {
      title: `LAZY - Rank #${profile.rank} (${formattedAmount})`,
      text: customShareMessage,
      url: shareUrl
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        setShareFeedback('Shared successfully!');
        setTimeout(() => setShareFeedback(null), 2500);
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'shareClicks' })
        }).catch(() => {});
        return;
      } catch (err: any) {
        // Dismissing or cancelling the native share sheet is normal
        if (err?.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback if Web Share API is not supported or encountered an error
    await handleCopyLink();
  };

  return (
    <div id="result-view-container" className="w-full max-w-2xl mx-auto my-6 px-3">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <button
          type="button"
          onClick={onBackToLeaderboard}
          aria-label="Back to Leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leaderboard</span>
        </button>

        <div className="flex items-center gap-2">
          <div
            className="relative"
            onMouseEnter={() => setShowTopShareTooltip(true)}
            onMouseLeave={() => setShowTopShareTooltip(false)}
          >
            <button
              type="button"
              onClick={handleWebShare}
              onFocus={() => setShowTopShareTooltip(true)}
              onBlur={() => setShowTopShareTooltip(false)}
              aria-label="Share your rank and certificate"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
              title="Share via Web Share API"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>

            {/* Top Bar Share Preview Tooltip */}
            <div
              role="tooltip"
              className={`absolute top-full right-0 mt-2 z-40 w-72 p-3 bg-zinc-900 text-white rounded-xl shadow-2xl border border-zinc-800 text-left transition-all duration-150 ${
                showTopShareTooltip
                  ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 scale-95 -translate-y-1 pointer-events-none invisible'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-[11px] font-bold text-zinc-200">
                <span className="flex items-center gap-1 text-amber-400">
                  <Share2 className="w-3 h-3" />
                  <span>Share Preview</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Rank #{profile.rank} • {formattedAmount}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-300 font-sans whitespace-pre-wrap select-all">
                {customShareMessage}
              </p>
              <p className="mt-2 text-[9px] text-zinc-400">Click to trigger native share sheet</p>
            </div>
          </div>

          <span className="text-xs font-mono-numbers text-zinc-400">
            ID: {profile.id}
          </span>
        </div>
      </div>

      {/* Main Result Card */}
      <div className={`mt-5 rounded-2xl border-2 border-zinc-900 bg-white p-6 sm:p-8 shadow-md text-center ${
        isNewClaim ? 'animate-screen-shake' : 'animate-celebration-pop'
      }`}>
        {/* Legitimacy Verified Pill & New Claim Banner */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>LEGITIMACY VERIFIED</span>
          </div>

          {isNewClaim && (
            <div
              id="new-rank-celebration-pill"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-black tracking-wide shadow-xs animate-bounce"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>NEW RANK CLAIMED! 🎉</span>
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 uppercase">
          {isNewClaim ? "You Just Claimed Your Official Rank!" : "You're Officially Lazy."}
        </h1>

        {/* Big Rank Display - Interactive Celebration */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Public lazy rank #${profile.rank}, tap to celebrate with confetti`}
          onClick={() => triggerCelebration(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerCelebration(true);
            }
          }}
          title="Click or press Enter to trigger confetti explosion again!"
          className="my-6 inline-flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-50 border border-zinc-200 min-w-[200px] cursor-pointer hover:scale-102 hover:border-amber-400 hover:shadow-md transition-all group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
            <span>Public Lazy Rank</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500 opacity-75 group-hover:opacity-100 group-hover:rotate-12 transition-all" />
          </div>
          <div className="text-5xl sm:text-6xl font-black font-mono-numbers text-zinc-950 mt-1 flex items-center gap-2">
            {profile.rank === 1 && <Trophy className="w-8 h-8 text-amber-500" />}
            <span>#{profile.rank}</span>
          </div>
          <div className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 group-hover:bg-amber-100 transition-colors">
            ₹{profile.amount.toLocaleString('en-IN')} Paid to Prove It
          </div>

          {/* Live Dynamic Rank Status Pill */}
          <div
            id="rank-expiry-mini-pill"
            data-testid="rank-expiry-mini-badge"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border bg-stone-100 text-stone-700 border-stone-200"
          >
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span>
              Dynamic Rank • Displaced only when out-paid
            </span>
          </div>

          {/* Mini All-Time Rank Indicator Pill */}
          <div
            id="mini-lazy-streak-pill"
            data-testid="mini-lazy-streak-badge"
            className={`mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wide border transition-all ${
              profile.rank <= 10
                ? 'bg-orange-50 text-orange-950 border-orange-200'
                : 'bg-stone-50 text-stone-600 border-stone-200'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${profile.rank <= 10 ? 'text-orange-600 fill-orange-500' : 'text-stone-400'}`} />
            <span>
              {profile.rank <= 10
                ? `All-Time Top 10: Rank #${profile.rank}`
                : `All-Time Rank: #${profile.rank}`}
            </span>
          </div>

          <span className="text-[10px] text-zinc-400 mt-1 font-medium group-hover:text-amber-600 transition-colors">
            Tap or press Enter to celebrate 🎉
          </span>
        </div>

        {/* Profile Name & Confession */}
        <div className="max-w-md mx-auto space-y-2.5">
          <h2 className="text-lg font-extrabold text-zinc-900">
            {profile.name}
          </h2>

          {profile.reason && (
            <p className="text-xs text-zinc-600 italic">
              "{profile.reason}"
            </p>
          )}

          {/* Lazy Reason Badge & Customizer */}
          <div className="pt-1 flex flex-col items-center justify-center gap-1">
            {profile.lazyReason ? (
              <div
                id="result-view-lazy-reason-badge"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold shadow-2xs group"
              >
                <span className="text-base leading-none">
                  {getLazyReasonEmoji(profile.lazyReason)}
                </span>
                <span>
                  Lazy Reason:{' '}
                  <strong className="font-black text-amber-900">{profile.lazyReason}</strong>
                </span>
                <button
                  type="button"
                  id="edit-lazy-reason-btn"
                  onClick={() => onOpenChallenge(profile.rank, 'reason', profile.name)}
                  aria-label="Change your official lazy reason"
                  className="ml-1 text-[11px] font-semibold text-amber-700 hover:text-amber-950 underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 rounded"
                  title="Change your official lazy reason"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="choose-lazy-reason-pill-btn"
                onClick={() => onOpenChallenge(profile.rank, 'reason', profile.name)}
                aria-label="Pick your official lazy reason"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-102 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                <Tag className="w-3.5 h-3.5 text-amber-700" />
                <span>+ Pick Your Official Lazy Reason (Bed Connoisseur, Procrastination Master...)</span>
              </button>
            )}
          </div>

          {/* Social & Website Links */}
          {(() => {
            const igUrl = safeInstagramUrl(profile.instagram);
            const liUrl = safeLinkedInUrl(profile.linkedin);
            const webUrl = safeWebsiteUrl(profile.website);
            const twUrl = safeTwitterUrl(profile.twitter);
            if (!igUrl && !liUrl && !webUrl && !twUrl) return null;

            return (
              <div className="flex items-center justify-center gap-3 pt-2 text-xs text-zinc-600 flex-wrap">
                {igUrl && (
                  <a
                    href={igUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visit Instagram profile"
                    className="inline-flex items-center gap-1 text-zinc-700 hover:text-pink-600 font-medium transition-colors py-0.5 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    <span>Instagram</span>
                  </a>
                )}

                {igUrl && (liUrl || webUrl || twUrl) && (
                  <span className="text-zinc-300">·</span>
                )}

                {liUrl && (
                  <a
                    href={liUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visit LinkedIn profile"
                    className="inline-flex items-center gap-1 text-zinc-700 hover:text-blue-600 font-medium transition-colors py-0.5 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>LinkedIn</span>
                  </a>
                )}

                {liUrl && (webUrl || twUrl) && (
                  <span className="text-zinc-300">·</span>
                )}

                {webUrl && (
                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visit website"
                    className="inline-flex items-center gap-1 text-zinc-700 hover:text-sky-600 font-medium transition-colors py-0.5 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Website</span>
                  </a>
                )}

                {webUrl && twUrl && (
                  <span className="text-zinc-300">·</span>
                )}

                {twUrl && (
                  <a
                    href={twUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Visit X profile"
                    className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-950 font-medium transition-colors py-0.5 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
                  >
                    <span className="font-bold text-xs">𝕏</span>
                    <span>X</span>
                  </a>
                )}
              </div>
            );
          })()}
        </div>

        {/* All-Time Leaderboard Position & Dynamic Ranking Card */}
        <div
          id="rank-expiry-card"
          data-testid="rank-expiry-indicator"
          className="mt-6 p-4 sm:p-5 rounded-2xl border text-left shadow-2xs transition-all relative overflow-hidden bg-white border-stone-200"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-stone-200/80">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl mt-0.5 bg-amber-100 text-amber-800">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-zinc-950 tracking-tight flex items-center gap-1.5">
                  <span>All-Time Leaderboard Standing</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Rankings are strictly determined by cumulative verified sponsorship. Active until outranked.
                </p>
              </div>
            </div>

            <div className="self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Verified All-Time Placement</span>
              </span>
            </div>
          </div>

          {/* Defense & Displacement Notice */}
          <div className="mt-3.5 p-3.5 rounded-xl border border-stone-200 bg-stone-50/80 text-xs leading-relaxed text-stone-700 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <div className="font-extrabold text-[12px] text-zinc-900">
                  {isRankOne
                    ? 'Current #1: All-Time Lead Sponsor'
                    : `Rank #${profile.rank}: All-Time Leaderboard Position`}
                </div>
                <p className="mt-0.5 text-[11px] text-stone-600 leading-normal">
                  {isRankOne
                    ? `You currently hold #1 on LAZY with ₹${profile.amount.toLocaleString('en-IN')}. Anyone who verifies more than ₹${profile.amount.toLocaleString('en-IN')} will push you to #2.`
                    : `Your profile holds permanent placement on the All-Time leaderboard. When another contender verifies a higher payment, positions adjust dynamically in real time according to cumulative settled amount.`}
                </p>
              </div>
            </div>
            <div className="text-[11px] text-stone-500 border-t border-stone-200/60 pt-2 flex items-center justify-between">
              <span>Tie-break rule: Earlier payment verification wins</span>
              <span className="font-semibold text-stone-700">Amount DESC, Verified ASC</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-3.5 pt-3 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => onUpgradeRank(profile)}
              aria-label={isRankOne ? 'Extend your lead on the leaderboard' : `Pay more to climb higher than Rank #${profile.rank}`}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black transition-all active:scale-98 cursor-pointer shadow-2xs min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>
                {isRankOne
                  ? 'Extend Your Lead (Boost)'
                  : 'Pay More to Climb Higher'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenChallenge(profile.rank, 'challenge', profile.name)}
              aria-label="Challenge a friend"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-bold transition-all active:scale-98 cursor-pointer min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 focus-visible:ring-offset-2"
            >
              <Swords className="w-3.5 h-3.5 text-amber-700" />
              <span>Challenge Friend</span>
            </button>
          </div>

          {/* Footer note */}
          <div className="mt-2.5 text-[10px] text-stone-400 flex items-center justify-between flex-wrap gap-1">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3 text-stone-400" />
              <span>Leaderboard integrity: Ranks are deterministic based strictly on verified payment amount</span>
            </span>
          </div>
        </div>

        {/* Visual Progress Bar to Next Rank / Top 1 */}
        <div className="mt-6 text-left">
          <h2 className="text-xs font-black uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-stone-500" />
            <span>Rank Progression & Trajectory</span>
          </h2>
        </div>

        <div id="rank-progress-card" className="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200/90 text-left shadow-2xs">
          {isRankOne ? (
            /* User is #1: Crown Defense view */
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shadow-2xs">
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-zinc-950 flex items-center gap-1.5">
                      <span>Rank #1 Crown Secured</span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-1.5 py-0.2 rounded-full">
                        Apex Position
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Undisputed leader of verified lethargy
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                    100% Locked
                  </span>
                </div>
              </div>

              {/* 100% Progress Track */}
              <div className="w-full bg-zinc-200/70 rounded-full h-3 sm:h-3.5 p-0.5 overflow-hidden border border-zinc-200">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 w-full transition-all duration-700 shadow-xs" />
              </div>

              {/* Margin Info & CTA */}
              <div className="mt-3 pt-2.5 border-t border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-zinc-600">
                  Leading #{2} ({secondName}) by <strong className="text-zinc-950 font-mono font-bold">₹{leadOverSecond.toLocaleString('en-IN')}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onUpgradeRank(profile)}
                  aria-label="Extend your lead on the leaderboard"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-bold transition-all text-xs cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Extend Your Lead</span>
                </button>
              </div>
            </div>
          ) : (
            /* User is Rank > 1: Milestone Progress */
            <div>
              {/* Target Toggle Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-zinc-950 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-zinc-700" />
                    <span>Rank Progression</span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {progressTarget === 'next'
                      ? `Track your path to overtake Rank #${nextTargetRank}`
                      : 'Track your distance to the #1 Crown'}
                  </p>
                </div>

                {/* Tab switcher */}
                <div role="tablist" aria-label="Progression targets" className="inline-flex p-0.5 bg-zinc-200/80 rounded-lg border border-zinc-200 text-xs self-start sm:self-auto">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={progressTarget === 'next'}
                    onClick={() => setProgressTarget('next')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 ${
                      progressTarget === 'next'
                        ? 'bg-white text-zinc-950 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    <span>Next Rank (#{nextTargetRank})</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold">
                      {percentToNext}%
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={progressTarget === 'top1'}
                    onClick={() => setProgressTarget('top1')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 ${
                      progressTarget === 'top1'
                        ? 'bg-white text-zinc-950 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <Crown className="w-3 h-3 text-amber-500" />
                    <span>#1 Crown</span>
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-50 text-amber-800 font-bold">
                      {percentToTop}%
                    </span>
                  </button>
                </div>
              </div>

              {/* Contextual Stats Header */}
              {progressTarget === 'next' ? (
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-800">Your Rank: #{profile.rank}</span>
                    <span className="text-zinc-400 font-mono">({formattedAmount})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <span>₹{diffToNext.toLocaleString('en-IN')} to take #{nextTargetRank}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-1.5 py-0.5 rounded-full">
                      {percentToNext}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-800">Your Rank: #{profile.rank}</span>
                    <span className="text-zinc-400 font-mono">({formattedAmount})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                    <span>₹{diffToTop.toLocaleString('en-IN')} to take #1</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-mono font-bold px-1.5 py-0.5 rounded-full">
                      {percentToTop}%
                    </span>
                  </div>
                </div>
              )}

              {/* The Visual Progress Bar Track */}
              <div className="w-full bg-zinc-200/80 rounded-full h-3.5 sm:h-4 p-0.5 overflow-hidden border border-zinc-200 relative">
                <div
                  role="progressbar"
                  aria-valuenow={progressTarget === 'next' ? percentToNext : percentToTop}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{ width: `${progressTarget === 'next' ? percentToNext : percentToTop}%` }}
                  className={`h-full rounded-full transition-all duration-500 ease-out shadow-xs ${
                    progressTarget === 'next'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500'
                  }`}
                />
              </div>

              {/* Range Labels below bar */}
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1.5 px-0.5">
                <span>You: #{profile.rank} ({formattedAmount})</span>
                {progressTarget === 'next' ? (
                  <span>Target: #{nextTargetRank} (₹{amountToBeatNext.toLocaleString('en-IN')})</span>
                ) : (
                  <span>Target: #1 Crown (₹{amountToBeatTop.toLocaleString('en-IN')})</span>
                )}
              </div>

              {/* Action Footer */}
              <div className="mt-3 pt-2.5 border-t border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="text-zinc-600 text-[11px]">
                  {progressTarget === 'next' ? (
                    <span>
                      Overtake <strong>{nextProfileName}</strong> by adding at least <strong>₹{diffToNext.toLocaleString('en-IN')}</strong>.
                    </span>
                  ) : (
                    <span>
                      Dethrone <strong>{topProfileName}</strong> by adding at least <strong>₹{diffToTop.toLocaleString('en-IN')}</strong>.
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onUpgradeRank(profile)}
                  aria-label={progressTarget === 'next' ? `Boost by ₹${diffToNext} to take #${nextTargetRank}` : `Boost by ₹${diffToTop} to take #1`}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold transition-all text-xs cursor-pointer shadow-2xs whitespace-nowrap min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {progressTarget === 'next'
                      ? `Boost +₹${diffToNext} to take #${nextTargetRank}`
                      : `Boost +₹${diffToTop} to take #1`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rank Trajectory Line Chart (Recharts) */}
        {hasMultipleClaims && (
          <div
            id="rank-trajectory-card"
            data-testid="rank-trajectory-chart"
            className="mt-6 p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs text-left"
          >
            {/* Trajectory Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 pb-3 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-zinc-900 tracking-tight">
                    Rank Trajectory Over Time
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Visual climb across {trajectoryData.length} verified claim records
                </p>
              </div>

              {/* Trajectory Badge */}
              <div className="flex items-center gap-2">
                {(() => {
                  const initialRank = trajectoryData[0]?.rank;
                  const currentRank = trajectoryData[trajectoryData.length - 1]?.rank;
                  const climb = initialRank - currentRank;

                  if (climb > 0) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold whitespace-nowrap">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Climbed {climb} {climb === 1 ? 'spot' : 'spots'} (from #{initialRank})</span>
                      </span>
                    );
                  } else if (climb === 0) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold whitespace-nowrap">
                        <span>Maintained #{currentRank}</span>
                      </span>
                    );
                  } else {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold whitespace-nowrap">
                        <span>Currently #{currentRank}</span>
                      </span>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Recharts Responsive Line Chart */}
            <div className="w-full h-48 sm:h-52 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trajectoryData}
                  margin={{ top: 12, right: 18, left: -18, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e4e4e7' }}
                  />
                  <YAxis
                    reversed={true}
                    dataKey="rank"
                    allowDecimals={false}
                    domain={[Math.max(1, minRank - 1), maxRank + 1]}
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    tickFormatter={(v: number) => `#${v}`}
                    tickLine={false}
                    axisLine={{ stroke: '#e4e4e7' }}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-3 bg-zinc-950 text-white rounded-xl shadow-xl border border-zinc-800 text-xs min-w-[170px] z-50">
                            <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-zinc-800">
                              <span className="font-extrabold text-amber-400 flex items-center gap-1">
                                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                <span>Rank #{data.rank}</span>
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">{data.shortLabel}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400">Total Paid:</span>
                                <span className="font-mono font-bold text-emerald-400">₹{data.totalAmount.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400">This Claim:</span>
                                <span className="font-mono text-zinc-300">+₹{data.amount.toLocaleString('en-IN')}</span>
                              </div>
                              {data.note && (
                                <div className="text-[10px] text-amber-300 font-medium pt-0.5">
                                  {data.note}
                                </div>
                              )}
                              {data.formattedDate && (
                                <div className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-800/80">
                                  {data.formattedDate}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rank"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ fill: '#18181b', stroke: '#f59e0b', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                    animationDuration={600}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Trajectory Milestone Legend / Subtitle */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  Started at <strong className="text-zinc-800 font-bold">#{trajectoryData[0]?.rank}</strong> (₹{trajectoryData[0]?.amount?.toLocaleString('en-IN')})
                  {' '}→ Current: <strong className="text-amber-600 font-bold">#{trajectoryData[trajectoryData.length - 1]?.rank}</strong> (₹{trajectoryData[trajectoryData.length - 1]?.totalAmount?.toLocaleString('en-IN')})
                </span>
              </div>
              <span className="text-[11px] text-stone-400 italic">
                Higher curve = Better rank (#1 Apex)
              </span>
            </div>
          </div>
        )}

        {/* AI Lazy Roast Section */}
        <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-amber-500/5 border border-amber-300/70 shadow-2xs text-left relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[11px] font-black tracking-wider uppercase">
              <Flame className="w-3.5 h-3.5 fill-current text-zinc-950" />
              <span>AI Lazy Roast</span>
            </div>

            <div className="flex items-center gap-1.5">
              {roast && (
                <button
                  type="button"
                  onClick={handleCopyRoast}
                  aria-label="Copy AI roast text to clipboard"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
                  title="Copy Roast"
                >
                  {copiedRoast ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => fetchRoast(true)}
                disabled={isGeneratingRoast}
                aria-label="Regenerate AI roast"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
                title="Regenerate roast"
              >
                <RotateCw className={`w-3.5 h-3.5 text-zinc-500 ${isGeneratingRoast ? 'animate-spin' : ''}`} />
                <span>{isGeneratingRoast ? 'Roasting...' : 'Re-Roast'}</span>
              </button>
            </div>
          </div>

          {isGeneratingRoast && !roast ? (
            <div className="py-4 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                <span>Cooking up a sharp deadpan roast...</span>
              </div>
            </div>
          ) : roast ? (
            <div className="space-y-1">
              <blockquote className="text-base sm:text-lg font-black text-zinc-900 tracking-tight leading-snug">
                “{roast}”
              </blockquote>
              <p className="text-[11px] text-zinc-500 font-medium">
                Tailored roast for Rank #{profile.rank} • Auto-synced to your 9:16 story card
              </p>
            </div>
          ) : (
            <div className="py-2 flex items-center justify-between">
              <span className="text-xs text-zinc-600">Want a personalized roast for this rank?</span>
              <button
                type="button"
                onClick={() => fetchRoast(false)}
                aria-label="Generate AI roast for this rank"
                className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                Generate Roast
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* Primary Share Action with Dynamic Message Preview Tooltip */}
          <div
            className="relative w-full sm:w-auto"
            onMouseEnter={() => setShowShareTooltip(true)}
            onMouseLeave={() => setShowShareTooltip(false)}
          >
            <div className="flex items-stretch w-full sm:w-auto rounded-xl shadow-xs">
              <button
                id="share-btn"
                data-testid="share-button"
                type="button"
                onClick={handleWebShare}
                onFocus={() => setShowShareTooltip(true)}
                onBlur={() => setShowShareTooltip(false)}
                aria-label="Share public lazy rank via native share sheet"
                aria-describedby="share-preview-tooltip"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl sm:rounded-r-none bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold transition-all active:scale-98 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                title="Share customized rank and claim amount via OS native share sheet"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareTooltip((prev) => !prev);
                }}
                className="hidden sm:inline-flex items-center justify-center px-2.5 rounded-r-xl bg-zinc-900 hover:bg-zinc-800 border-l border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
                title={showShareTooltip ? "Hide preview tooltip" : "Preview shareable message"}
                aria-label="Toggle share message preview"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dynamically Generated Message Preview Tooltip */}
            <div
              id="share-preview-tooltip"
              role="tooltip"
              data-testid="share-preview-tooltip"
              className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-40 w-80 sm:w-96 max-w-[calc(100vw-2rem)] p-3.5 bg-zinc-900 text-white rounded-2xl shadow-2xl border border-zinc-700/90 text-left transition-all duration-150 ${
                showShareTooltip
                  ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 scale-95 translate-y-1 pointer-events-none invisible'
              }`}
            >
              {/* Tooltip Header */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Share Message Preview</span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Native Sheet Preview
                </span>
              </div>

              {/* Dynamic Metadata Highlights: Rank, Amount, Custom Link */}
              <div className="flex flex-wrap items-center gap-1.5 my-2.5">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Rank #{profile.rank}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono-numbers">
                  {formattedAmount}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 truncate max-w-[140px]" title={shareUrl}>
                  {shareUrl}
                </span>
              </div>

              {/* Dynamic Shareable Message Text Box */}
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs leading-relaxed text-zinc-200 font-sans whitespace-pre-wrap select-all max-h-48 overflow-y-auto">
                {customShareMessage}
              </div>

              {/* Footer Note before triggering native share sheet */}
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Preview
                </span>
                <span className="text-zinc-400">Triggers OS share sheet on click</span>
              </div>

              {/* Tooltip Arrow pointing down to Share button */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-zinc-900" />
            </div>
          </div>

          <button
            id="copy-rank-link-btn"
            type="button"
            onClick={handleCopyLink}
            aria-label="Copy share message and link to clipboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-zinc-500" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenChallenge(profile.rank, 'challenge', profile.name)}
            aria-label="Challenge a friend to beat your rank"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <Swords className="w-4 h-4 text-amber-700" />
            <span>Challenge a Friend</span>
          </button>

          <button
            type="button"
            id="action-btn-lazy-reason"
            onClick={() => onOpenChallenge(profile.rank, 'reason', profile.name)}
            aria-label="Choose or change your official lazy reason"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-950 text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Choose or change your official lazy reason"
          >
            <Tag className="w-4 h-4 text-amber-700" />
            <span>{profile.lazyReason ? `Reason: ${profile.lazyReason}` : 'Lazy Reasons'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenChallenge(profile.rank, 'challenge', profile.name)}
            aria-label="Challenge a friend to beat your rank"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
            title="Challenge a friend to beat your rank on LAZY"
          >
            <Swords className="w-4 h-4 text-amber-700" />
            <span>Challenge Friend</span>
          </button>
        </div>

        {/* Share Status Feedback Notification */}
        {shareFeedback && (
          <div className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-2xs">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{shareFeedback}</span>
          </div>
        )}

        {/* Upgrade / Re-rank Option */}
        <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
          <button
            type="button"
            onClick={() => onUpgradeRank(profile)}
            aria-label="Pay more to improve your rank on the leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-950 hover:underline transition-all cursor-pointer py-1 px-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Pay more to improve your rank</span>
          </button>
        </div>
      </div>

      {/* 9:16 Social Canvas Card Section */}
      <div className="mt-8">
        <div className="text-center mb-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-900">
            Official 9:16 Story Card
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Designed for Instagram Stories, WhatsApp Status, and X.
          </p>
        </div>

        <ShareCardPreview
          profile={profile}
          activeTemplate={activeTemplate}
          onChangeTemplate={setActiveTemplate}
          roast={roast}
          includeRoast={includeRoastOnCard}
          onToggleIncludeRoast={setIncludeRoastOnCard}
        />
      </div>
    </div>
  );
};

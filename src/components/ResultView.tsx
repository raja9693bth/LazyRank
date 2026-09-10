import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types.ts';
import { ShareCardPreview, CardTemplateType } from './ShareCardPreview.tsx';
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
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ResultViewProps {
  profile: UserProfile;
  onBackToLeaderboard: () => void;
  onOpenChallenge: (targetRank?: number) => void;
  onUpgradeRank: (profile: UserProfile) => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  profile,
  onBackToLeaderboard,
  onOpenChallenge,
  onUpgradeRank
}) => {
  const [activeTemplate, setActiveTemplate] = useState<CardTemplateType>(
    profile.rank === 1 ? 'gold_winner' : 'bold_dark'
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  // AI Lazy Roast State
  const [roast, setRoast] = useState<string>(profile.roast || '');
  const [isGeneratingRoast, setIsGeneratingRoast] = useState(false);
  const [copiedRoast, setCopiedRoast] = useState(false);
  const [includeRoastOnCard, setIncludeRoastOnCard] = useState(true);

  const fetchRoast = async (force = false) => {
    if (isGeneratingRoast) return;
    setIsGeneratingRoast(true);
    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id, forceRegenerate: force })
      });
      const data = await res.json();
      if (data.success && data.roast) {
        setRoast(data.roast);
      }
    } catch {
      // Fallback handled gracefully
    } finally {
      setIsGeneratingRoast(false);
    }
  };

  useEffect(() => {
    try {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti fallback
    }

    // Auto-fetch roast if not already present on profile
    if (!profile.roast && profile.id) {
      fetchRoast(false);
    }
  }, [profile.id]);

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
    : `https://lazy.lol/?rank=${profile.id}`;

  const shareText = roast
    ? `I paid ₹${profile.amount.toLocaleString('en-IN')} to prove I'm lazy (Rank #${profile.rank} on LAZY).\n"${roast}"\nTop me if you can:`
    : `I paid ₹${profile.amount.toLocaleString('en-IN')} to prove I'm lazy. Official Rank #${profile.rank} on LAZY. Top me if you can:`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'shareClicks' })
      }).catch(() => {});
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `LAZY Rank #${profile.rank}`,
          text: shareText,
          url: shareUrl
        });
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'shareClicks' })
        }).catch(() => {});
      } catch {
        // Share cancelled or dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div id="result-view-container" className="w-full max-w-2xl mx-auto my-6 px-3">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <button
          type="button"
          onClick={onBackToLeaderboard}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leaderboard</span>
        </button>

        <span className="text-xs font-mono-numbers text-zinc-400">
          ID: {profile.id}
        </span>
      </div>

      {/* Main Result Card */}
      <div className="mt-5 rounded-2xl border-2 border-zinc-900 bg-white p-6 sm:p-8 shadow-md text-center">
        {/* Legitimacy Verified Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>LEGITIMACY VERIFIED</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 uppercase">
          You're Officially Lazy.
        </h1>

        {/* Big Rank Display */}
        <div className="my-6 inline-flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-50 border border-zinc-200 min-w-[200px]">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Public Lazy Rank
          </div>
          <div className="text-5xl sm:text-6xl font-black font-mono-numbers text-zinc-950 mt-1 flex items-center gap-2">
            {profile.rank === 1 && <Trophy className="w-8 h-8 text-amber-500" />}
            <span>#{profile.rank}</span>
          </div>
          <div className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            ₹{profile.amount.toLocaleString('en-IN')} Paid to Prove It
          </div>
        </div>

        {/* Profile Name & Confession */}
        <div className="max-w-md mx-auto space-y-2">
          <h2 className="text-lg font-extrabold text-zinc-900">
            {profile.name}
          </h2>

          {profile.reason && (
            <p className="text-xs text-zinc-600 italic">
              "{profile.reason}"
            </p>
          )}

          {/* Social & Website Links */}
          {(profile.instagram || profile.linkedin || profile.website) && (
            <div className="flex items-center justify-center gap-3 pt-2 text-xs text-zinc-600 flex-wrap">
              {profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-700 hover:text-pink-600 font-medium transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>@{profile.instagram.replace(/^@/, '')}</span>
                </a>
              )}

              {profile.instagram && (profile.linkedin || profile.website) && (
                <span className="text-zinc-300">·</span>
              )}

              {profile.linkedin && (
                <a
                  href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-700 hover:text-blue-600 font-medium transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  <span>LinkedIn</span>
                </a>
              )}

              {profile.linkedin && profile.website && (
                <span className="text-zinc-300">·</span>
              )}

              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-700 hover:text-sky-600 font-medium transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Website</span>
                </a>
              )}
            </div>
          )}
        </div>

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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
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
                className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold cursor-pointer"
              >
                Generate Roast
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            id="share-my-rank-btn"
            type="button"
            onClick={handleNativeShare}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Share My Rank</span>
          </button>

          <button
            id="copy-rank-link-btn"
            type="button"
            onClick={handleCopyLink}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold transition-all active:scale-95 cursor-pointer"
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
            onClick={() => onOpenChallenge(profile.rank)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            <Swords className="w-4 h-4 text-amber-700" />
            <span>Challenge a Friend</span>
          </button>
        </div>

        {/* Upgrade / Re-rank Option */}
        <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
          <button
            type="button"
            onClick={() => onUpgradeRank(profile)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-950 hover:underline transition-all cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Pay more to improve your rank</span>
          </button>
        </div>
      </div>

      {/* 9:16 Social Canvas Card Section */}
      <div className="mt-8">
        <div className="text-center mb-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-900">
            Official 9:16 Story Card
          </h3>
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

import React from 'react';
import {
  CheckCircle2,
  Globe,
  Instagram,
  Linkedin,
  Flame,
  Share2,
  ShieldAlert,
  MessageSquareQuote,
  Sparkles,
  ArrowRight,
  ThumbsUp
} from 'lucide-react';
import { UserProfile } from '../types.ts';
import { formatDisplayCurrency, getWittyTag } from '../utils/showcase.ts';

// Twitter / X Icon SVG
const XIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ProfileCardProps {
  profile: UserProfile;
  currencyMode?: 'INR' | 'USD';
  onSelect: (profile: UserProfile) => void;
  onVote?: (id: string) => void;
  onReport?: (id: string) => void;
  onBeatRank?: (targetAmount: number) => void;
  isTop1?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic pastel avatar background
const AVATAR_COLORS = [
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-orange-100 text-orange-900 border-orange-200',
  'bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-sky-100 text-sky-900 border-sky-200',
  'bg-violet-100 text-violet-900 border-violet-200',
  'bg-rose-100 text-rose-900 border-rose-200'
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  currencyMode = 'INR',
  onSelect,
  onVote,
  onReport,
  onBeatRank,
  isTop1 = false
}) => {
  const wittyTag = getWittyTag(profile);
  const formattedAmount = formatDisplayCurrency(profile.amount, currencyMode);
  const initials = getInitials(profile.name);
  const avatarStyle = getAvatarColor(profile.name);

  return (
    <article
      aria-label={`Profile of ${profile.name}, rank ${profile.rank}`}
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs ${
        isTop1 || profile.rank === 1
          ? 'border-amber-300 bg-[#fff8f3] hover:border-amber-400'
          : 'border-[#ede5db] bg-white hover:border-stone-300'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Avatar + Details */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          {/* Rank Badge */}
          <div className="flex flex-col items-center shrink-0">
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs font-mono-numbers shrink-0 shadow-2xs ${
                profile.rank === 1
                  ? 'bg-[#e86638] text-white'
                  : profile.rank === 2
                  ? 'bg-stone-300 text-stone-900'
                  : profile.rank === 3
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              #{profile.rank}
            </span>
          </div>

          {/* 64px desktop / 56px mobile initials avatar */}
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-2xs select-none ${avatarStyle}`}
            aria-hidden="true"
          >
            {initials}
          </div>

          {/* Core Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onSelect(profile)}
                className="text-sm sm:text-base font-extrabold text-stone-900 hover:text-[#9c3a16] transition-colors truncate cursor-pointer text-left"
              >
                {profile.name}
              </button>

              {/* Verified Badge: ONLY rendered on verified profiles */}
              {profile.isVerified && (
                <span
                  title="Verified by payment"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified</span>
                </span>
              )}

              {/* Witty Tag */}
              <span className="px-2 py-0.5 rounded-full bg-[#faeee5] text-[#9c3a16] text-[10px] font-extrabold border border-[#f2ded0]">
                {wittyTag}
              </span>
            </div>

            {/* Authentic Bio: reason or lazyReason */}
            {(profile.reason || profile.lazyReason) && (
              <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                "{profile.reason || profile.lazyReason}"
              </p>
            )}

            {/* 4 Social Badge Icons: Website, LinkedIn, Instagram, X */}
            <div className="flex items-center gap-2.5 mt-2 text-stone-400">
              {/* Website */}
              {profile.website ? (
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${profile.name}'s website`}
                  className="text-stone-600 hover:text-stone-900 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span title="No website provided" className="opacity-30 cursor-not-allowed">
                  <Globe className="w-3.5 h-3.5" />
                </span>
              )}

              {/* LinkedIn */}
              {profile.linkedin ? (
                <a
                  href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${profile.name}'s LinkedIn`}
                  className="text-[#0a66c2] hover:opacity-80 transition-opacity"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span title="No LinkedIn provided" className="opacity-30 cursor-not-allowed">
                  <Linkedin className="w-3.5 h-3.5" />
                </span>
              )}

              {/* Instagram */}
              {profile.instagram ? (
                <a
                  href={profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${profile.name}'s Instagram`}
                  className="text-[#e1306c] hover:opacity-80 transition-opacity"
                >
                  <Instagram className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span title="No Instagram provided" className="opacity-30 cursor-not-allowed">
                  <Instagram className="w-3.5 h-3.5" />
                </span>
              )}

              {/* X (Twitter) - Always rendered inactive as backend model has no X field */}
              <span
                title="X profile not connected"
                className="opacity-30 cursor-not-allowed text-stone-400"
              >
                <XIcon className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Right: Amount & Actions */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0eae1] gap-2 shrink-0">
          <div className="text-left sm:text-right">
            <div className="text-base sm:text-lg font-black text-stone-900 font-mono-numbers">
              {formattedAmount}
            </div>
            <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
              {currencyMode === 'USD' ? 'USD (Approx)' : 'INR Verified'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Vote Action */}
            {onVote && (
              <button
                type="button"
                onClick={() => onVote(profile.id)}
                aria-label={`Upvote ${profile.name}`}
                className="px-2 py-1 rounded-lg bg-[#faf8f4] hover:bg-stone-100 border border-[#ede5db] text-[11px] font-bold text-stone-600 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ThumbsUp className="w-3 h-3" />
                <span>{profile.votesCount || 0}</span>
              </button>
            )}

            {/* Beat / Claim Specific Rank */}
            {onBeatRank && (
              <button
                type="button"
                onClick={() => onBeatRank(profile.amount + 1)}
                className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>Beat</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

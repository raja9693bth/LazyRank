import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Eye,
  ShieldCheck,
  Lock,
  Flame,
  Search
} from 'lucide-react';
import { UserProfile } from '../types.ts';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile | null;
  onProfileUpdated?: (updated: UserProfile) => void;
  onNavigateToClaim?: () => void;
  allProfiles?: UserProfile[];
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onNavigateToClaim,
  allProfiles = []
}) => {
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [userClaimedProfiles, setUserClaimedProfiles] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Discover claimed profiles owned on this device via lazy_tokens or allProfiles
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    try {
      const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
      const tokenKeys = Object.keys(tokens);

      let owned: UserProfile[] = [];
      if (tokenKeys.length > 0) {
        owned = allProfiles.filter(p => tokenKeys.includes(p.id));
        if (currentProfile && !owned.some(p => p.id === currentProfile.id)) {
          owned.unshift(currentProfile);
        }
      } else if (currentProfile) {
        owned = [currentProfile];
      }

      setUserClaimedProfiles(owned);

      // Pick active profile
      const initial = currentProfile || (owned.length > 0 ? owned[0] : null);
      if (initial) {
        setActiveProfileId(initial.id);
        setActiveProfile(initial);
      }
    } catch {
      if (currentProfile) {
        setActiveProfileId(currentProfile.id);
        setActiveProfile(currentProfile);
        setUserClaimedProfiles([currentProfile]);
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentProfile, allProfiles, onClose]);

  if (!isOpen) return null;

  const handleSelectProfile = (profile: UserProfile) => {
    setActiveProfileId(profile.id);
    setActiveProfile(profile);
  };

  return (
    <div
      id="user-settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-800">
              <Sliders className="w-5 h-5 text-stone-700" />
            </div>
            <div>
              <h2 id="user-settings-title" className="font-black text-lg text-zinc-950 tracking-tight">
                User Settings & Profile
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                View your verified participant profile and account credentials
              </p>
            </div>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
            aria-label="Close settings dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Selector if user has claimed profiles */}
        {userClaimedProfiles.length > 1 && (
          <div className="mt-4 pt-1 pb-3 border-b border-zinc-100">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-2">
              Select Your Profile:
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Claimed profiles list">
              {userClaimedProfiles.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={activeProfileId === p.id}
                  onClick={() => handleSelectProfile(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 ${
                    activeProfileId === p.id
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="font-mono text-[11px] opacity-75">₹{p.amount}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Profile Banner or Empty State */}
        {activeProfile ? (
          <div className="mt-5 space-y-5">
            {/* Active Profile Info Strip */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-zinc-900 truncate">
                    {activeProfile.name}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 font-medium">
                  <span>Verified Amount: <strong className="font-mono font-bold text-stone-900">₹{activeProfile.amount.toLocaleString('en-IN')}</strong></span>
                  <span>·</span>
                  <span>Public Rank: <strong className="font-bold text-stone-900">#{activeProfile.rank}</strong></span>
                </div>
              </div>

              {activeProfile.rank <= 10 && (
                <div
                  id="user-settings-lazy-streak-badge"
                  title={`${activeProfile.lazyStreakDays || 1} consecutive days maintained in Top 10`}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-black"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-600 fill-orange-500" />
                  <span>{activeProfile.lazyStreakDays || 1}d streak</span>
                </div>
              )}
            </div>

            {/* Account & Verification Card */}
            <div className="p-4 sm:p-5 rounded-2xl border bg-stone-50/80 border-stone-200">
              <div className="flex items-start gap-3 pb-3 border-b border-stone-200/80">
                <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 text-stone-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-zinc-950">
                    Verified Participant Status
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                    Your claim is authenticated and securely recorded with rank #{activeProfile.rank} on the official leaderboard.
                  </p>
                </div>
              </div>

              {/* Status Details */}
              <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-stone-200">
                  <div className="flex items-center gap-1.5 font-bold text-stone-800 mb-1">
                    <Eye className="w-3.5 h-3.5 text-stone-500" />
                    <span>Leaderboard Rank</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-normal">
                    Ranked #{activeProfile.rank} with title "{activeProfile.title || 'Verified Participant'}".
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-stone-200">
                  <div className="flex items-center gap-1.5 font-bold text-stone-800 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Payment</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-normal">
                    ₹{activeProfile.amount.toLocaleString('en-IN')} securely validated and recorded.
                  </p>
                </div>
              </div>
            </div>

            {/* Ownership & Protection Notice */}
            <div className="pt-2 flex items-center justify-between text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-stone-400" />
                <span>Protected by profile ownership token</span>
              </span>
              <span className="text-[11px] text-stone-400">
                Verified on this device
              </span>
            </div>
          </div>
        ) : (
          /* Empty State: User has not claimed a profile on this device or wants to search their profile */
          <div className="mt-6 py-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-700 shadow-2xs">
              <Sliders className="w-6 h-6" />
            </div>
            <div className="max-w-xs mx-auto">
              <h3 className="font-extrabold text-zinc-900 text-sm">
                Account & Profile Status
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Find your verified participant profile below to inspect your rank, streak, and credentials.
              </p>
            </div>

            {/* Quick Profile Finder */}
            <div className="max-w-sm mx-auto text-left space-y-2">
              <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                Find Your Profile:
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by participant name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-stone-800 focus-visible:ring-2 focus-visible:ring-stone-800"
                />
              </div>

              {/* Suggestions */}
              {allProfiles.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                  {allProfiles
                    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
                    .slice(0, 5)
                    .map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProfile(p)}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs bg-stone-50 hover:bg-stone-100 border border-stone-200 flex items-center justify-between transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-stone-900 truncate">{p.name}</span>
                          <span className="text-[10px] text-stone-500">#{p.rank}</span>
                        </div>
                        <span className="font-mono font-bold text-[11px] text-stone-700 shrink-0">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {onNavigateToClaim && (
              <button
                type="button"
                id="settings-claim-rank-btn"
                onClick={() => {
                  onClose();
                  onNavigateToClaim();
                }}
                className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs tracking-tight shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 focus-visible:ring-offset-1"
              >
                Claim a New Rank
              </button>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

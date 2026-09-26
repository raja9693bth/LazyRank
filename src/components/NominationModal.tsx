import React, { useState, useEffect } from 'react';
import {
  X,
  Swords,
  Copy,
  Check,
  ArrowRight,
  Bell,
  BellRing,
  Mail,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Sparkles,
  Award
} from 'lucide-react';
import {
  LAZY_REASONS_CATALOG,
  PREDEFINED_LAZY_REASONS,
  getLazyReasonEmoji,
  UserProfile
} from '../types';
import { recordNominationGoal } from '../utils/dailyGoal';

export interface NominationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRank?: number;
  minAmountToBeatTop: number;
  initialTab?: 'challenge' | 'reason' | 'notify';
  defaultName?: string;
  defaultEmail?: string;
  currentProfile?: UserProfile | null;
  onProfileUpdated?: (updatedProfile: UserProfile) => void;
}

const FUNNY_CHALLENGES = [
  "Think you're lazier than me? Sponsor your spot to prove it.",
  "You've been in bed since morning. Prove you belong on the leaderboard.",
  "I sponsored to prove my laziness. Challenge you to top my rank.",
  "Moving your mouse on Slack doesn't count. Take #1 if you dare."
];

export const NominationModal: React.FC<NominationModalProps> = ({
  isOpen,
  onClose,
  targetRank,
  minAmountToBeatTop,
  initialTab = 'challenge',
  defaultName = '',
  defaultEmail = '',
  currentProfile,
  onProfileUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'challenge' | 'reason' | 'notify'>(initialTab);

  // Lazy Reason Selection State
  const [selectedLazyReason, setSelectedLazyReason] = useState<string>(() => {
    return currentProfile?.lazyReason || localStorage.getItem('lazy_selected_reason') || 'Bed Connoisseur';
  });
  const [isSavingReason, setIsSavingReason] = useState(false);
  const [reasonSaveSuccess, setReasonSaveSuccess] = useState(false);
  const [reasonSaveError, setReasonSaveError] = useState<string | null>(null);

  // Challenge Flow State
  const [friendName, setFriendName] = useState('');
  const [yourName, setYourName] = useState(defaultName);
  const [challengeMsg, setChallengeMsg] = useState(FUNNY_CHALLENGES[0]);
  const [challengeLazyReason, setChallengeLazyReason] = useState<string>('Bed Connoisseur');
  const [challengeGenerated, setChallengeGenerated] = useState(false);
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Notify Me Flow State
  const [notifyEmail, setNotifyEmail] = useState(defaultEmail);
  const [notifyName, setNotifyName] = useState(defaultName);
  const [notifyOnOutranked, setNotifyOnOutranked] = useState(true);
  const [notifyOnNomination, setNotifyOnNomination] = useState(true);
  const [isSubmittingNotify, setIsSubmittingNotify] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyError, setNotifyError] = useState<string | null>(null);

  // Escape key handler for accessible modal dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sync initial tab and default names on open
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (currentProfile?.lazyReason) {
        setSelectedLazyReason(currentProfile.lazyReason);
      } else {
        const saved = localStorage.getItem('lazy_selected_reason');
        if (saved) setSelectedLazyReason(saved);
      }
      if (defaultName) {
        setYourName(defaultName);
        if (!notifyName) setNotifyName(defaultName);
      }
      if (defaultEmail && !notifyEmail) {
        setNotifyEmail(defaultEmail);
      } else {
        try {
          const savedEmail = localStorage.getItem('lazy_notify_email');
          if (savedEmail && !notifyEmail) {
            setNotifyEmail(savedEmail);
          }
          const savedName = localStorage.getItem('lazy_notify_name');
          if (savedName && !notifyName) {
            setNotifyName(savedName);
          }
        } catch {}
      }
    }
  }, [isOpen, initialTab, defaultName, defaultEmail, currentProfile]);

  if (!isOpen) return null;

  const safeMinAmount = typeof minAmountToBeatTop === 'number' && !isNaN(minAmountToBeatTop) && minAmountToBeatTop > 0
    ? minAmountToBeatTop
    : 1;

  const challengeUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?challenge=${encodeURIComponent(friendName || 'friend')}&target=${safeMinAmount}&lazyReason=${encodeURIComponent(challengeLazyReason || '')}`
    : `https://lazyproof.online/?challenge=${encodeURIComponent(friendName || 'friend')}&target=${safeMinAmount}&lazyReason=${encodeURIComponent(challengeLazyReason || '')}`;

  const fullChallengeText = `${friendName ? `${friendName}, ` : ''}${yourName ? `${yourName} nominated you as "${challengeLazyReason || 'Bed Connoisseur'}" on LAZY: ` : ''}"${challengeMsg}" Beat the leaderboard for ₹${safeMinAmount}: ${challengeUrl}`;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim()) return;
    setIsGeneratingChallenge(true);
    setChallengeError(null);

    try {
      const res = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomineeName: friendName.trim(),
          nominatorName: yourName.trim() || undefined,
          reason: challengeMsg,
          lazyReason: challengeLazyReason,
          targetAmount: safeMinAmount
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record challenge on server.');
      }

      // Record nomination toward daily Lazy Goal only on successful response
      try {
        recordNominationGoal(friendName.trim());
      } catch {}

      setChallengeGenerated(true);
    } catch (err: any) {
      setChallengeError(err?.message || 'Network error recording challenge. Please try again.');
    } finally {
      setIsGeneratingChallenge(false);
    }
  };

  const handleSaveLazyReason = async () => {
    setIsSavingReason(true);
    setReasonSaveError(null);
    setReasonSaveSuccess(false);

    try {
      localStorage.setItem('lazy_selected_reason', selectedLazyReason);

      if (currentProfile?.id) {
        let storedToken = currentProfile.ownerToken;
        if (!storedToken) {
          try {
            const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
            storedToken = tokens[currentProfile.id];
          } catch {}
        }

        const res = await fetch('/api/profile/lazy-reason', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(storedToken ? { 'x-profile-token': storedToken } : {})
          },
          body: JSON.stringify({
            profileId: currentProfile.id,
            lazyReason: selectedLazyReason,
            ownerToken: storedToken
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.profile) {
          throw new Error(data.error || 'Failed to update lazy reason on server.');
        }

        if (onProfileUpdated) {
          onProfileUpdated(data.profile);
        }
      }

      setReasonSaveSuccess(true);
      setTimeout(() => {
        setReasonSaveSuccess(false);
      }, 3500);
    } catch (err: any) {
      setReasonSaveError(err?.message || 'Could not save Lazy Reason. Please try again.');
    } finally {
      setIsSavingReason(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullChallengeText);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'challengeClicks' })
      }).catch(() => {});
    } catch {
      // Fallback
    }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifyError(null);

    const cleanEmail = notifyEmail.trim();
    if (!cleanEmail) {
      setNotifyError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(cleanEmail)) {
      setNotifyError('Please enter a valid email address (e.g. you@example.com).');
      return;
    }

    if (!notifyOnOutranked && !notifyOnNomination) {
      setNotifyError('Please select at least one notification alert type.');
      return;
    }

    setIsSubmittingNotify(true);
    try {
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: notifyName.trim() || undefined,
          notifyOnOutranked,
          notifyOnNomination
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register notification preferences.');
      }

      setNotifySuccess(true);
      setNotifyMessage(data.message || 'Notification preferences registered successfully.');

      // Persist preferences locally for user convenience
      try {
        localStorage.setItem('lazy_notify_email', cleanEmail);
        if (notifyName.trim()) {
          localStorage.setItem('lazy_notify_name', notifyName.trim());
        }
      } catch {}

      // Track analytics
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'notifySubscribed' })
      }).catch(() => {});
    } catch (err: any) {
      setNotifyError(err?.message || 'Failed to connect. Please try again.');
    } finally {
      setIsSubmittingNotify(false);
    }
  };

  const currentMeta = LAZY_REASONS_CATALOG.find(r => r.name === selectedLazyReason) || LAZY_REASONS_CATALOG[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nomination-modal-title"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
              {activeTab === 'reason' && <Sparkles className="w-4 h-4 text-amber-700" />}
              {activeTab === 'challenge' && <Swords className="w-4 h-4 text-amber-700" />}
              {activeTab === 'notify' && <BellRing className="w-4 h-4 text-amber-700" />}
            </div>
            <div>
              <h2 id="nomination-modal-title" className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">
                {activeTab === 'reason' && 'Lazy Reason Selection'}
                {activeTab === 'challenge' && 'Challenge a Friend'}
                {activeTab === 'notify' && 'Leaderboard Alerts'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {activeTab === 'reason' && 'Stamp your official verified reason on your public result card.'}
                {activeTab === 'challenge' && "Dare them to prove they're lazier than you."}
                {activeTab === 'notify' && 'Get notified when outranked or nominated.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="flex rounded-xl bg-zinc-100/90 p-1 mt-3.5 shrink-0" role="tablist" aria-label="Nomination options">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reason'}
            aria-controls="panel-reason"
            id="tab-reason-btn"
            onClick={() => setActiveTab('reason')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 ${
              activeTab === 'reason'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>Lazy Reasons</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'challenge'}
            aria-controls="panel-challenge"
            id="tab-challenge-btn"
            onClick={() => setActiveTab('challenge')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 ${
              activeTab === 'challenge'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-amber-700" />
            <span>Challenge</span>
          </button>
        </div>

        {/* TAB 1: SELECT LAZY REASONS */}
        {activeTab === 'reason' && (
          <div id="panel-reason" role="tabpanel" aria-labelledby="tab-reason-btn" className="mt-4 flex-1 overflow-y-auto pr-1 space-y-4">
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-amber-950">
                <span className="font-extrabold">Public Result Card Customization:</span> Select a reason from this curated list (e.g. <span className="font-bold">Bed Connoisseur</span>, <span className="font-bold">Procrastination Master</span>) to be officially stamped on your public result card and downloadable posters.
              </div>
            </div>

            {/* Grid of Predefined Lazy Reasons */}
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-2">
                Choose Your Official Lazy Reason ({LAZY_REASONS_CATALOG.length} Available)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LAZY_REASONS_CATALOG.map((item) => {
                  const isSelected = selectedLazyReason === item.name;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`lazy-reason-opt-${item.id}`}
                      aria-pressed={isSelected}
                      aria-label={`Select lazy reason: ${item.name} (${item.tagline})`}
                      onClick={() => {
                        setSelectedLazyReason(item.name);
                        setReasonSaveSuccess(false);
                      }}
                      className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/40 shadow-xs'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl shrink-0">{item.emoji}</span>
                          <div>
                            <div className="text-xs font-black text-zinc-900 leading-snug">
                              {item.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                              {item.tagline}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Result Card Preview Box */}
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">
                <span>Result Card Live Preview</span>
                <span className="text-amber-700 font-mono">Public Card Badge</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-lg shrink-0">
                    {currentMeta.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-zinc-900 truncate">
                      {currentProfile?.name || defaultName || 'Your Name'}
                    </div>
                    <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-amber-100/90 border border-amber-300 text-amber-950 text-[10px] font-extrabold tracking-wide">
                      <span>{currentMeta.emoji}</span>
                      <span>Lazy Reason: {selectedLazyReason}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono font-bold text-zinc-400">
                    {currentProfile ? `#${currentProfile.rank}` : '#1'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {reasonSaveError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{reasonSaveError}</span>
              </div>
            )}

            {/* Success Notification */}
            {reasonSaveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-extrabold">Saved to Public Result Card!</p>
                  <p className="text-[11px] text-emerald-700">
                    "{selectedLazyReason}" is now stamped on your verified result card & share poster.
                  </p>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-1">
              <button
                type="button"
                id="save-lazy-reason-btn"
                aria-label={`Apply ${selectedLazyReason} to result card`}
                onClick={handleSaveLazyReason}
                disabled={isSavingReason}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 py-3 px-4 text-xs font-extrabold text-white transition-all active:scale-98 cursor-pointer disabled:opacity-50 min-h-[44px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                {isSavingReason ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Reason to Result Card...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Apply "{selectedLazyReason}" to Result Card</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CHALLENGE A FRIEND */}
        {activeTab === 'challenge' && (
          <div id="panel-challenge" role="tabpanel" aria-labelledby="tab-challenge-btn" className="mt-4 flex-1 overflow-y-auto pr-1">
            {!challengeGenerated ? (
              <form onSubmit={handleGenerate} className="space-y-3.5">
                <div>
                  <label htmlFor="challenge-friend-name" className="block text-xs font-bold text-zinc-700 mb-1">
                    Friend's Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="challenge-friend-name"
                    type="text"
                    placeholder="e.g. Rohan"
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                    maxLength={30}
                    required
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50/60 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  />
                </div>

                <div>
                  <label htmlFor="challenge-your-name" className="block text-xs font-bold text-zinc-700 mb-1">
                    Your Name (Optional)
                  </label>
                  <input
                    id="challenge-your-name"
                    type="text"
                    placeholder="e.g. Rahul"
                    value={yourName}
                    onChange={(e) => setYourName(e.target.value)}
                    maxLength={30}
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50/60 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  />
                </div>

                {/* Predefined Lazy Reason for Nominee */}
                <div>
                  <label htmlFor="challenge-lazy-reason-select" className="block text-xs font-bold text-zinc-700 mb-1">
                    Assign Friend's Lazy Reason (from Predefined List)
                  </label>
                  <select
                    id="challenge-lazy-reason-select"
                    value={challengeLazyReason}
                    onChange={(e) => setChallengeLazyReason(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50/60 px-3 py-2.5 text-xs font-semibold text-zinc-900 focus:bg-white focus:border-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 cursor-pointer"
                  >
                    {PREDEFINED_LAZY_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {getLazyReasonEmoji(reason)} {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="challenge-msg-select" className="block text-xs font-bold text-zinc-700 mb-1">
                    Challenge Provocation
                  </label>
                  <select
                    id="challenge-msg-select"
                    value={challengeMsg}
                    onChange={(e) => setChallengeMsg(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50/60 px-3 py-2.5 text-xs font-semibold text-zinc-900 focus:bg-white focus:border-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 cursor-pointer"
                  >
                    {FUNNY_CHALLENGES.map((msg, idx) => (
                      <option key={idx} value={msg}>
                        {msg}
                      </option>
                    ))}
                  </select>
                </div>

                {challengeError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{challengeError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!friendName.trim() || isGeneratingChallenge}
                  aria-label="Create challenge link"
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 py-3 px-4 text-xs font-extrabold text-white transition-all active:scale-98 cursor-pointer disabled:opacity-50 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                >
                  {isGeneratingChallenge ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Recording Challenge...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Challenge Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Prompt to switch to Lazy Reason or Notify */}
                <div className="pt-2 text-center flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('reason')}
                    className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800 rounded"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Want to pick your own Lazy Reason for your result card? Select Reason →</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('notify')}
                    className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-zinc-600 hover:text-zinc-950 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 rounded"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Want email alerts if friends challenge back? Notify Me →</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-[10px] mb-2">
                    {getLazyReasonEmoji(challengeLazyReason)} Nominated as: {challengeLazyReason}
                  </div>
                  <p className="font-medium text-zinc-700 italic">
                    "{fullChallengeText}"
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copiedLink ? "Challenge link copied to clipboard" : "Copy challenge link to clipboard"}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs transition-all active:scale-98 cursor-pointer shadow-xs min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Copied Challenge!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Challenge Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setChallengeGenerated(false)}
                    aria-label="Reset challenge form"
                    className="px-3 py-3 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-zinc-700 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                  >
                    Reset
                  </button>
                </div>

                {/* Post-challenge CTA */}
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-center">
                  <p className="text-[11px] text-amber-900 font-medium">
                    Sent the link? All rank changes and challenges update live in real time on the leaderboard.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NOTIFY ME (HONEST STATUS) */}
        {activeTab === 'notify' && (
          <div id="panel-notify" role="tabpanel" aria-labelledby="tab-challenge-btn" className="mt-4">
            <div className="py-6 px-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
              <div className="w-11 h-11 mx-auto rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mb-2.5">
                <Bell className="w-5 h-5 text-amber-700" />
              </div>
              <h3 className="text-sm font-extrabold text-zinc-900">
                Email Delivery Inactive
              </h3>
              <p className="mt-1.5 text-xs text-zinc-600 max-w-xs mx-auto leading-relaxed">
                Automated customer email alerts are currently inactive. All rank changes, challenges, and crown updates reflect immediately in real time on the live leaderboard.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('challenge')}
                  className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-xs font-extrabold text-white cursor-pointer shadow-2xs transition-colors"
                >
                  Go to Challenge
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

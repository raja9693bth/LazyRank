import React, { useState } from 'react';
import { X, Swords, Copy, Check, Share2, ArrowRight } from 'lucide-react';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRank?: number;
  minAmountToBeatTop: number;
}

const FUNNY_CHALLENGES = [
  "Think you're lazier than me? Put ₹ on it.",
  "You've been in bed since morning. Prove you belong on the leaderboard.",
  "I paid to prove my laziness. Bet you can't top my rank.",
  "Moving your mouse on Slack doesn't count. Take #1 if you dare."
];

export const NominationModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  onClose,
  targetRank,
  minAmountToBeatTop
}) => {
  const [friendName, setFriendName] = useState('');
  const [yourName, setYourName] = useState('');
  const [challengeMsg, setChallengeMsg] = useState(FUNNY_CHALLENGES[0]);
  const [challengeGenerated, setChallengeGenerated] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const challengeUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?challenge=${encodeURIComponent(friendName || 'friend')}&target=${minAmountToBeatTop}`
    : `https://lazy.lol/?challenge=${encodeURIComponent(friendName || 'friend')}&target=${minAmountToBeatTop}`;

  const fullChallengeText = `${friendName ? `${friendName}, ` : ''}${yourName ? `${yourName} challenged you: ` : ''}"${challengeMsg}" Beat the LAZY leaderboard for ₹${minAmountToBeatTop}: ${challengeUrl}`;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim()) return;
    setChallengeGenerated(true);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">
                Challenge a Friend
              </h3>
              <p className="text-[11px] text-zinc-500">
                Dare them to prove they're lazier than you.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!challengeGenerated ? (
          <form onSubmit={handleGenerate} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Friend's Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Rohan"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                maxLength={30}
                required
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/60 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul"
                value={yourName}
                onChange={(e) => setYourName(e.target.value)}
                maxLength={30}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/60 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:bg-white focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Challenge Provocation
              </label>
              <select
                value={challengeMsg}
                onChange={(e) => setChallengeMsg(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/60 px-3 py-2.5 text-xs font-semibold text-zinc-900 focus:bg-white focus:border-zinc-950 focus:outline-none"
              >
                {FUNNY_CHALLENGES.map((msg, idx) => (
                  <option key={idx} value={msg}>
                    {msg}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!friendName.trim()}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 py-3 px-4 text-xs font-extrabold text-white transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <span>Create Challenge Link</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
              <p className="font-medium text-zinc-700 italic">
                "{fullChallengeText}"
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs transition-all active:scale-98 cursor-pointer shadow-xs"
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
                className="px-3 py-3 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-zinc-700 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

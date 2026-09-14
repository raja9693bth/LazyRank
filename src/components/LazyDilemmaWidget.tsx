import React, { useState, useEffect } from 'react';
import { LazyDilemma } from '../types';
import { HelpCircle, Sparkles, Check, Flame, RefreshCw, Trophy } from 'lucide-react';

const STORAGE_VOTER_KEY = 'lazy_dilemma_voter_id';

function getOrCreateVoterId(): string {
  try {
    let id = localStorage.getItem(STORAGE_VOTER_KEY);
    if (!id) {
      id = 'voter_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(STORAGE_VOTER_KEY, id);
    }
    return id;
  } catch {
    return 'anon_voter_' + Date.now();
  }
}

export const LazyDilemmaWidget: React.FC = () => {
  const [dilemma, setDilemma] = useState<LazyDilemma | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCountAnim, setVoteCountAnim] = useState(false);

  const fetchDilemma = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const voterKey = getOrCreateVoterId();
      const res = await fetch(`/api/dilemma?voterKey=${encodeURIComponent(voterKey)}`);
      if (res.ok) {
        const data: LazyDilemma = await res.json();
        setDilemma(data);
        if (data.userVotedOptionId) {
          setSelectedOptionId(data.userVotedOptionId);
          setHasVoted(true);
        }
      }
    } catch (err) {
      console.warn('Could not fetch weekly dilemma:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDilemma();
  }, []);

  const handleVote = async (optionId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSelectedOptionId(optionId);

    try {
      const voterKey = getOrCreateVoterId();
      const res = await fetch('/api/dilemma/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, voterKey })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.dilemma) {
          setDilemma(data.dilemma);
          setHasVoted(true);
          setVoteCountAnim(true);
          setTimeout(() => setVoteCountAnim(false), 800);
        }
      }
    } catch (err) {
      console.error('Failed to submit dilemma vote:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !dilemma) {
    return (
      <section
        id="lazy-dilemma-section"
        className="w-full my-6 p-5 sm:p-6 rounded-2xl bg-[#faf6f0] border border-[#ede5da] shadow-2xs animate-pulse"
      >
        <div className="h-4 w-36 bg-stone-200 rounded mb-3"></div>
        <div className="h-6 w-3/4 bg-stone-300 rounded mb-4"></div>
        <div className="space-y-2.5">
          <div className="h-12 bg-stone-200/70 rounded-xl"></div>
          <div className="h-12 bg-stone-200/70 rounded-xl"></div>
          <div className="h-12 bg-stone-200/70 rounded-xl"></div>
        </div>
      </section>
    );
  }

  if (!dilemma) return null;

  return (
    <section
      id="lazy-dilemma-section"
      aria-label="Weekly Lazy Dilemma Poll"
      className="w-full my-6 p-4 sm:p-6 rounded-2xl bg-white border border-[#e8dfd3] shadow-xs relative overflow-hidden transition-all duration-300"
    >
      {/* Subtle warm accent ambient glow */}
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#e86638]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-[#fae7dc] text-[#913813] border border-[#f2cfbd]">
            <Sparkles className="w-3 h-3 text-[#e86638]" />
            <span>Weekly Dilemma</span>
          </div>
          <span className="text-xs font-semibold text-stone-500">
            {dilemma.weekLabel}
          </span>
        </div>

        {/* Live Vote Counter */}
        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium ml-auto">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span
            className={`font-extrabold text-stone-900 font-mono-numbers transition-transform ${
              voteCountAnim ? 'scale-125 text-[#e86638]' : ''
            }`}
          >
            {dilemma.totalVotes.toLocaleString()}
          </span>
          <span>votes cast</span>
        </div>
      </div>

      {/* Dilemma Question & Context */}
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#e86638] shrink-0" />
          <span>{dilemma.title}</span>
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
          {dilemma.description}
        </p>
      </div>

      {/* Voting Options with Real-Time Percentage Fill Bars */}
      <div className="space-y-2.5" role="radiogroup" aria-label={dilemma.title}>
        {dilemma.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          const isHighest = Math.max(...dilemma.options.map((o) => o.percentage)) === opt.percentage && opt.percentage > 0;

          return (
            <button
              key={opt.id}
              id={`dilemma-opt-${opt.id}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${opt.label}: ${opt.percentage}% (${opt.votes.toLocaleString()} votes)`}
              onClick={() => handleVote(opt.id)}
              disabled={isSubmitting}
              className={`w-full group relative overflow-hidden text-left p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 ${
                isSelected
                  ? 'border-stone-900 bg-stone-900/5 shadow-xs ring-1 ring-stone-900/10'
                  : 'border-[#ede5da] hover:border-stone-400 bg-white hover:bg-stone-50/70'
              }`}
            >
              {/* Real-time Percentage Background Fill */}
              <div
                className={`absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out ${
                  isSelected
                    ? 'bg-amber-100/70'
                    : isHighest
                    ? 'bg-emerald-50/70'
                    : 'bg-stone-100/70'
                }`}
                style={{ width: `${Math.max(opt.percentage, 0)}%` }}
                aria-hidden="true"
              />

              {/* Option Content Content layer */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Visual Radio Check or Emoji */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                      isSelected
                        ? 'bg-stone-900 border-stone-900 text-white'
                        : 'border-stone-300 group-hover:border-stone-500 bg-white'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : (
                      <span className="text-xs">{opt.emoji || '•'}</span>
                    )}
                  </div>

                  <span
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isSelected ? 'text-stone-950 font-black' : 'text-stone-800'
                    }`}
                  >
                    {opt.label}
                  </span>

                  {isHighest && hasVoted && (
                    <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                      <Flame className="w-2.5 h-2.5 text-emerald-600" />
                      Leader
                    </span>
                  )}
                </div>

                {/* Percentage & Vote Count */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs sm:text-sm font-extrabold font-mono-numbers ${
                      isSelected ? 'text-stone-950' : 'text-stone-600'
                    }`}
                  >
                    {opt.percentage}%
                  </span>
                  <span className="text-[10px] text-stone-400 font-medium hidden xs:inline">
                    ({opt.votes.toLocaleString()} votes)
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Info & Prompt */}
      <div className="mt-3.5 pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {hasVoted ? (
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Your vote is counted in real time! You can change it anytime.</span>
            </span>
          ) : (
            <span className="text-stone-500">
              Tap any option to cast your vote and see live community consensus.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => fetchDilemma(true)}
          className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800 rounded-md"
          title="Refresh poll results"
          aria-label="Refresh weekly dilemma poll results"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>
    </section>
  );
};

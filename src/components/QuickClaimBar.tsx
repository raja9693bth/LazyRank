import React, { useState } from 'react';
import { Sparkles, ArrowRight, User, Tag } from 'lucide-react';
import { BROWSE_CATEGORIES } from '../utils/showcase.ts';

interface QuickClaimBarProps {
  onQuickClaim: (params: { name: string; category?: string }) => void;
  isLoading?: boolean;
}

export const QuickClaimBar: React.FC<QuickClaimBarProps> = ({
  onQuickClaim,
  isLoading = false
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onQuickClaim({
      name: name.trim(),
      category: category || undefined
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-4 sm:my-6 px-3">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#ede5db] bg-white p-2.5 sm:p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        aria-label="Quick claim form"
      >
        {/* Name Input */}
        <div className="flex-1 relative flex items-center min-w-0">
          <label htmlFor="quick-claim-name" className="sr-only">
            Your name or @handle
          </label>
          <User className="absolute left-3 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            id="quick-claim-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name or @handle..."
            maxLength={30}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#faf8f4] border border-[#ede5db] text-xs sm:text-sm font-semibold text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-stone-800 focus:outline-none transition-colors"
          />
        </div>

        {/* Category Select */}
        <div className="sm:w-44 relative flex items-center shrink-0">
          <label htmlFor="quick-claim-category" className="sr-only">
            Select lazy category
          </label>
          <Tag className="absolute left-3 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
          <select
            id="quick-claim-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full pl-8 pr-7 py-2 rounded-xl bg-[#faf8f4] border border-[#ede5db] text-xs font-semibold text-stone-800 focus:bg-white focus:border-stone-800 focus:outline-none appearance-none cursor-pointer transition-colors"
          >
            <option value="">Category (Optional)</option>
            {BROWSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 pointer-events-none text-stone-400 text-[10px]">
            ▼
          </div>
        </div>

        {/* Submit Button */}
        <button
          id="quick-claim-submit-btn"
          type="submit"
          disabled={!name.trim() || isLoading}
          aria-label="Claim your rank"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-xl bg-[#e86638] hover:bg-[#d8582b] text-white text-xs sm:text-sm font-black tracking-tight shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Claim Rank</span>
          <ArrowRight className="w-3.5 h-3.5 text-white/90" />
        </button>
      </form>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Trophy, ShieldCheck, Activity } from 'lucide-react';

export type MobileNavSection = 'leaderboard' | 'claim' | 'activity';

interface MobileBottomNavProps {
  onSelectSection: (section: MobileNavSection) => void;
  activeSection?: MobileNavSection;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onSelectSection,
  activeSection: controlledActiveSection
}) => {
  const [internalActiveSection, setInternalActiveSection] = useState<MobileNavSection>('leaderboard');

  const currentActive = controlledActiveSection || internalActiveSection;

  // Auto-detect which section is visible in the viewport using IntersectionObserver
  useEffect(() => {
    const sectionIds: { id: string; section: MobileNavSection }[] = [
      { id: 'leaderboard-section', section: 'leaderboard' },
      { id: 'action-panel-section', section: 'claim' },
      { id: 'activity-section', section: 'activity' }
    ];

    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find the entry that has the largest intersection ratio or is currently intersecting
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible.length > 0) {
        const matched = sectionIds.find((s) => s.id === visible[0].target.id);
        if (matched) {
          setInternalActiveSection(matched.section);
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-15% 0px -40% 0px',
      threshold: [0.1, 0.3, 0.6]
    });

    sectionIds.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-[#fffdfa]/95 backdrop-blur-md border-t border-[#ede5db] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto gap-1">
        {/* 1. LEADERBOARD */}
        <button
          type="button"
          id="nav-btn-leaderboard"
          onClick={() => onSelectSection('leaderboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
            currentActive === 'leaderboard'
              ? 'text-[#9c3a16] bg-[#faeee5]/80 font-bold'
              : 'text-stone-500 hover:text-stone-900 font-medium'
          }`}
        >
          <div className="relative">
            <Trophy className={`w-5 h-5 transition-transform ${currentActive === 'leaderboard' ? 'scale-110 text-[#b44b1c]' : ''}`} />
            {currentActive === 'leaderboard' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#b44b1c]" />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight leading-none whitespace-nowrap">
            Leaderboard
          </span>
        </button>

        {/* 2. CLAIM (Primary Highlighted Action) */}
        <button
          type="button"
          id="nav-btn-claim"
          onClick={() => onSelectSection('claim')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
            currentActive === 'claim'
              ? 'text-[#9c3a16] bg-[#faeee5] font-extrabold shadow-2xs border border-[#f2ded0]'
              : 'text-stone-700 hover:text-stone-950 font-semibold bg-[#faf8f5] border border-[#eee5d9]'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <div className={`p-1 rounded-lg transition-colors ${currentActive === 'claim' ? 'bg-[#b44b1c] text-white' : 'bg-[#fae7dc] text-[#913813]'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[11px] mt-1 tracking-tight leading-none whitespace-nowrap">
            Claim Rank
          </span>
        </button>

        {/* 3. ACTIVITY */}
        <button
          type="button"
          id="nav-btn-activity"
          onClick={() => onSelectSection('activity')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
            currentActive === 'activity'
              ? 'text-[#9c3a16] bg-[#faeee5]/80 font-bold'
              : 'text-stone-500 hover:text-stone-900 font-medium'
          }`}
        >
          <div className="relative">
            <Activity className={`w-5 h-5 transition-transform ${currentActive === 'activity' ? 'scale-110 text-[#b44b1c]' : ''}`} />
            {currentActive === 'activity' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#b44b1c]" />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight leading-none whitespace-nowrap">
            Activity
          </span>
        </button>
      </div>
    </nav>
  );
};

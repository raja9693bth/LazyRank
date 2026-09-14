import React, { useState, useMemo } from 'react';
import { ActivityEvent } from '../types.ts';
import { Activity, Crown, Swords, Flame, Sparkles, CheckCircle2, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';

export type ActivityTab = 'All' | 'New Nominations' | 'Top Claims';

interface ActivityFeedProps {
  activities: ActivityEvent[];
  onOpenChallenge?: () => void;
}

const isNominationActivity = (act: ActivityEvent): boolean => {
  if (act.type === 'challenge') return true;
  const lower = act.text.toLowerCase();
  return (
    lower.includes('challenge') ||
    lower.includes('nominate') ||
    lower.includes('nominated') ||
    lower.includes('nomination') ||
    lower.includes('nominator')
  );
};

const isTopClaimActivity = (act: ActivityEvent): boolean => {
  if (act.type === 'top1' || act.type === 'displaced' || act.type === 'upgrade') return true;
  const text = act.text;
  if (
    /#1\b/i.test(text) ||
    /crown/i.test(text) ||
    /took #1/i.test(text) ||
    /top 1\b/i.test(text) ||
    /rank #1\b/i.test(text) ||
    /rank #2\b/i.test(text) ||
    /rank #3\b/i.test(text)
  ) {
    return true;
  }
  if (typeof act.amount === 'number' && act.amount >= 1000 && act.type !== 'challenge') {
    return true;
  }
  return false;
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, onOpenChallenge }) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('All');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const timeAgo = (isoString: string) => {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const allCount = activities.length;
  const nominationsCount = useMemo(() => activities.filter(isNominationActivity).length, [activities]);
  const topClaimsCount = useMemo(() => activities.filter(isTopClaimActivity).length, [activities]);

  const filteredActivities = useMemo(() => {
    if (activeTab === 'New Nominations') {
      return activities.filter(isNominationActivity);
    }
    if (activeTab === 'Top Claims') {
      return activities.filter(isTopClaimActivity);
    }
    return activities;
  }, [activities, activeTab]);

  const tabs: {
    id: ActivityTab;
    label: string;
    icon: React.ElementType;
    count: number;
    activeIconColor: string;
  }[] = [
    {
      id: 'All',
      label: 'All',
      icon: Activity,
      count: allCount,
      activeIconColor: 'text-amber-400',
    },
    {
      id: 'New Nominations',
      label: 'New Nominations',
      icon: Swords,
      count: nominationsCount,
      activeIconColor: 'text-purple-400',
    },
    {
      id: 'Top Claims',
      label: 'Top Claims',
      icon: Crown,
      count: topClaimsCount,
      activeIconColor: 'text-amber-400',
    },
  ];

  const INITIAL_LIMIT = 6;
  const displayedActivities = isExpanded ? filteredActivities : filteredActivities.slice(0, INITIAL_LIMIT);

  const getActivityBadge = (act: ActivityEvent) => {
    if (isNominationActivity(act)) {
      return {
        icon: Swords,
        iconColor: 'text-purple-600',
        dotColor: 'bg-purple-500',
        tag: 'Nomination',
        tagClass: 'bg-purple-50 text-purple-800 border-purple-200/80',
      };
    }
    if (act.type === 'top1' || act.text.toLowerCase().includes('took #1') || act.text.includes('#1')) {
      return {
        icon: Crown,
        iconColor: 'text-amber-500',
        dotColor: 'bg-amber-400 ring-2 ring-amber-200',
        tag: '#1 Claim',
        tagClass: 'bg-amber-50 text-amber-900 border-amber-200/80',
      };
    }
    if (act.type === 'displaced' || act.text.toLowerCase().includes('pushed to')) {
      return {
        icon: Flame,
        iconColor: 'text-rose-500',
        dotColor: 'bg-rose-500',
        tag: 'Dethroned',
        tagClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      };
    }
    if (act.type === 'upgrade' || act.text.toLowerCase().includes('boosted')) {
      return {
        icon: Sparkles,
        iconColor: 'text-emerald-600',
        dotColor: 'bg-emerald-500',
        tag: 'Boosted',
        tagClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      };
    }
    return {
      icon: CheckCircle2,
      iconColor: 'text-zinc-400',
      dotColor: 'bg-amber-400',
      tag: 'Claim',
      tagClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    };
  };

  return (
    <section id="activity-section" className="w-full max-w-2xl mx-auto my-4 sm:my-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-zinc-500" />
          <span>Live Activity Feed</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Updates
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter activity feed"
        className="flex items-center gap-1 p-1 bg-zinc-100/90 rounded-xl border border-zinc-200/70 mb-3 overflow-x-auto no-scrollbar"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`activity-tab-${tab.id.toLowerCase().replace(/\s+/g, '-')}`}
              role="tab"
              aria-selected={isActive}
              aria-controls="activity-feed-panel"
              onClick={() => {
                setActiveTab(tab.id);
                setIsExpanded(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 ${
                isActive
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
              }`}
            >
              <TabIcon className={`w-3.5 h-3.5 ${isActive ? tab.activeIconColor : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panel / List */}
      <div id="activity-feed-panel" role="tabpanel" aria-labelledby={`activity-tab-${activeTab.toLowerCase().replace(/\s+/g, '-')}`}>
        {filteredActivities.length === 0 ? (
          <div className="rounded-xl border border-zinc-200/70 bg-white p-6 text-center shadow-2xs">
            {activeTab === 'New Nominations' ? (
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                  <Swords className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-zinc-800">No active nominations yet</p>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Know a friend whose sheer dedication to doing nothing deserves recognition?
                </p>
                {onOpenChallenge && (
                  <button
                    type="button"
                    onClick={onOpenChallenge}
                    aria-label="Nominate a friend for lazy recognition"
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-bold transition-colors shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-purple-300" />
                    <span>Nominate a Friend</span>
                  </button>
                )}
              </div>
            ) : activeTab === 'Top Claims' ? (
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Crown className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-zinc-800">No top claims yet</p>
                <p className="text-xs text-zinc-500 max-w-sm">
                  The throne of procrastination is unoccupied. Claim #1 to make history!
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 py-2">It's suspiciously quiet. No activity recorded yet.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/70 bg-white overflow-hidden shadow-2xs">
            {displayedActivities.map((act) => {
              const badge = getActivityBadge(act);
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={act.id}
                  className="flex items-center justify-between text-xs px-3.5 py-2.5 hover:bg-zinc-50/80 transition-colors text-zinc-700 gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dotColor}`} />
                    
                    <span
                      className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badge.tagClass}`}
                      title={badge.tag}
                    >
                      <BadgeIcon className={`w-3 h-3 ${badge.iconColor}`} />
                      <span>{badge.tag}</span>
                    </span>

                    <span className="truncate text-zinc-800 font-medium">{act.text}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {act.amount !== undefined && act.amount > 0 && (
                      <span className="text-[10px] font-mono-numbers font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                        ₹{act.amount.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 font-mono-numbers whitespace-nowrap">
                      {timeAgo(act.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredActivities.length > INITIAL_LIMIT && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-label={isExpanded ? "Show fewer activity items" : `Show ${filteredActivities.length - INITIAL_LIMIT} more activity items`}
                className="w-full flex items-center justify-center gap-1 py-2 text-[11px] font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors cursor-pointer border-t border-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
              >
                {isExpanded ? (
                  <>
                    <span>Show fewer</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Show {filteredActivities.length - INITIAL_LIMIT} more</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

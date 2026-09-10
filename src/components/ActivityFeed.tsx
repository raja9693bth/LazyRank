import React from 'react';
import { ActivityEvent } from '../types.ts';
import { Activity } from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const timeAgo = (isoString: string) => {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <section className="w-full max-w-2xl mx-auto my-4 sm:my-5">
      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-zinc-400" />
          <span>Latest Activity</span>
        </h3>
        <span className="text-[10px] text-zinc-400 font-semibold">Live Updates</span>
      </div>

      {activities.length === 0 ? (
        <p className="text-xs text-zinc-400 py-2.5 text-center">It's suspiciously quiet.</p>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/70 bg-white overflow-hidden shadow-2xs">
          {activities.slice(0, 6).map((act) => (
            <div
              key={act.id}
              className="flex items-center justify-between text-xs px-3 py-2 hover:bg-zinc-50/70 transition-colors text-zinc-700"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate text-zinc-800">{act.text}</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono-numbers shrink-0">
                {timeAgo(act.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

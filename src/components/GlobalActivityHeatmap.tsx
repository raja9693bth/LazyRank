import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Clock, TrendingUp, Sparkles, ChevronRight, Activity, Calendar, ShieldCheck, Zap } from 'lucide-react';
import { GlobalActivityData, HourlyActivityBucket, DayActivityBucket } from '../types.ts';

interface GlobalActivityHeatmapProps {
  onClaimClick?: () => void;
  refreshTrigger?: number;
}

export const GlobalActivityHeatmap: React.FC<GlobalActivityHeatmapProps> = ({
  onClaimClick,
  refreshTrigger = 0
}) => {
  const [data, setData] = useState<GlobalActivityData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedView, setSelectedView] = useState<'24h' | '7d'>('24h');
  const [hoveredHour, setHoveredHour] = useState<HourlyActivityBucket | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DayActivityBucket | null>(null);

  const fetchGlobalActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity/global');
      if (res.ok) {
        const json: GlobalActivityData = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('Failed to load global activity data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalActivity();
    // Non-intrusive polling every 30 seconds for live updates
    const interval = setInterval(fetchGlobalActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchGlobalActivity, refreshTrigger]);

  // Strictly truthful zero-defaults (no simulated claims or fake amounts)
  const formatHour = (hour: number): string =>
    hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;

  const claimsToday: number = data?.claimsToday ?? 0;
  const totalAmountToday: number = data?.totalAmountToday ?? 0;
  const peakHour: string | null = data?.peakHour ?? null;
  const latestMinutesAgo: number | null = data?.latestClaimMinutesAgo ?? null;
  const hourlyActivity: GlobalActivityData['hourlyActivity'] =
    data?.hourlyActivity ?? Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: formatHour(hour),
      claimsCount: 0,
      amount: 0,
      intensity: 0,
      isCurrentHour: hour === new Date().getHours(),
    }));

  return (
    <section
      id="global-activity-section"
      data-testid="global-activity-heatmap"
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-6"
    >
      <div className="bg-[#fcfaf7] border border-[#ede5db] rounded-2xl p-4 sm:p-5 shadow-2xs transition-all hover:border-[#e2d8cb]">
        {/* Top Header: Badge, Counter, Quick Social Proof stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-[#ede5db]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Live Pulsing Dot Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black tracking-wider uppercase">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>LIVE GLOBAL ACTIVITY</span>
              </div>

              {/* Verified Proof Tag */}
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-500">
                <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
                <span>Verified Database Records</span>
              </span>
            </div>

            {/* Main Total Claims Today Headline - Proper H2 */}
            <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-600 fill-orange-500 shrink-0" />
                <span className="font-mono-numbers text-orange-600">{claimsToday}</span>
                <span>claims made across the app today</span>
              </h2>
            </div>
            <p className="text-xs text-stone-600">
              Real-time activity heat map showing claim density and peak lethargy across India today.
            </p>
          </div>

          {/* Right Context Stats Cards & View Switcher */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-start sm:items-center md:items-end lg:items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#ede5db] shadow-2xs">
              <div className="text-right">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Today's Volume</div>
                <div className="font-mono-numbers font-black text-sm text-stone-900">
                  ₹{totalAmountToday.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="h-6 w-px bg-stone-200" />
              <div className="text-left">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Peak Hour</div>
                <div className="text-xs font-black text-amber-700 whitespace-nowrap">{peakHour || 'None yet'}</div>
              </div>
            </div>

            {/* View Toggle Tabs */}
            <div role="tablist" aria-label="Activity timeframe" className="inline-flex p-1 rounded-xl bg-stone-100 border border-stone-200/80 text-xs font-bold text-stone-600">
              <button
                type="button"
                role="tab"
                id="view-today-24h-btn"
                aria-selected={selectedView === '24h'}
                aria-label="View hourly distribution for today"
                onClick={() => setSelectedView('24h')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                  selectedView === '24h'
                    ? 'bg-white text-stone-950 font-black shadow-2xs'
                    : 'hover:text-stone-900'
                }`}
              >
                Today (24h)
              </button>
              <button
                type="button"
                role="tab"
                id="view-past-7d-btn"
                aria-selected={selectedView === '7d'}
                aria-label="View claims over the last 7 days"
                onClick={() => setSelectedView('7d')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                  selectedView === '7d'
                    ? 'bg-white text-stone-950 font-black shadow-2xs'
                    : 'hover:text-stone-900'
                }`}
              >
                Past 7 Days
              </button>
            </div>
          </div>
        </div>

        {/* Heat Map Visualization Area */}
        <div className="pt-3.5">
          {selectedView === '24h' ? (
            /* 24-Hour Timeline Grid */
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>Hourly distribution for today (00:00 – 23:59)</span>
                </span>
                <span className="text-[10px] text-stone-400">
                  {latestMinutesAgo === null
                    ? 'No claims yet'
                    : `Last claim: ${latestMinutesAgo} ${latestMinutesAgo === 1 ? 'min' : 'mins'} ago`}
                </span>
              </div>

              {/* 24 Heat Map Blocks Grid */}
              <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 sm:gap-1.5 py-1">
                {hourlyActivity.map((bucket) => {
                  const getIntensityClasses = (lvl: number) => {
                    switch (lvl) {
                      case 4:
                        return 'bg-orange-500 border-orange-600 text-white shadow-xs';
                      case 3:
                        return 'bg-amber-400 border-amber-500 text-amber-950';
                      case 2:
                        return 'bg-amber-200 border-amber-300 text-amber-900';
                      case 1:
                        return 'bg-amber-100/90 border-amber-200 text-amber-800';
                      default:
                        return 'bg-stone-100/80 border-stone-200/60 text-stone-400 hover:border-stone-300';
                    }
                  };

                  return (
                    <button
                      type="button"
                      key={bucket.hour}
                      onMouseEnter={() => setHoveredHour(bucket)}
                      onMouseLeave={() => setHoveredHour(null)}
                      onClick={() => setHoveredHour(bucket)}
                      className={`relative group flex flex-col items-center justify-between h-12 sm:h-14 rounded-lg border p-1 transition-all cursor-pointer ${getIntensityClasses(
                        bucket.intensity
                      )} ${bucket.isCurrentHour ? 'ring-2 ring-stone-900 ring-offset-1 scale-[1.02]' : ''}`}
                      title={`${bucket.label}: ${bucket.claimsCount} claims (${bucket.amount > 0 ? `₹${bucket.amount.toLocaleString('en-IN')}` : 'No claims'})`}
                    >
                      <span className="text-[9px] font-mono-numbers font-extrabold leading-none opacity-80">
                        {bucket.hour.toString().padStart(2, '0')}h
                      </span>

                      {/* Claim Count Pill inside Block */}
                      <span className="font-mono-numbers text-[10px] font-black leading-none my-auto">
                        {bucket.claimsCount > 0 ? bucket.claimsCount : '·'}
                      </span>

                      {/* Current Hour Indicator Dot */}
                      {bucket.isCurrentHour ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 ring-1 ring-white shrink-0 animate-ping" />
                      ) : (
                        <span className="w-1 h-1 rounded-full opacity-30 bg-current shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Time Scale Labels */}
              <div className="flex items-center justify-between text-[10px] font-mono-numbers text-stone-400 px-1 pt-1.5">
                <span>12 AM</span>
                <span className="hidden sm:inline">4 AM</span>
                <span>8 AM</span>
                <span>12 PM</span>
                <span className="hidden sm:inline">4 PM</span>
                <span>8 PM</span>
                <span>11 PM</span>
              </div>
            </div>
          ) : (
            /* 7-Day Activity Grid */
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-2">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>Claims over the last 7 calendar days</span>
                </span>
                <span className="text-[10px] text-stone-400">Past week momentum</span>
              </div>

              <div className="grid grid-cols-7 gap-2 py-1">
                {(data?.recentDays || []).map((day) => {
                  const getIntensityClasses = (lvl: number) => {
                    switch (lvl) {
                      case 4:
                        return 'bg-orange-500 text-white border-orange-600';
                      case 3:
                        return 'bg-amber-400 text-amber-950 border-amber-500';
                      case 2:
                        return 'bg-amber-200 text-amber-900 border-amber-300';
                      case 1:
                        return 'bg-amber-100 text-amber-800 border-amber-200';
                      default:
                        return 'bg-stone-100 text-stone-500 border-stone-200';
                    }
                  };

                  return (
                    <div
                      key={day.date}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all ${getIntensityClasses(
                        day.intensity
                      )} ${day.isToday ? 'ring-2 ring-stone-900 ring-offset-1' : ''}`}
                    >
                      <span className="text-[11px] font-bold tracking-tight uppercase">
                        {day.dayName} {day.isToday ? '• Today' : ''}
                      </span>
                      <div className="my-1.5 text-center">
                        <span className="font-mono-numbers text-base sm:text-lg font-black block">
                          {day.claimsCount}
                        </span>
                        <span className="text-[9px] font-semibold opacity-85 block">claims</span>
                      </div>
                      <span className="text-[10px] font-mono-numbers font-extrabold opacity-90">
                        ₹{day.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Tooltip Card when hovering on an hour */}
          {hoveredHour && selectedView === '24h' && (
            <div className="mt-2.5 px-3 py-2 rounded-xl bg-white border border-[#e2d8cb] shadow-xs text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="font-black text-stone-900">
                  {hoveredHour.label} – {hoveredHour.hour === 23 ? '12 AM' : `${(hoveredHour.hour + 1) % 12 || 12} ${hoveredHour.hour + 1 >= 12 && hoveredHour.hour + 1 < 24 ? 'PM' : 'AM'}`}
                </span>
                {hoveredHour.isCurrentHour && (
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-extrabold">
                    CURRENT HOUR
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono-numbers text-stone-600">
                <span>
                  <strong className="text-stone-900">{hoveredHour.claimsCount}</strong> {hoveredHour.claimsCount === 1 ? 'claim' : 'claims'}
                </span>
                <span>•</span>
                <span>
                  <strong className="text-stone-900">₹{hoveredHour.amount.toLocaleString('en-IN')}</strong> total
                </span>
              </div>
            </div>
          )}

          {/* Footer Legend & Quick Join Action */}
          <div className="mt-3.5 pt-3 border-t border-[#ede5db] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            {/* Heat Intensity Scale Legend */}
            <div className="flex items-center gap-2 text-stone-500 text-[11px]">
              <span className="font-bold">Claims:</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px]">Less</span>
                <span className="w-3.5 h-3.5 rounded bg-stone-100 border border-stone-200" title="0 claims" />
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-200" title="1 claim" />
                <span className="w-3.5 h-3.5 rounded bg-amber-200 border border-amber-300" title="2 claims" />
                <span className="w-3.5 h-3.5 rounded bg-amber-400 border border-amber-500" title="3-4 claims" />
                <span className="w-3.5 h-3.5 rounded bg-orange-500 border border-orange-600" title="5+ claims" />
                <span className="text-[10px]">More</span>
              </div>
            </div>

            {/* Reassuring Social Proof Text & Quick Trigger */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-stone-500 hidden sm:inline">
                Every verified rank claim immediately lights up this global heat map.
              </span>
              {onClaimClick && (
                <button
                  type="button"
                  id="heat-map-join-claim-btn"
                  onClick={onClaimClick}
                  aria-label="Claim a rank on the leaderboard"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                >
                  <span>Claim a rank</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

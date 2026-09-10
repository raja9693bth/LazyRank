import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Check, AlertTriangle, Eye, Trash2, RefreshCw, Activity, Users, DollarSign, Trophy } from 'lucide-react';
import { AnalyticsSummary, Nomination, ReportRecord, UserProfile, LiveStats } from '../types.ts';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<ModalBaseProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <h3 className="font-black text-lg text-zinc-950">About LAZY</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-zinc-700 leading-relaxed">
          <p>
            <strong>LAZY</strong> is a public pay-to-rank internet game built around one absurd question:
          </p>
          <p className="text-base font-extrabold text-zinc-950 py-1">
            "How much are you willing to pay to prove you are the laziest?"
          </p>
          <ul className="space-y-1.5 text-xs text-zinc-600 list-disc list-inside">
            <li>Your verified payment amount is your ranking signal.</li>
            <li>Higher verified payment = Higher public rank.</li>
            <li>Claim #1 by paying more than the current #1.</li>
            <li>Share your official 9:16 legitimacy card to challenge friends.</li>
            <li>All rankings are computed and verified server-side.</li>
          </ul>
          <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-100">
            Transparent, funny, and ruthlessly honest.
          </p>
        </div>
      </div>
    </div>
  );
};

export const RulesModal: React.FC<ModalBaseProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <h3 className="font-black text-lg text-zinc-950">Official Rules & Terms (v2.0)</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-xs text-zinc-600 leading-relaxed">
          <div>
            <h4 className="font-bold text-zinc-900">1. The Core Ranking Rule</h4>
            <p>Rank is strictly determined by verified payment amount. Higher amount = higher rank. If two users pay identical amounts, earlier verification timestamp takes priority.</p>
          </div>
          <div>
            <h4 className="font-bold text-zinc-900">2. Voluntary Entertainment Game</h4>
            <p>Payments made to LAZY are for participation in a public internet joke and leaderboard ranking. No financial return, equity, or commercial benefit is offered.</p>
          </div>
          <div>
            <h4 className="font-bold text-zinc-900">3. Verified Server Source of Truth</h4>
            <p>Client requests are never trusted for rank computation. Official rank is evaluated atomically upon confirmed receipt.</p>
          </div>
          <div>
            <h4 className="font-bold text-zinc-900">4. Community Moderation & Links</h4>
            <p>Hate speech, profanity, harassment, or malicious links will be moderated or removed. Clean Instagram and website links are welcomed.</p>
          </div>
          <div>
            <h4 className="font-bold text-zinc-900">5. Upgrades & Accumulation</h4>
            <p>Users may submit subsequent payments to increase their verified total amount and improve their position.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReportModalProps extends ModalBaseProps {
  targetId: string;
  targetType: 'profile' | 'nomination';
  onReportSubmitted: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  onReportSubmitted
}) => {
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() })
      });
      setSubmitted(true);
      setTimeout(() => {
        onReportSubmitted();
        onClose();
      }, 1500);
    } catch {
      // Handled
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-zinc-200">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="font-extrabold text-sm text-zinc-950">Report Content</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center text-xs text-emerald-600 font-bold">
            Report received. Our moderation queue has flagged this item.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <p className="text-xs text-zinc-600">
              Please let us know why this entry violates guidelines:
            </p>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the issue..."
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface AdminModalProps extends ModalBaseProps {
  onRefreshLeaderboard: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose, onRefreshLeaderboard }) => {
  const [key, setKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadData = async (adminKey: string) => {
    if (!adminKey.trim()) {
      setAuthError('Please enter the admin key.');
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/data', {
        headers: {
          'x-admin-key': adminKey.trim()
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
        setIsAuthenticated(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setAuthError(err.error || 'Unauthorized admin access.');
        setIsAuthenticated(false);
      }
    } catch {
      setAuthError('Network error while connecting to admin endpoint.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleModerate = async (action: 'remove' | 'restore', targetId: string) => {
    await fetch('/api/admin/moderate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': key.trim()
      },
      body: JSON.stringify({ action, targetId })
    });
    loadData(key);
    onRefreshLeaderboard();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-zinc-900" />
            <h3 className="font-extrabold text-base text-zinc-950">LAZY v2.0 Admin & Revenue Dashboard</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isAuthenticated ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadData(key);
            }}
            className="mt-4 space-y-3"
          >
            <label className="block text-xs font-bold text-zinc-700">Admin Secret Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter secure admin key..."
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-zinc-900"
            />
            {authError && (
              <div className="text-xs font-semibold text-rose-600">
                {authError}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Login to Admin'}
            </button>
          </form>
        ) : (
          <div className="mt-4 space-y-6">
            {/* Analytics Overview */}
            {adminData?.analytics && (
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 mb-2">
                  Validation & Revenue
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase text-zinc-400 font-bold block">Total Revenue</span>
                    <span className="text-xl font-black font-mono-numbers text-amber-600">
                      ₹{adminData.analytics.totalRevenueINR.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase text-zinc-400 font-bold block">Verified Purchases</span>
                    <span className="text-xl font-black font-mono-numbers text-zinc-900">
                      {adminData.analytics.successfulPurchases}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase text-zinc-400 font-bold block">Homepage Views</span>
                    <span className="text-xl font-black font-mono-numbers text-zinc-900">
                      {adminData.analytics.homepageViews}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase text-zinc-400 font-bold block">Share Clicks</span>
                    <span className="text-xl font-black font-mono-numbers text-zinc-900">
                      {adminData.analytics.shareClicks}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Verified Paid Profiles */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                  Verified Paid Profiles ({adminData?.profiles?.length || 0})
                </h4>
                <button
                  onClick={() => loadData(key)}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {adminData?.profiles?.map((p: UserProfile) => (
                  <div key={p.id} className="p-3 text-xs flex items-center justify-between hover:bg-zinc-50">
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-zinc-900 flex items-center gap-2">
                        <span>#{p.rank} {p.name}</span>
                        <span className="text-amber-600 font-mono-numbers font-extrabold">₹{p.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-zinc-500 italic truncate max-w-xs mt-0.5">
                        "{p.reason}"
                      </p>
                      {p.isReported && (
                        <span className="text-[9px] uppercase px-1 py-0.5 rounded font-bold bg-rose-100 text-rose-700">
                          Reported
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.isReported ? (
                        <button
                          onClick={() => handleModerate('restore', p.id)}
                          className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-[11px] font-bold cursor-pointer"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => handleModerate('remove', p.id)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-[11px] font-bold cursor-pointer"
                        >
                          Hide
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reports list */}
            {adminData?.reports?.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-600 mb-2">
                  Flagged Reports ({adminData.reports.length})
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {adminData.reports.map((rep: ReportRecord) => (
                    <div key={rep.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-zinc-800">
                      <span className="font-bold text-rose-700">Report: </span>
                      {rep.reason} (Target: {rep.targetId})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Support Inquiries from /contact */}
            {adminData?.contactMessages?.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 mb-2">
                  Support Inquiries ({adminData.contactMessages.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {adminData.contactMessages.map((msg: any) => (
                    <div key={msg.id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 space-y-1">
                      <div className="flex items-center justify-between font-bold text-zinc-950">
                        <span>{msg.name} ({msg.email})</span>
                        <span className="text-[10px] text-zinc-400">{new Date(msg.createdAt).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-zinc-600 font-semibold">
                        Subject: <span className="text-zinc-900">{msg.subject}</span>
                        {msg.orderId && <span className="ml-2 text-amber-700 font-mono">Order: {msg.orderId}</span>}
                      </div>
                      <p className="text-zinc-700 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface LiveStatsModalProps extends ModalBaseProps {
  stats: LiveStats | null;
  onRefresh?: () => void;
}

export const LiveStatsModal: React.FC<LiveStatsModalProps> = ({ isOpen, onClose, stats, onRefresh }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h3 className="font-extrabold text-base text-zinc-950">Live Leaderboard Stats</h3>
            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              REAL-TIME
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh stats"
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Active Online</span>
              </div>
              <div className="font-mono-numbers font-black text-2xl text-zinc-950">
                {stats?.online || 1}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Active in last 5m
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                <span>Visits Today</span>
              </div>
              <div className="font-mono-numbers font-black text-2xl text-zinc-950">
                {stats?.visitsToday || 1}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                UTC calendar day
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
              <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold mb-1">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                <span>Verified Revenue</span>
              </div>
              <div className="font-mono-numbers font-black text-2xl text-amber-950">
                ₹{(stats?.totalVerifiedRevenue || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-amber-700/80 mt-0.5">
                Total proven laziness
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span>Verified Ranks</span>
              </div>
              <div className="font-mono-numbers font-black text-2xl text-zinc-950">
                {stats?.totalVerifiedParticipants || 0}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                Paid board entries
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[11px] text-zinc-400 font-medium">To Take #1 Today</div>
                <div className="text-xs font-bold text-white">Current #1: ₹{(stats?.topAmount || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono-numbers font-black text-amber-400">
                ₹{(stats?.minAmountToBeatTop || 1).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-zinc-400">required</div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed pt-1">
            <strong>Real Traffic & Settlement:</strong> All figures above reflect genuine server transactions and active user sessions. We do not use bots, synthetic counters, or fabricated visitors.
          </p>
        </div>
      </div>
    </div>
  );
};

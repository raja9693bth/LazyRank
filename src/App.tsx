import React, { useState, useEffect } from 'react';
import { UserProfile, ActivityEvent, RankPeriod, LeaderboardResponse, LiveStats } from './types.ts';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { ActionPanel } from './components/ActionPanel.tsx';
import { Leaderboard } from './components/Leaderboard.tsx';
import { ActivityFeed } from './components/ActivityFeed.tsx';
import { HowItWorks } from './components/HowItWorks.tsx';
import { ResultView } from './components/ResultView.tsx';
import { NominationModal } from './components/NominationModal.tsx';
import { PaymentModal } from './components/PaymentModal.tsx';
import { AboutModal, RulesModal, ReportModal, AdminModal, LiveStatsModal } from './components/InfoModals.tsx';
import { Footer } from './components/Footer.tsx';
import { TermsPage } from './pages/TermsPage.tsx';
import { PrivacyPage } from './pages/PrivacyPage.tsx';
import { RefundPage } from './pages/RefundPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { RulesPage } from './pages/RulesPage.tsx';
import { updatePageSeo } from './utils/seo.ts';
import { Swords } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.replace(/\/+$/, '');
      return p || '/';
    }
    return '/';
  });

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [allTimeTop3, setAllTimeTop3] = useState<UserProfile[]>([]);
  const [topAmount, setTopAmount] = useState<number>(5001);
  const [minAmountToBeatTop, setMinAmountToBeatTop] = useState<number>(5002);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<RankPeriod>('today');
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [isLiveStatsOpen, setIsLiveStatsOpen] = useState(false);

  // Pagination & Filtering State (v2.1 Full Leaderboard Access)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'verified' | 'all'>('verified');

  // Form & Order State
  const [initialClaimAmount, setInitialClaimAmount] = useState<number | undefined>(undefined);
  const [orderData, setOrderData] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Challenge Banner state
  const [incomingChallenge, setIncomingChallenge] = useState<{
    friendName: string;
    targetAmount?: number;
  } | null>(null);

  // Navigation & Modals
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [challengeTargetRank, setChallengeTargetRank] = useState<number | undefined>(undefined);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [reportingTargetId, setReportingTargetId] = useState<string | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // Load Leaderboard from Server with full server-side pagination & filter support
  const loadLeaderboard = async (
    period: RankPeriod = currentPeriod,
    offset: number = 0,
    limit: number = 20,
    filter: 'verified' | 'all' = filterMode,
    isAppend: boolean = false
  ) => {
    if (isAppend) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingLeaderboard(true);
    }

    try {
      const res = await fetch(`/api/leaderboard?period=${period}&offset=${offset}&limit=${limit}&filter=${filter}`);
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        if (isAppend) {
          setProfiles(prev => [...prev, ...(data.profiles || [])]);
        } else {
          setProfiles(data.profiles || []);
        }
        setTotalCount(data.totalCount || 0);
        setHasMore(data.hasMore || false);
        setCurrentPage(data.page || 1);
        if (typeof data.topAmount === 'number') {
          setTopAmount(data.topAmount);
        }
        if (typeof data.minAmountToBeatTop === 'number') {
          setMinAmountToBeatTop(data.minAmountToBeatTop);
        }
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsLoadingLeaderboard(false);
      setIsLoadingMore(false);
    }
  };

  // Load Persistent All-Time Top 3 (Global Benchmark Layer)
  const loadAllTimeTop3 = async () => {
    try {
      const res = await fetch('/api/leaderboard?period=all&offset=0&limit=3&filter=verified');
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        setAllTimeTop3(data.profiles?.slice(0, 3) || []);
      }
    } catch {
      // Handled gracefully
    }
  };

  // Load Activities from Server
  const loadActivities = async () => {
    try {
      const res = await fetch('/api/activity');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch {
      // Handled
    }
  };

  // Load Live Real-time Stats
  const loadLiveStats = async () => {
    try {
      let sessionId = sessionStorage.getItem('lazy_session_id');
      if (!sessionId) {
        sessionId = 's_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        sessionStorage.setItem('lazy_session_id', sessionId);
      }
      const res = await fetch('/api/stats/live', {
        headers: { 'x-session-id': sessionId }
      });
      if (res.ok) {
        const data: LiveStats = await res.json();
        setLiveStats(data);
      }
    } catch {
      // Handled gracefully
    }
  };

  // Initial Load + URL parameter triage
  useEffect(() => {
    loadLeaderboard(currentPeriod);
    loadAllTimeTop3();
    loadActivities();
    loadLiveStats();

    // Periodic live stats polling (every 25s)
    const statsInterval = setInterval(loadLiveStats, 25000);

    // Track homepage view
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'homepageViews' })
    }).catch(() => {});

    // Check query params (?rank=id or ?challenge=name)
    const params = new URLSearchParams(window.location.search);
    const rankId = params.get('rank') || params.get('profile');
    if (rankId) {
      fetch(`/api/profile/${rankId}`)
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setSelectedProfile(data.profile);
          }
        })
        .catch(() => {});
    }

    const challengeName = params.get('challenge');
    const challengeTarget = params.get('target');
    if (challengeName) {
      const parsedTarget = challengeTarget ? parseInt(challengeTarget, 10) : undefined;
      setIncomingChallenge({
        friendName: decodeURIComponent(challengeName),
        targetAmount: parsedTarget
      });
      if (parsedTarget) {
        setInitialClaimAmount(parsedTarget);
      }
    }

    // Initialize page SEO metadata
    updatePageSeo(currentPath);

    // Browser back/forward navigation support
    const handlePopState = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      setCurrentPath(path);
      updatePageSeo(path);
      const params = new URLSearchParams(window.location.search);
      const rankParam = params.get('rank') || params.get('profile');
      if (!rankParam) {
        setSelectedProfile(null);
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      clearInterval(statsInterval);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = (path: string) => {
    const cleanPath = path.replace(/\/+$/, '') || '/';
    window.history.pushState({}, '', cleanPath);
    setCurrentPath(cleanPath);
    updatePageSeo(cleanPath);
    setSelectedProfile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePeriodChange = (period: RankPeriod) => {
    setCurrentPeriod(period);
    setCurrentPage(1);
    loadLeaderboard(period, 0, 20, filterMode, false);
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'leaderboardClicks' })
    }).catch(() => {});
  };

  const handleFilterChange = (filter: 'verified' | 'all') => {
    setFilterMode(filter);
    setCurrentPage(1);
    loadLeaderboard(currentPeriod, 0, 20, filter, false);
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore && !isLoadingLeaderboard) {
      const remaining = totalCount - profiles.length;
      const nextBatch = Math.min(100, Math.max(1, remaining));
      loadLeaderboard(currentPeriod, profiles.length, nextBatch, filterMode, true);
    }
  };

  // Initiates Checkout Order with Server
  const handleStartPayment = async (claimData: {
    name: string;
    amount: number;
    instagram?: string;
    website?: string;
    reason?: string;
    profileId?: string;
  }) => {
    setIsCreatingOrder(true);
    setOrderError(null);

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'claimStarts' })
    }).catch(() => {});

    try {
      let storedToken: string | undefined;
      if (claimData.profileId) {
        try {
          const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
          storedToken = tokens[claimData.profileId];
        } catch {}
      }

      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedToken ? { 'x-profile-token': storedToken } : {})
        },
        body: JSON.stringify({
          ...claimData,
          ownerToken: storedToken
        })
      });

      const data = await res.json();
      if (!res.ok || !data.orderId) {
        throw new Error(data.error || 'Failed to initiate payment.');
      }

      setOrderData(data);
      setIsPaymentModalOpen(true);
    } catch (err: any) {
      setOrderError(err.message || 'Payment initiation failed.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Successful Payment -> Show Result Card
  const handlePaymentSuccess = (profile: UserProfile, previousTop?: UserProfile, ownerToken?: string) => {
    setIsPaymentModalOpen(false);
    setOrderData(null);
    setSelectedProfile(profile);

    if (ownerToken && profile.id) {
      try {
        const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
        tokens[profile.id] = ownerToken;
        localStorage.setItem('lazy_tokens', JSON.stringify(tokens));
      } catch {}
    }

    window.history.pushState({}, '', `/?rank=${profile.id}`);

    // Refresh leaderboard, all-time top 3 & activities to reflect new verified rank
    loadLeaderboard(currentPeriod, 0, 20, filterMode, false);
    loadAllTimeTop3();
    loadActivities();
  };

  // Upgrading existing rank
  const handleUpgradeRank = (profile: UserProfile) => {
    setSelectedProfile(null);
    setInitialClaimAmount(minAmountToBeatTop);
    const el = document.getElementById('action-panel-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleVoteProfile = async (profileId: string) => {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId })
    });
    const data = await res.json();
    if (data.success && data.profile) {
      setProfiles(prev =>
        prev.map(p => (p.id === profileId ? data.profile : p))
      );
      if (selectedProfile && selectedProfile.id === profileId) {
        setSelectedProfile(data.profile);
      }
      loadActivities();
    }
  };

  const handleHeroClaim = (amount: number) => {
    setInitialClaimAmount(amount);
    const el = document.getElementById('action-panel-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const verifiedTop1 = profiles.find(p => p.rank === 1 && p.isVerified);
  const topProfile = verifiedTop1 || (topAmount > 0 ? { name: 'Current #1', amount: topAmount } : undefined);

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f5] text-stone-900">
      {/* Header with Live Stats (Section 4 & 5) */}
      <Header
        currentPeriod={currentPeriod}
        onSelectPeriod={handlePeriodChange}
        onOpenAbout={() => navigate('/about')}
        onOpenRules={() => navigate('/rules')}
        onOpenChallenge={() => {
          setChallengeTargetRank(undefined);
          setIsChallengeModalOpen(true);
        }}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onLogoClick={() => navigate('/')}
        liveStats={liveStats}
        onOpenLiveStats={() => setIsLiveStatsOpen(true)}
      />

      <main className="flex-1 w-full max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {currentPath === '/terms' ? (
          <TermsPage onNavigate={navigate} />
        ) : currentPath === '/privacy' ? (
          <PrivacyPage onNavigate={navigate} />
        ) : currentPath === '/refund-cancellation' || currentPath === '/refund' ? (
          <RefundPage onNavigate={navigate} />
        ) : currentPath === '/contact' ? (
          <ContactPage onNavigate={navigate} />
        ) : currentPath === '/about' ? (
          <AboutPage onNavigate={navigate} />
        ) : currentPath === '/rules' ? (
          <RulesPage onNavigate={navigate} />
        ) : (
          <>
            {/* Incoming Challenge Banner */}
            {incomingChallenge && !selectedProfile && (
              <div className="w-full max-w-2xl mx-auto my-3 p-3.5 rounded-2xl bg-amber-500 text-zinc-950 font-extrabold flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2 text-xs">
                  <Swords className="w-4 h-4" />
                  <span>
                    <strong>{incomingChallenge.friendName}</strong> challenged you to prove your laziness!
                    {incomingChallenge.targetAmount && (
                      <span className="ml-1 underline">Beat ₹{incomingChallenge.targetAmount} to top them.</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => setIncomingChallenge(null)}
                  className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {selectedProfile ? (
              /* RESULT / SHARE VIEW */
              <ResultView
                profile={selectedProfile}
                onBackToLeaderboard={() => {
                  setSelectedProfile(null);
                  navigate('/');
                }}
                onOpenChallenge={(targetRank) => {
                  setChallengeTargetRank(targetRank);
                  setIsChallengeModalOpen(true);
                }}
                onUpgradeRank={handleUpgradeRank}
              />
            ) : (
              /* HOMEPAGE VIEW (Hero -> Claim Action Panel -> Leaderboard -> Live Feed) */
              <>
                <Hero
                  topAmount={topProfile ? topProfile.amount : topAmount}
                  topProfileName={topProfile?.name}
                  minAmountToBeatTop={minAmountToBeatTop}
                  onClaimAmount={handleHeroClaim}
                  onScrollToLeaderboard={() => {
                    const el = document.getElementById('leaderboard-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                />

                <Leaderboard
                  profiles={profiles}
                  allTimeTop3={allTimeTop3}
                  currentPeriod={currentPeriod}
                  onSelectPeriod={handlePeriodChange}
                  onSelectProfile={(p) => {
                    setSelectedProfile(p);
                    window.history.pushState({}, '', `/?rank=${p.id}`);
                  }}
                  onVoteProfile={handleVoteProfile}
                  onReportProfile={(id) => setReportingTargetId(id)}
                  onClaimSpecificRank={(target) => handleHeroClaim(target)}
                  isLoading={isLoadingLeaderboard}
                  totalCount={totalCount}
                  hasMore={hasMore}
                  onLoadMore={handleLoadMore}
                  isLoadingMore={isLoadingMore}
                  currentFilter={filterMode}
                  onSelectFilter={handleFilterChange}
                  actionPanelSlot={
                    <ActionPanel
                      topAmount={topProfile ? topProfile.amount : topAmount}
                      minAmountToBeatTop={minAmountToBeatTop}
                      initialAmount={initialClaimAmount}
                      profiles={profiles}
                      onStartPayment={handleStartPayment}
                      isLoading={isCreatingOrder}
                      errorMessage={orderError}
                    />
                  }
                />

                <ActivityFeed activities={activities} />

                <HowItWorks />
              </>
            )}
          </>
        )}
      </main>

      <Footer
        onNavigate={navigate}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Payment / Verification Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderData={orderData}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Challenge Modal */}
      <NominationModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        targetRank={challengeTargetRank}
        minAmountToBeatTop={minAmountToBeatTop}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* Report Modal */}
      {reportingTargetId && (
        <ReportModal
          isOpen={!!reportingTargetId}
          onClose={() => setReportingTargetId(null)}
          targetId={reportingTargetId}
          targetType="profile"
          onReportSubmitted={() => {
            loadLeaderboard(currentPeriod);
          }}
        />
      )}

      {/* Admin Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onRefreshLeaderboard={() => loadLeaderboard(currentPeriod)}
      />

      {/* Real-time Live Stats Modal */}
      <LiveStatsModal
        isOpen={isLiveStatsOpen}
        onClose={() => setIsLiveStatsOpen(false)}
        stats={liveStats}
        onRefresh={loadLiveStats}
      />
    </div>
  );
}

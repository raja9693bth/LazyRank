import React, { useState, useEffect } from 'react';
import { UserProfile, ActivityEvent, RankPeriod, LeaderboardResponse, LiveStats } from './types.ts';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { QuickClaimBar } from './components/QuickClaimBar.tsx';
import { StatsRibbon } from './components/StatsRibbon.tsx';
import { MiniRanking } from './components/MiniRanking.tsx';
import { CheckoutDrawer } from './components/CheckoutDrawer.tsx';
import { ActionPanel } from './components/ActionPanel.tsx';
import { Leaderboard } from './components/Leaderboard.tsx';
import { ActivityFeed } from './components/ActivityFeed.tsx';
import { HowItWorks } from './components/HowItWorks.tsx';
import { GlobalActivityHeatmap } from './components/GlobalActivityHeatmap.tsx';
import { LazyDilemmaWidget } from './components/LazyDilemmaWidget.tsx';
import { ResultView } from './components/ResultView.tsx';
import { MobileBottomNav, MobileNavSection } from './components/MobileBottomNav.tsx';
import { NominationModal } from './components/NominationModal.tsx';
import { PaymentModal } from './components/PaymentModal.tsx';
import { AboutModal, RulesModal, ReportModal, AdminModal, LiveStatsModal } from './components/InfoModals.tsx';
import { UserSettingsModal } from './components/UserSettingsModal.tsx';
import { Footer } from './components/Footer.tsx';
import { TermsPage } from './pages/TermsPage.tsx';
import { PrivacyPage } from './pages/PrivacyPage.tsx';
import { RefundPage } from './pages/RefundPage.tsx';
import { DeliveryPage } from './pages/DeliveryPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { RulesPage } from './pages/RulesPage.tsx';
import { updatePageSeo, updateProfileSeo } from './utils/seo.ts';
import { Swords } from 'lucide-react';

type PublicPaymentConfig = { enabled: boolean; taxReady: boolean; taxDisclosure: string };

type PendingCheckout = {
  ownerToken: string;
  orderAccessToken: string;
  idempotencyKey: string;
  createdAt: number;
};
const pendingCheckoutKey = 'lazy_checkout_pending_v1';
const orderCheckoutKey = (orderId: string): string => `lazy_checkout_${orderId}`;
function storePendingCheckout(record: PendingCheckout): void {
  sessionStorage.setItem(pendingCheckoutKey, JSON.stringify(record));
}
function storeOrderCheckout(orderId: string, record: PendingCheckout): void {
  sessionStorage.setItem(orderCheckoutKey(orderId), JSON.stringify(record));
}

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
  const [topAmount, setTopAmount] = useState<number>(0);
  const [minAmountToBeatTop, setMinAmountToBeatTop] = useState<number>(1);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const currentPeriod: RankPeriod = 'all';
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig>({
    enabled: false,
    taxReady: false,
    taxDisclosure: 'GST status being verified — checkout unavailable'
  });
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
  const [isJustClaimed, setIsJustClaimed] = useState(false);
  const [upgradingProfile, setUpgradingProfile] = useState<UserProfile | null>(null);
  const [globalActivityRefreshKey, setGlobalActivityRefreshKey] = useState<number>(0);
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string | null>(null);
  const [pendingOwnerToken, setPendingOwnerToken] = useState<string | null>(null);
  const [orderAccessToken, setOrderAccessToken] = useState<string | null>(null);

  // Currency Mode: INR (Authoritative minor unit calculation) vs USD (Illustrative display INR / 85)
  const [currencyMode, setCurrencyMode] = useState<'INR' | 'USD'>('INR');

  // Drawer & Quick Claim Prefill State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerPrefill, setDrawerPrefill] = useState<{ name: string; category?: string }>({
    name: '',
    category: undefined
  });

  // Global Claims Today counter
  const [claimsToday, setClaimsToday] = useState<number>(0);

  // Challenge Banner state
  const [incomingChallenge, setIncomingChallenge] = useState<{
    friendName: string;
    targetAmount?: number;
  } | null>(null);

  // Navigation & Modals
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [challengeTargetRank, setChallengeTargetRank] = useState<number | undefined>(undefined);
  const [nominationModalTab, setNominationModalTab] = useState<'challenge' | 'notify' | 'reason'>('challenge');
  const [nominationDefaultName, setNominationDefaultName] = useState<string>('');
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [reportingTargetId, setReportingTargetId] = useState<string | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/payment/config', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Configuration unavailable');
        return r.json();
      })
      .then((c: PublicPaymentConfig) => setPaymentConfig(c))
      .catch(() => { /* keep disabled defaults */ });
    return () => controller.abort();
  }, []);

  // Load Leaderboard from Server with full server-side pagination & filter support
  const loadLeaderboard = async (
    pageOffset = 0,
    pageSize = 20,
    filter = filterMode,
    isAppend = false
  ) => {
    if (!isAppend) setIsLoadingLeaderboard(true);
    try {
      const res = await fetch(
        `/api/leaderboard?period=${currentPeriod}&offset=${pageOffset}&limit=${pageSize}&filter=${filter}`
      );
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        if (isAppend) {
          setProfiles(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newProfiles = (data.profiles || []).filter(p => !existingIds.has(p.id));
            return [...prev, ...newProfiles];
          });
        } else {
          setProfiles(data.profiles || []);
          // Set dynamic minimum amount to beat #1
          if (data.topAmount !== undefined) {
            setTopAmount(data.topAmount);
            setMinAmountToBeatTop(data.topAmount + 1);
          }
        }
        setTotalCount(data.totalCount || 0);
        setHasMore(data.hasMore || false);
      }
    } catch {
      // Graceful error state
    } finally {
      setIsLoadingLeaderboard(false);
      setIsLoadingMore(false);
    }
  };

  const handleFilterChange = (newFilter: 'verified' | 'all') => {
    setFilterMode(newFilter);
    setCurrentPage(1);
    loadLeaderboard(0, 20, newFilter, false);
  };

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    loadLeaderboard((nextPage - 1) * 20, 20, filterMode, true);
  };

  // Load Permanent All-Time Top 3
  const loadAllTimeTop3 = async () => {
    try {
      const res = await fetch('/api/leaderboard?period=all&limit=3&filter=verified');
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        setAllTimeTop3(data.profiles || []);
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

  // Load Global Activity Claims
  const loadGlobalActivity = async () => {
    try {
      const res = await fetch('/api/activity/global');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.claimsToday === 'number') {
          setClaimsToday(data.claimsToday);
        }
      }
    } catch {}
  };

  // Load Live Real-time Stats
  const loadLiveStats = async () => {
    try {
      let sessionId = sessionStorage.getItem('lazy_session_id');
      if (!sessionId) {
        sessionId = 's_' + (typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : (Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9)));
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
    loadLeaderboard();
    loadAllTimeTop3();
    loadActivities();
    loadGlobalActivity();
    loadLiveStats();

    // Periodic live stats polling (every 25s)
    const statsInterval = setInterval(() => {
      loadLiveStats();
      loadGlobalActivity();
    }, 25000);

    // Track homepage view
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'homepageViews' })
    }).catch(() => {});

    // Check query params (?rank=id or ?challenge=name) and pathname (/profile/:id)
    const params = new URLSearchParams(window.location.search);
    let rankId = params.get('rank') || params.get('profile');
    if (!rankId && window.location.pathname.startsWith('/profile/')) {
      rankId = window.location.pathname.replace('/profile/', '').trim();
    }
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

    const returnOrderId = params.get('order_id');
    if (returnOrderId) {
      let cancelled = false;
      const pollReturnOrder = async () => {
        let recovered: PendingCheckout | null = null;
        try {
          recovered = JSON.parse(sessionStorage.getItem(orderCheckoutKey(returnOrderId)) || 'null') as PendingCheckout | null;
        } catch {}

        if (!recovered || !/^ord_[0-9a-f]{64}$/i.test(recovered.orderAccessToken)) {
          setOrderError('Cannot restore this checkout in this browser. Contact support with your order ID.');
          return;
        }

        setPendingOwnerToken(recovered.ownerToken);
        setOrderAccessToken(recovered.orderAccessToken);

        // Bounded polling for status
        const maxPollAttempts = 10;
        const pollInterval = 2000;
        for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
          if (cancelled) break;
          try {
            const statusRes = await fetch(`/api/payment/status/${returnOrderId}`, {
              headers: { 'x-order-access-token': recovered.orderAccessToken }
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.orderStatus === 'PAID') {
                const receiptRes = await fetch(`/api/payment/receipt/${returnOrderId}`, {
                  headers: { 'x-order-access-token': recovered.orderAccessToken }
                });
                if (receiptRes.ok) {
                  const receiptData = await receiptRes.json();
                  if (receiptData.profile) {
                    handlePaymentSuccess(receiptData.profile, undefined, recovered.ownerToken);
                    return;
                  }
                }
              } else if (['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(statusData.orderStatus)) {
                setOrderError(`Payment ${statusData.orderStatus.toLowerCase().replace('_', ' ')}. Please try again.`);
                return;
              }
            }
          } catch {}
          await new Promise(r => setTimeout(r, pollInterval));
        }
      };
      pollReturnOrder();
      return () => {
        cancelled = true;
      };
    }

    const challengeFriend = params.get('challenge');
    const challengeTarget = params.get('target');
    if (challengeFriend) {
      setIncomingChallenge({
        friendName: challengeFriend,
        targetAmount: challengeTarget ? parseInt(challengeTarget, 10) : undefined
      });
    }

    const onPopState = () => {
      const p = window.location.pathname.replace(/\/+$/, '') || '/';
      setCurrentPath(p);
      const urlParams = new URLSearchParams(window.location.search);
      const popRank = urlParams.get('rank') || urlParams.get('profile');
      if (popRank) {
        fetch(`/api/profile/${popRank}`)
          .then(res => res.json())
          .then(data => {
            if (data.profile) setSelectedProfile(data.profile);
          })
          .catch(() => {});
      } else {
        setSelectedProfile(null);
      }
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      clearInterval(statsInterval);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // Update Dynamic SEO Meta Tags on Page Changes
  useEffect(() => {
    if (selectedProfile) {
      updateProfileSeo(selectedProfile);
    } else {
      updatePageSeo(currentPath);
    }
  }, [selectedProfile, currentPath]);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setSelectedProfile(null);
    setIsJustClaimed(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Checkout Drawer with pre-filled parameters
  const handleOpenDrawerWithClaim = (amount?: number, name = '', category?: string) => {
    setInitialClaimAmount(amount ?? minAmountToBeatTop);
    setDrawerPrefill({ name, category });
    setIsDrawerOpen(true);
  };

  // Start Payment / Claim Order Creation
  const handleStartPayment = async (claimData: {
    name: string;
    amount: number;
    customerPhone: string;
    customerEmail?: string;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
    lazyReason?: string;
    profileId?: string;
    ownerToken?: string;
    consentAccepted: boolean;
    consentTimestamp: string;
    consentVersion: string;
  }) => {
    setIsCreatingOrder(true);
    setOrderError(null);

    const generatedOwnerToken =
      claimData.ownerToken ||
      (typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : 'tok_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

    const clientGeneratedOrderAccessToken =
      'ord_' +
      Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const targetProfileId = claimData.profileId || (upgradingProfile ? upgradingProfile.id : undefined);

    let activeIdempotencyKey = currentIdempotencyKey;
    if (!activeIdempotencyKey) {
      activeIdempotencyKey =
        'idemp_' +
        Date.now() +
        '_' +
        Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      setCurrentIdempotencyKey(activeIdempotencyKey);
    }

    const checkoutRecord: PendingCheckout = {
      ownerToken: generatedOwnerToken,
      orderAccessToken: clientGeneratedOrderAccessToken,
      idempotencyKey: activeIdempotencyKey,
      createdAt: Date.now()
    };
    storePendingCheckout(checkoutRecord);

    setPendingOwnerToken(generatedOwnerToken);
    setOrderAccessToken(clientGeneratedOrderAccessToken);

    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': activeIdempotencyKey,
          'x-order-access-token': clientGeneratedOrderAccessToken
        },
        body: JSON.stringify({
          amount: claimData.amount,
          customerName: claimData.name,
          customerPhone: claimData.customerPhone,
          customerEmail: claimData.customerEmail,
          instagram: claimData.instagram,
          linkedin: claimData.linkedin,
          website: claimData.website,
          reason: claimData.reason,
          lazyReason: claimData.lazyReason,
          profileId: targetProfileId,
          ownerToken: generatedOwnerToken,
          consentAccepted: claimData.consentAccepted,
          consentTimestamp: claimData.consentTimestamp,
          consentVersion: claimData.consentVersion
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 503) {
          // Close drawer before payment modal opens
          setIsDrawerOpen(false);
          setOrderData({
            orderId: 'preview-disabled-mode',
            orderAmount: claimData.amount,
            customerName: claimData.name,
            customerPhone: claimData.customerPhone,
            currency: 'INR',
            isTop: false,
            topAmount: 0,
            minAmountToBeatTop: 1,
            paymentMode: 'disabled',
            instagram: claimData.instagram,
            linkedin: claimData.linkedin,
            website: claimData.website,
            reason: claimData.reason,
            profileId: targetProfileId
          });
          setIsPaymentModalOpen(true);
          return;
        }
        throw new Error(data.error || 'Failed to initiate payment.');
      }

      if (data.orderId) {
        storeOrderCheckout(data.orderId, checkoutRecord);
      }

      // Close drawer before payment modal opens
      setIsDrawerOpen(false);
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
    setIsJustClaimed(true);
    setSelectedProfile(profile);
    setUpgradingProfile(null);

    const tokenToSave = ownerToken || pendingOwnerToken;
    if (tokenToSave && profile.id) {
      try {
        const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
        tokens[profile.id] = tokenToSave;
        localStorage.setItem('lazy_tokens', JSON.stringify(tokens));
      } catch {}
    }

    try {
      sessionStorage.removeItem(pendingCheckoutKey);
      if (orderData?.orderId) {
        sessionStorage.removeItem(orderCheckoutKey(orderData.orderId));
      }
    } catch {}

    setPendingOwnerToken(null);
    setOrderAccessToken(null);
    setCurrentIdempotencyKey(null);

    window.history.pushState({}, '', `/?rank=${profile.id}`);

    // Refresh leaderboard, all-time top 3 & activities to reflect new verified rank
    loadLeaderboard(0, 20, filterMode, false);
    loadAllTimeTop3();
    loadActivities();
    loadGlobalActivity();
    setGlobalActivityRefreshKey(k => k + 1);
  };

  // Upgrading existing rank (preserves profile ID and ownership credentials)
  const handleUpgradeRank = (profile: UserProfile) => {
    setUpgradingProfile(profile);
    setSelectedProfile(null);
    setInitialClaimAmount(minAmountToBeatTop);
    setDrawerPrefill({ name: profile.name, category: profile.lazyReason });
    setIsDrawerOpen(true);
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
    handleOpenDrawerWithClaim(amount);
  };

  const handleMobileNavSelect = (section: MobileNavSection) => {
    if (selectedProfile) {
      setSelectedProfile(null);
      setIsJustClaimed(false);
    }
    if (currentPath !== '/') {
      navigate('/');
    }

    if (section === 'claim') {
      setIsDrawerOpen(true);
      return;
    }

    setTimeout(() => {
      let targetId = 'leaderboard-section';
      if (section === 'activity') targetId = 'activity-section';

      const el = document.getElementById(targetId);
      if (el) {
        const headerOffset = 64;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 60);
  };

  const verifiedTop1 = profiles.find(p => p.rank === 1 && p.isVerified);
  const topProfile = verifiedTop1 || (topAmount > 0 ? { name: 'Current #1', amount: topAmount } : undefined);
  const verifiedProfilesCount = profiles.filter(p => p.isVerified).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf7f2] text-stone-900">
      {/* Header with Currency Switcher & Navigation */}
      <Header
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
        onOpenSettings={() => setIsUserSettingsOpen(true)}
        currencyMode={currencyMode}
        onToggleCurrency={() => setCurrencyMode(prev => (prev === 'INR' ? 'USD' : 'INR'))}
        onOpenClaim={() => handleOpenDrawerWithClaim()}
      />

      <main className="flex-1 w-full max-w-[1140px] mx-auto px-3 sm:px-6 lg:px-8 py-2 pb-20 sm:pb-8">
        {currentPath === '/terms' ? (
          <TermsPage onNavigate={navigate} />
        ) : currentPath === '/privacy' ? (
          <PrivacyPage onNavigate={navigate} />
        ) : currentPath === '/refund-cancellation' || currentPath === '/refund' ? (
          <RefundPage onNavigate={navigate} />
        ) : currentPath === '/delivery' ? (
          <DeliveryPage onNavigate={navigate} />
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
                isNewClaim={isJustClaimed}
                topProfile={topProfile}
                topAmount={topProfile ? topProfile.amount : topAmount}
                nextRankProfile={profiles.find(p => p.rank === selectedProfile.rank - 1)}
                minAmountToBeatTop={minAmountToBeatTop}
                onBackToLeaderboard={() => {
                  setSelectedProfile(null);
                  setIsJustClaimed(false);
                  navigate('/');
                }}
                onOpenChallenge={(targetRank, initialTab = 'challenge', defaultName) => {
                  setChallengeTargetRank(targetRank);
                  setNominationModalTab(initialTab);
                  setNominationDefaultName(defaultName || selectedProfile?.name || '');
                  setIsChallengeModalOpen(true);
                }}
                onUpgradeRank={handleUpgradeRank}
                onProfileUpdated={(updatedProfile) => {
                  setSelectedProfile(updatedProfile);
                  loadLeaderboard();
                }}
              />
            ) : (
              /* HOMEPAGE VIEW: Centered Showcase Layout */
              <>
                {/* 1. Light Hero with Accurate Price & Mascot */}
                <Hero
                  topAmount={topProfile ? topProfile.amount : topAmount}
                  topProfileName={topProfile?.name}
                  minAmountToBeatTop={minAmountToBeatTop}
                  onClaimAmount={handleHeroClaim}
                  onScrollToLeaderboard={() => {
                    const el = document.getElementById('leaderboard-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  currencyMode={currencyMode}
                />

                {/* 2. Accessible Quick Claim Bar */}
                <QuickClaimBar
                  onQuickClaim={({ name, category }) => {
                    handleOpenDrawerWithClaim(minAmountToBeatTop, name, category);
                  }}
                  isLoading={isCreatingOrder}
                />

                {/* 3. Honest Platform Statistics Ribbon */}
                <StatsRibbon
                  verifiedCount={verifiedProfilesCount || totalCount}
                  claimsToday={claimsToday}
                />

                {/* 4. Showcase Two-Column Grid: Leaderboard + Sidebar MiniRanking */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start my-4">
                  {/* Left (Main Content): Ranked Cards & Browse */}
                  <div className="lg:col-span-2">
                    <Leaderboard
                      profiles={profiles}
                      allTimeTop3={allTimeTop3}
                      onSelectProfile={(p) => {
                        setIsJustClaimed(false);
                        setSelectedProfile(p);
                        window.history.pushState({}, '', `/?rank=${p.id}`);
                      }}
                      onVoteProfile={handleVoteProfile}
                      onReportProfile={(id) => setReportingTargetId(id)}
                      onClaimSpecificRank={(target) => handleOpenDrawerWithClaim(target)}
                      isLoading={isLoadingLeaderboard}
                      totalCount={totalCount}
                      hasMore={hasMore}
                      onLoadMore={handleLoadMore}
                      isLoadingMore={isLoadingMore}
                      currentFilter={filterMode}
                      onSelectFilter={handleFilterChange}
                      currencyMode={currencyMode}
                    />
                  </div>

                  {/* Right (Sidebar): Top Spots MiniRanking */}
                  <div className="lg:col-span-1 space-y-4">
                    <MiniRanking
                      topProfiles={allTimeTop3.length > 0 ? allTimeTop3 : profiles.filter(p => p.isVerified)}
                      claimsToday={claimsToday}
                      onSelectProfile={(p) => {
                        setIsJustClaimed(false);
                        setSelectedProfile(p);
                        window.history.pushState({}, '', `/?rank=${p.id}`);
                      }}
                      currencyMode={currencyMode}
                    />

                    {/* Small Interactive Poll Widget: Weekly Lazy Dilemma */}
                    <LazyDilemmaWidget />
                  </div>
                </div>

                {/* 5. Global Activity Heatmap (Social Proof) */}
                <GlobalActivityHeatmap
                  refreshTrigger={globalActivityRefreshKey}
                  onClaimClick={() => handleOpenDrawerWithClaim(minAmountToBeatTop)}
                />

                {/* 6. Live Activity Feed */}
                <ActivityFeed
                  activities={activities}
                  onOpenChallenge={() => {
                    setChallengeTargetRank(undefined);
                    setNominationModalTab('challenge');
                    setNominationDefaultName('');
                    setIsChallengeModalOpen(true);
                  }}
                />

                {/* 7. Explanatory Overview */}
                <HowItWorks />
              </>
            )}
          </>
        )}
      </main>

      {/* Slide-over Accessible Checkout Drawer */}
      <CheckoutDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setUpgradingProfile(null);
        }}
        title={upgradingProfile ? `Upgrade Rank #${upgradingProfile.rank}` : "Claim Your Rank"}
      >
        <ActionPanel
          topAmount={topProfile ? topProfile.amount : topAmount}
          minAmountToBeatTop={minAmountToBeatTop}
          initialAmount={initialClaimAmount}
          initialName={drawerPrefill.name}
          initialCategory={drawerPrefill.category}
          profiles={profiles}
          upgradingProfile={upgradingProfile}
          onCancelUpgrade={() => {
            setUpgradingProfile(null);
            setIsDrawerOpen(false);
          }}
          onStartPayment={handleStartPayment}
          isLoading={isCreatingOrder}
          errorMessage={orderError}
          taxReady={paymentConfig.enabled && paymentConfig.taxReady}
          taxDisclosure={paymentConfig.taxDisclosure}
        />
      </CheckoutDrawer>

      <Footer
        onNavigate={navigate}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenSettings={() => setIsUserSettingsOpen(true)}
      />

      {/* Sticky Bottom Navigation for Mobile */}
      <MobileBottomNav onSelectSection={handleMobileNavSelect} />

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        currentProfile={selectedProfile || undefined}
        allProfiles={profiles}
        onProfileUpdated={(updatedProfile) => {
          if (selectedProfile && selectedProfile.id === updatedProfile.id) {
            setSelectedProfile(updatedProfile);
          }
          loadLeaderboard();
          loadAllTimeTop3();
          loadActivities();
          loadGlobalActivity();
        }}
        onNavigateToClaim={() => {
          setSelectedProfile(null);
          navigate('/');
          setIsDrawerOpen(true);
        }}
      />

      {/* Payment / Verification Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderData={orderData}
        onPaymentSuccess={handlePaymentSuccess}
        pendingOwnerToken={pendingOwnerToken}
        orderAccessToken={orderAccessToken}
      />

      {/* Challenge / Notify Me / Lazy Reason Modal */}
      <NominationModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        defaultTab={nominationModalTab}
        defaultNomineeName={nominationDefaultName}
        targetRank={challengeTargetRank}
        profiles={profiles}
        onNominationSuccess={() => {
          loadLeaderboard();
        }}
        onOpenClaim={(targetAmount) => handleOpenDrawerWithClaim(targetAmount)}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onOpenRules={() => {
          setIsAboutOpen(false);
          setIsRulesOpen(true);
        }}
      />

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportingTargetId}
        onClose={() => setReportingTargetId(null)}
        targetId={reportingTargetId || ''}
      />

      {/* Operator Admin Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onDataChanged={() => {
          loadLeaderboard();
          loadAllTimeTop3();
          loadActivities();
          loadGlobalActivity();
        }}
      />

      {/* Live Stats Modal */}
      <LiveStatsModal
        isOpen={isLiveStatsOpen}
        onClose={() => setIsLiveStatsOpen(false)}
        stats={liveStats}
      />
    </div>
  );
}

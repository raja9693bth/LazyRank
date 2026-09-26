import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ActivityEvent, RankPeriod, LeaderboardResponse, LiveStats } from './types.ts';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { QuickClaimBar } from './components/QuickClaimBar.tsx';
import { StatsRibbon } from './components/StatsRibbon.tsx';
import { MiniRanking } from './components/MiniRanking.tsx';
import { CheckoutDrawer } from './components/CheckoutDrawer.tsx';
import { ActionPanel } from './components/ActionPanel.tsx';
import { Leaderboard } from './components/Leaderboard.tsx';
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
import {
  submitClaimPayment,
  pollRedirectOrderStatus,
  saveOwnerToken,
  clearCheckoutRecords
} from './utils/checkoutContract.ts';

type PublicPaymentConfig = { enabled: boolean; taxReady: boolean; taxDisclosure: string };


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
  const [_activities, setActivities] = useState<ActivityEvent[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<RankPeriod>('all');
  const [allTimeTopProfile, setAllTimeTopProfile] = useState<UserProfile | null>(null);
  const leaderboardAbortControllerRef = useRef<AbortController | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig>({
    enabled: false,
    taxReady: false,
    taxDisclosure: 'GST status being verified — checkout unavailable'
  });
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [isLiveStatsOpen, setIsLiveStatsOpen] = useState(false);

  // Pagination & Filtering State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [verifiedTotalCount, setVerifiedTotalCount] = useState<number | null>(null);
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

  // Global Claims Today counter (null = unavailable/loading, number = genuine count)
  const [claimsToday, setClaimsToday] = useState<number | null>(null);

  // Retry tracking for idempotency
  const lastAttemptRef = useRef<{
    name: string;
    amount: number;
    phone: string;
    profileId?: string;
  } | null>(null);

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
  const [leaderboardError, setLeaderboardError] = useState(false);

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
    isAppend = false,
    targetPeriod: RankPeriod = currentPeriod
  ) => {
    if (!isAppend) {
      setIsLoadingLeaderboard(true);
      setLeaderboardError(false);
      if (leaderboardAbortControllerRef.current) {
        leaderboardAbortControllerRef.current.abort();
      }
    }
    const controller = new AbortController();
    leaderboardAbortControllerRef.current = controller;

    try {
      const filterParam = targetPeriod === 'today' ? 'verified' : filter;
      const res = await fetch(
        `/api/leaderboard?period=${targetPeriod}&offset=${pageOffset}&limit=${pageSize}&filter=${filterParam}`,
        { signal: controller.signal }
      );
      if (res.ok) {
        if (controller.signal.aborted) return;
        const data: LeaderboardResponse = await res.json();
        if (controller.signal.aborted) return;
        if (isAppend) {
          setProfiles(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newProfiles = (data.profiles || []).filter(p => !existingIds.has(p.id));
            return [...prev, ...newProfiles];
          });
        } else {
          setProfiles(data.profiles || []);
          if (data.topAmount !== undefined) {
            setTopAmount(data.topAmount);
            setMinAmountToBeatTop(data.topAmount + 1);
          }
          if (targetPeriod === 'all' && data.profiles && data.profiles.length > 0 && filterParam === 'verified') {
            setAllTimeTopProfile(data.profiles[0]);
          }
        }
        setTotalCount(data.totalCount || 0);
        if (targetPeriod === 'all' && filterParam === 'verified') {
          setVerifiedTotalCount(data.totalCount || 0);
        }
        setHasMore(data.hasMore || false);
      } else {
        if (!controller.signal.aborted && !isAppend) setLeaderboardError(true);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return;
      if (!isAppend) setLeaderboardError(true);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingLeaderboard(false);
        setIsLoadingMore(false);
      }
    }
  };

  const handlePeriodChange = (newPeriod: RankPeriod) => {
    if (newPeriod === currentPeriod) return;
    setCurrentPeriod(newPeriod);
    setCurrentPage(1);
    setProfiles([]);
    const effectiveFilter = newPeriod === 'today' ? 'verified' : filterMode;
    loadLeaderboard(0, 20, effectiveFilter, false, newPeriod);
  };

  const handleFilterChange = (newFilter: 'verified' | 'all') => {
    if (currentPeriod === 'today') return;
    setFilterMode(newFilter);
    setCurrentPage(1);
    loadLeaderboard(0, 20, newFilter, false, currentPeriod);
  };

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    loadLeaderboard((nextPage - 1) * 20, 20, currentPeriod === 'today' ? 'verified' : filterMode, true, currentPeriod);
  };

  // Load Permanent All-Time Top 3 & Top Profile
  const loadAllTimeTop3 = async () => {
    try {
      const res = await fetch('/api/leaderboard?period=all&limit=3&filter=verified');
      if (res.ok) {
        const data: LeaderboardResponse = await res.json();
        const topList = data.profiles || [];
        setAllTimeTop3(topList);
        if (topList.length > 0) {
          setAllTimeTopProfile(topList[0]);
        }
        if (data.totalCount !== undefined) {
          setVerifiedTotalCount(data.totalCount);
        }
        if (data.topAmount !== undefined) {
          setTopAmount(data.topAmount);
          setMinAmountToBeatTop(data.topAmount + 1);
        }
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
    } catch {}
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
        sessionId =
          's_' +
          (typeof window !== 'undefined' && window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : Date.now().toString(36) + '_' + Date.now().toString(16));
        sessionStorage.setItem('lazy_session_id', sessionId);
      }
      const res = await fetch('/api/stats/live', {
        headers: { 'x-session-id': sessionId }
      });
      if (res.ok) {
        const data: LiveStats = await res.json();
        setLiveStats(data);
      }
    } catch {}
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

    // Redirect restoration from Cashfree return URL: ?order_id=...
    const returnOrderId = params.get('order_id');
    if (returnOrderId) {
      let cancelled = false;
      const pollReturnOrder = async () => {
        // Enforce encoded URI and delegate to tested checkout contract
        const encodedId = encodeURIComponent(returnOrderId);
        const result = await pollRedirectOrderStatus({ orderId: returnOrderId });
        if (cancelled) return;
        if (result.status === 'PAID') {
          handlePaymentSuccess(result.profile, undefined, result.ownerToken, returnOrderId);
        } else {
          setOrderError(result.error);
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

  // Recurring Midnight IST Refresh Timer & Visibility Resumption
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let lastRefreshedIstDate = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCDate();

    const doRefresh = () => {
      lastRefreshedIstDate = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCDate();
      loadGlobalActivity();
      loadAllTimeTop3();
      loadLeaderboard(0, 20, currentPeriod === 'today' ? 'verified' : filterMode, false, currentPeriod);
      scheduleNext();
    };

    const scheduleNext = () => {
      if (timer) clearTimeout(timer);
      const nowMs = Date.now();
      const istOffsetMs = 5.5 * 3600 * 1000;
      const nowIst = new Date(nowMs + istOffsetMs);
      const nextMidnightIstUtc = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() + 1, 0, 0, 0));
      const nextMidnightUtcMs = nextMidnightIstUtc.getTime() - istOffsetMs;
      const delayMs = Math.max(1000, nextMidnightUtcMs - nowMs + 1000);
      timer = setTimeout(doRefresh, delayMs);
    };

    scheduleNext();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentIstDate = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCDate();
        if (currentIstDate !== lastRefreshedIstDate) {
          doRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentPeriod, filterMode]);

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

  // Start Payment / Claim Order Creation (Consolidated via checkoutContract)
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

    // Dynamic Consent Enforcement: reject immediately if unchecked
    if (!claimData.consentAccepted) {
      setOrderError('Please read and agree to the Terms & Conditions and Privacy Policy, and acknowledge the Refund Policy.');
      setIsCreatingOrder(false);
      return;
    }

    const targetProfileId = claimData.profileId || upgradingProfile?.id;

    const result = await submitClaimPayment({
      input: {
        name: claimData.name,
        amount: claimData.amount,
        customerPhone: claimData.customerPhone,
        customerEmail: claimData.customerEmail,
        instagram: claimData.instagram,
        linkedin: claimData.linkedin,
        website: claimData.website,
        reason: claimData.reason,
        lazyReason: claimData.lazyReason,
        profileId: targetProfileId,
        consentAccepted: claimData.consentAccepted,
        consentTimestamp: claimData.consentTimestamp,
        consentVersion: claimData.consentVersion
      },
      lastAttempt: lastAttemptRef.current,
      currentIdempotencyKey,
      currentOrderAccessToken: orderAccessToken,
      currentPendingOwnerToken: pendingOwnerToken,
      topAmount,
      minAmountToBeatTop
    });

    if (result.status === 'ERROR') {
      setOrderError(result.error);
      setIsCreatingOrder(false);
      return;
    }

    // Preserve tokens for identical retry
    setCurrentIdempotencyKey(result.tokens.idempotencyKey);
    setOrderAccessToken(result.tokens.orderAccessToken);
    if (!result.tokens.isUpgrade) {
      setPendingOwnerToken(result.tokens.ownerToken);
    }

    lastAttemptRef.current = {
      name: claimData.name.trim(),
      amount: Math.round(claimData.amount),
      phone: claimData.customerPhone,
      profileId: targetProfileId
    };

    if (result.status === 'UNAVAILABLE_503') {
      setIsDrawerOpen(false);
      setOrderData(result.orderData);
      setIsPaymentModalOpen(true);
      setIsCreatingOrder(false);
      return;
    }

    setIsDrawerOpen(false);
    setOrderData(result.data);
    setIsPaymentModalOpen(true);
    setIsCreatingOrder(false);
  };

  // Successful Payment -> Show Result Card & Store Token
  const handlePaymentSuccess = (
    profile: UserProfile,
    _previousTop?: UserProfile,
    ownerToken?: string,
    confirmedOrderId?: string
  ) => {
    setIsPaymentModalOpen(false);
    setOrderData(null);
    setIsJustClaimed(true);
    setSelectedProfile(profile);
    setUpgradingProfile(null);

    const tokenToSave = ownerToken || pendingOwnerToken;
    if (tokenToSave && profile.id) {
      saveOwnerToken(profile.id, tokenToSave);
    }

    clearCheckoutRecords(confirmedOrderId || orderData?.orderId);

    setPendingOwnerToken(null);
    setOrderAccessToken(null);
    setCurrentIdempotencyKey(null);
    lastAttemptRef.current = null;

    window.history.pushState({}, '', `/?rank=${profile.id}`);

    loadLeaderboard(0, 20, filterMode, false);
    loadAllTimeTop3();
    loadActivities();
    loadGlobalActivity();
  };

  // Upgrading existing rank
  const handleUpgradeRank = (profile: UserProfile) => {
    setUpgradingProfile(profile);
    setSelectedProfile(null);
    setInitialClaimAmount(minAmountToBeatTop);
    setDrawerPrefill({ name: profile.name, category: profile.lazyReason });
    setIsDrawerOpen(true);
  };

  const handleVoteProfile = async (profileId: string) => {
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.warn('Vote failed:', errorData.error || res.statusText);
        return;
      }
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
    } catch (err) {
      console.warn('Network error voting for profile:', err);
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
      const el = document.getElementById('leaderboard-section');
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

  const topProfile = allTimeTopProfile || (topAmount > 0 ? { name: 'Current #1', amount: topAmount } : undefined);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf7f2] text-stone-900">
      {/* Header with Currency Switcher & Compact Navigation */}
      <Header
        onOpenAbout={() => navigate('/about')}
        onOpenRules={() => navigate('/rules')}
        onOpenChallenge={() => {
          setChallengeTargetRank(undefined);
          setNominationModalTab('challenge');
          setNominationDefaultName('');
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
              /* HOMEPAGE VIEW: IMAGE 32 LAYOUT */
              <>
                {/* 1. Hero: Two-column Desktop, Contained Mascot, Responsive Minimum Price */}
                <Hero
                  topAmount={topProfile ? topProfile.amount : topAmount}
                  topProfileName={topProfile?.name}
                  minAmountToBeatTop={minAmountToBeatTop}
                  isLoadingMinAmount={isLoadingLeaderboard && profiles.length === 0}
                  hasLeaderboardError={leaderboardError}
                  onRetryLeaderboard={() => loadLeaderboard(0, 20, currentPeriod === 'today' ? 'verified' : filterMode, false, currentPeriod)}
                  onClaimAmount={handleHeroClaim}
                  currencyMode={currencyMode}
                  canClaim={paymentConfig.enabled && paymentConfig.taxReady}
                  period={currentPeriod}
                />

                {/* 2. One QuickClaimBar directly underneath */}
                <QuickClaimBar
                  onQuickClaim={({ name, category }) => {
                    handleOpenDrawerWithClaim(minAmountToBeatTop, name, category);
                  }}
                  isLoading={isCreatingOrder}
                />

                {/* 3. Main Two-Column Area: Leaderboard on Left, MiniRanking on Right */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start my-6">
                  {/* Left Column: Authoritative Leaderboard Showcase */}
                  <div className="lg:col-span-2">
                    <Leaderboard
                      profiles={profiles}
                      onSelectProfile={(p) => {
                        setIsJustClaimed(false);
                        setSelectedProfile(p);
                        window.history.pushState({}, '', `/?rank=${p.id}`);
                      }}
                      onVoteProfile={handleVoteProfile}
                      onReportProfile={(id) => setReportingTargetId(id)}
                      onClaimSpecificRank={(target) => handleOpenDrawerWithClaim(target)}
                      isLoading={isLoadingLeaderboard}
                      hasError={leaderboardError}
                      onRetry={() => loadLeaderboard(0, 20, currentPeriod === 'today' ? 'verified' : filterMode, false, currentPeriod)}
                      totalCount={totalCount}
                      hasMore={hasMore}
                      onLoadMore={handleLoadMore}
                      isLoadingMore={isLoadingMore}
                      currentFilter={filterMode}
                      onSelectFilter={handleFilterChange}
                      currencyMode={currencyMode}
                      minAmountToBeatTop={minAmountToBeatTop}
                      period={currentPeriod}
                      onPeriodChange={handlePeriodChange}
                      canClaim={paymentConfig.enabled && paymentConfig.taxReady}
                    />
                  </div>

                  {/* Right Column: Top Spots Sidebar (Matches selected period) */}
                  <div className="lg:col-span-1">
                    <MiniRanking
                      topProfiles={currentPeriod === 'today' ? profiles : (allTimeTop3.length > 0 ? allTimeTop3 : profiles.filter(p => p.isVerified))}
                      claimsToday={claimsToday}
                      onSelectProfile={(p) => {
                        setIsJustClaimed(false);
                        setSelectedProfile(p);
                        window.history.pushState({}, '', `/?rank=${p.id}`);
                      }}
                      currencyMode={currencyMode}
                      period={currentPeriod}
                    />
                  </div>
                </div>

                {/* 4. Honest Platform Statistics Ribbon (Below the Main Grid) */}
                <StatsRibbon
                  verifiedCount={verifiedTotalCount}
                  claimsToday={claimsToday}
                />
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

      {/* Challenge / Nomination Modal */}
      <NominationModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        initialTab={nominationModalTab}
        defaultName={nominationDefaultName}
        targetRank={challengeTargetRank}
        minAmountToBeatTop={minAmountToBeatTop}
        currentProfile={selectedProfile || undefined}
        onProfileUpdated={(updatedProfile) => {
          if (selectedProfile && selectedProfile.id === updatedProfile.id) {
            setSelectedProfile(updatedProfile);
          }
          loadLeaderboard();
          loadAllTimeTop3();
        }}
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
        targetType="profile"
        onReportSubmitted={() => {
          setReportingTargetId(null);
          loadLeaderboard();
        }}
      />

      {/* Operator Admin Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onRefreshLeaderboard={() => {
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

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserProfile, Nomination, ActivityEvent, PurchaseRecord, ReportRecord, AnalyticsSummary, LiveStats, ContactMessage, NotificationSubscription, ClaimHistoryRecord, GlobalActivityData, HourlyActivityBucket, DayActivityBucket, LazyDilemma } from '../src/types.ts';
import { PostgresDatabase, hashToken, verifyOwnerToken, getIstTodayWindow } from './db/postgres.ts';

const DATA_FILE = path.join(process.cwd(), 'server-data.json');

export function constantTimeMatch(a?: string, b?: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const trimmedA = a.trim();
  const trimmedB = b.trim();
  if (trimmedA.length === 0 || trimmedB.length === 0) return false;
  const bufA = Buffer.from(trimmedA);
  const bufB = Buffer.from(trimmedB);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

// Initial seed profiles with verified paid amounts and social/website links (Loaded ONLY when DEMO_MODE=true)
const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'p-aarav-1',
    userId: 'u-aarav',
    name: 'Aarav',
    amount: 5001,
    rank: 1,
    instagram: 'aarav_sh',
    linkedin: 'https://linkedin.com/in/aarav-sh',
    website: 'https://aarav.me',
    reason: 'Paid ₹5,001 so nobody expects anything from me this quarter.',
    title: 'Supreme Overlord of Inaction',
    badge: '👑 Current #1',
    lazyReason: 'Procrastination Master',
    lazyStreakDays: 9,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    rankExpiresAt: new Date(Date.now() + 1000 * 60 * (14 * 60 + 35)).toISOString(),
    votesCount: 54,
    claimHistory: [
      {
        id: 'ch-aarav-1',
        amount: 1000,
        totalAmount: 1000,
        rank: 8,
        timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
        note: 'Initial Claim'
      },
      {
        id: 'ch-aarav-2',
        amount: 2000,
        totalAmount: 3000,
        rank: 3,
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        note: 'Rank Boost'
      },
      {
        id: 'ch-aarav-3',
        amount: 2001,
        totalAmount: 5001,
        rank: 1,
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        note: 'Crown Claim (#1)'
      }
    ]
  },
  {
    id: 'p-rahul-2',
    userId: 'u-rahul',
    name: 'Rahul',
    amount: 2500,
    rank: 2,
    instagram: 'rahul_codes',
    reason: 'Sets 4 alarms, ignores them all, pays to make it official.',
    title: 'Executive Director of Lethargy',
    badge: '🥈 Rank #2',
    lazyReason: 'Bed Connoisseur',
    lazyStreakDays: 7,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    rankExpiresAt: new Date(Date.now() + 1000 * 60 * (8 * 60 + 15)).toISOString(),
    votesCount: 38,
    claimHistory: [
      {
        id: 'ch-rahul-1',
        amount: 1500,
        totalAmount: 1500,
        rank: 4,
        timestamp: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
        note: 'Initial Claim'
      },
      {
        id: 'ch-rahul-2',
        amount: 1000,
        totalAmount: 2500,
        rank: 2,
        timestamp: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
        note: 'Rank Boost'
      }
    ]
  },
  {
    id: 'p-priya-3',
    userId: 'u-priya',
    name: 'Priya',
    amount: 1500,
    rank: 3,
    website: 'https://priyadesign.co',
    reason: 'Watched 6 hours of productivity reels from bed.',
    title: 'Master of Postponement',
    badge: '🥉 Rank #3',
    lazyReason: 'Nap Enthusiast',
    lazyStreakDays: 5,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    rankExpiresAt: new Date(Date.now() + 1000 * 60 * (3 * 60 + 45)).toISOString(),
    votesCount: 29,
    claimHistory: [
      {
        id: 'ch-priya-1',
        amount: 600,
        totalAmount: 600,
        rank: 6,
        timestamp: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
        note: 'Initial Claim'
      },
      {
        id: 'ch-priya-2',
        amount: 900,
        totalAmount: 1500,
        rank: 3,
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        note: 'Rank Boost'
      }
    ]
  },
  {
    id: 'p-sneha-4',
    userId: 'u-sneha',
    name: 'Sneha',
    amount: 800,
    rank: 4,
    instagram: 'sneha_creates',
    website: 'https://sneha.studio',
    reason: 'Moved mouse cursor once every 9 minutes on Slack.',
    title: 'Slack Wiggle Legend',
    lazyStreakDays: 4,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    rankExpiresAt: new Date(Date.now() + 1000 * 60 * (1 * 60 + 15)).toISOString(),
    votesCount: 22
  },
  {
    id: 'p-vikram-5',
    userId: 'u-vikram',
    name: 'Vikram',
    amount: 500,
    rank: 5,
    reason: 'Ordered food from a place 80 meters away.',
    title: 'Delivery Devotee',
    lazyStreakDays: 3,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    votesCount: 16
  },
  {
    id: 'p-rohan-6',
    userId: 'u-rohan',
    name: 'Rohan',
    amount: 250,
    rank: 6,
    instagram: 'rohan_wander',
    reason: 'Has been saying "I\'ll do it tomorrow" since 2022.',
    title: 'Tomorrow Architect',
    lazyStreakDays: 3,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    votesCount: 12
  },
  {
    id: 'p-ananya-7',
    userId: 'u-ananya',
    name: 'Ananya',
    amount: 100,
    rank: 7,
    website: 'https://ananyablog.xyz',
    reason: 'Keeps 312 browser tabs open as an emotional support system.',
    title: 'Tab Hoarder',
    lazyStreakDays: 2,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    votesCount: 9
  },
  {
    id: 'p-kabir-8',
    userId: 'u-kabir',
    name: 'Kabir',
    amount: 50,
    rank: 8,
    reason: 'Too lazy to write a reason.',
    title: 'Silent Operator',
    lazyStreakDays: 2,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    votesCount: 7
  },
  {
    id: 'p-meera-9',
    userId: 'u-meera',
    name: 'Meera',
    amount: 25,
    rank: 9,
    reason: 'Put phone on 1% battery rather than reach 2 feet for the plug.',
    title: 'Low Battery Survivor',
    lazyStreakDays: 1,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    votesCount: 5
  },
  {
    id: 'p-arjun-10',
    userId: 'u-arjun',
    name: 'Arjun',
    amount: 10,
    rank: 10,
    reason: 'Paid ₹10 so I could stay in bed another 10 minutes.',
    title: 'Bedrest Olympian',
    lazyStreakDays: 1,
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    votesCount: 4
  }
];

const INITIAL_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act-1',
    type: 'top1',
    text: 'Aarav paid ₹5,001 and claimed #1 on LAZY.',
    amount: 5001,
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString()
  },
  {
    id: 'act-2',
    type: 'displaced',
    text: 'Rahul was pushed to #2 after Aarav took the crown.',
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString()
  },
  {
    id: 'act-3',
    type: 'rank',
    text: 'Priya proved her laziness with ₹1,500 (Rank #3).',
    amount: 1500,
    timestamp: new Date(Date.now() - 1000 * 60 * 200).toISOString()
  },
  {
    id: 'act-4',
    type: 'rank',
    text: 'Sneha paid ₹800 to claim Rank #4.',
    amount: 800,
    timestamp: new Date(Date.now() - 1000 * 60 * 160).toISOString()
  },
  {
    id: 'act-5',
    type: 'challenge',
    text: 'Kunal challenged Arjun to beat ₹6,000 on LAZY.',
    amount: 6000,
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    id: 'act-6',
    type: 'challenge',
    text: 'Priya nominated Rahul: "Uses 3 alarms and ignores all of them."',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  },
  {
    id: 'act-7',
    type: 'top1',
    text: 'The Sloth King paid ₹6,001 and TOOK #1!',
    amount: 6001,
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  }
];

interface DatabaseState {
  profiles: UserProfile[];
  nominations: Nomination[];
  activities: ActivityEvent[];
  purchases: PurchaseRecord[];
  reports: ReportRecord[];
  votes: { [voteKey: string]: boolean };
  processedPaymentRefs: { [ref: string]: boolean }; // Idempotency guard
  orders?: {
    [orderId: string]: {
      orderId: string;
      name: string;
      amount: number;
      profileId?: string;
      ownerToken?: string;
      instagram?: string;
      linkedin?: string;
      website?: string;
      reason?: string;
      lazyReason?: string;
      paymentRef?: string;
      createdAt: string;
      status: string;
      idempotencyKey?: string;
      paymentSessionId?: string;
      providerOrderId?: string;
      checkoutUrl?: string;
      refundedAmount?: number;
      customerPhone?: string;
      customerEmail?: string;
      consentAccepted?: boolean;
    };
  };
  analytics: AnalyticsSummary;
  contactMessages?: ContactMessage[];
  notificationSubscriptions?: NotificationSubscription[];
  dilemma?: LazyDilemma;
  dilemmaVotes?: { [ipOrUser: string]: string }; // maps voter identifier to optionId
}

const SEED_PROFILE_IDS = new Set(INITIAL_PROFILES.map(p => p.id));
const SEED_ACTIVITY_IDS = new Set(INITIAL_ACTIVITIES.map(a => a.id));

export class LazyDatabase {
  private state: DatabaseState;
  private activeSessions: Map<string, number> = new Map();
  private dailyVisits: Map<string, Set<string>> = new Map();
  public pg = new PostgresDatabase();

  public isPostgresAuthoritative(): boolean {
    return this.pg.isAvailable() && (process.env.NODE_ENV === 'production' || process.env.USE_POSTGRES === 'true');
  }

  constructor() {
    this.state = this.loadData();
    this.recalculateRanks();
  }

  private loadData(): DatabaseState {
    const isProd = process.env.NODE_ENV === 'production';
    const isDemo = process.env.DEMO_MODE === 'true';

    // Section 8: Production with DEMO_MODE=true must fail fast with a fatal error
    if (isProd && isDemo) {
      throw new Error('FATAL CONFIGURATION ERROR: DEMO_MODE cannot be enabled in production environment.');
    }

    // Section 2A: DATABASE_URL must be mandatory when NODE_ENV=production
    if (isProd && (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim())) {
      throw new Error('FATAL CONFIGURATION ERROR: DATABASE_URL is mandatory in production environment. Silently falling back to local JSON is prohibited.');
    }

    const parseState = (raw: string): DatabaseState | null => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.profiles && Array.isArray(parsed.profiles)) {
          // In production or when DEMO_MODE is false, isolate and purge any demo seed profiles and activities
          if (!isDemo || isProd) {
            parsed.profiles = parsed.profiles.filter(
              (p: any) => !SEED_PROFILE_IDS.has(p.id) && !p.ownerToken?.startsWith('seed_')
            );
            if (Array.isArray(parsed.activities)) {
              parsed.activities = parsed.activities.filter(
                (a: any) => !SEED_ACTIVITY_IDS.has(a.id) && !a.id?.startsWith('act-')
              );
            }
          } else {
            // In demo development mode, ensure migration of any missing fields for v2.0 & v2.3
            const hasV2Amounts = parsed.profiles.some((p: any) => typeof p.amount === 'number' && p.amount > 0);
            if (!hasV2Amounts) {
              parsed.profiles = [...INITIAL_PROFILES];
              parsed.activities = [...INITIAL_ACTIVITIES];
            }
          }
          // Ensure every profile has ownerToken and verifiedAt set
          parsed.profiles.forEach((p: any) => {
            if (p.isVerified && !p.verifiedAt) {
              p.verifiedAt = p.createdAt || new Date().toISOString();
            }
            if (!p.ownerToken) {
              p.ownerToken = 'seed_' + p.id + '_' + crypto.randomBytes(12).toString('hex');
            }
            // Seed claimHistory from INITIAL_PROFILES if missing
            if (!p.claimHistory || p.claimHistory.length === 0) {
              const init = INITIAL_PROFILES.find(ip => ip.id === p.id);
              if (init && init.claimHistory) {
                p.claimHistory = [...init.claimHistory];
              }
            }
            // Seed rankExpiresAt from INITIAL_PROFILES or default 24h protection cycle
            if (!p.rankExpiresAt) {
              const init = INITIAL_PROFILES.find(ip => ip.id === p.id);
              if (init && init.rankExpiresAt) {
                p.rankExpiresAt = init.rankExpiresAt;
              } else {
                p.rankExpiresAt = new Date(Date.now() + 1000 * 60 * (12 * 60 + ((p.rank || 5) * 35))).toISOString();
              }
            }
            // Seed lazyReason if absent
            if (!p.lazyReason) {
              const init = INITIAL_PROFILES.find(ip => ip.id === p.id);
              if (init && init.lazyReason) {
                p.lazyReason = init.lazyReason;
              }
            }
            // Safely ignore obsolete Ghost Mode fields
            delete (p as any).isGhostMode;
            delete (p as any).is_ghost_mode;
            if (p.badge === '👻 Ghost Mode') {
              p.badge = undefined;
            }
          });
          parsed.processedPaymentRefs = parsed.processedPaymentRefs || {};
          parsed.orders = parsed.orders || {};
          parsed.notificationSubscriptions = parsed.notificationSubscriptions || [];
          parsed.analytics = parsed.analytics || {
            homepageViews: 0,
            claimStarts: 0,
            amountSelected: 0,
            checkoutStarts: 0,
            successfulPurchases: 0,
            totalRevenueINR: 0,
            shareClicks: 0,
            leaderboardClicks: 0,
            instagramClicks: 0,
            websiteClicks: 0,
            challengeClicks: 0
          };
          return parsed;
        }
      } catch {
        return null;
      }
      return null;
    };

    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const state = parseState(raw);
        if (state) return state;
      }
    } catch (primaryErr) {
      console.warn('Primary database file unreadable, checking backup file...', primaryErr);
    }

    // Try backup recovery if primary read or parse failed
    const BAK_FILE = `${DATA_FILE}.bak`;
    try {
      if (fs.existsSync(BAK_FILE)) {
        const rawBak = fs.readFileSync(BAK_FILE, 'utf-8');
        const bakState = parseState(rawBak);
        if (bakState) {
          console.info('Successfully recovered database state from backup file.');
          return bakState;
        }
      }
    } catch (bakErr) {
      console.error('Backup database file also unreadable.', bakErr);
    }

    const defaultProfiles = isDemo
      ? INITIAL_PROFILES.map(p => ({
          ...p,
          ownerToken: 'seed_' + p.id + '_' + crypto.randomBytes(24).toString('hex')
        }))
      : [];

    return {
      profiles: defaultProfiles,
      nominations: [],
      activities: isDemo ? [...INITIAL_ACTIVITIES] : [],
      purchases: [],
      reports: [],
      votes: {},
      processedPaymentRefs: {},
      orders: {},
      analytics: {
        homepageViews: 0,
        claimStarts: 0,
        amountSelected: 0,
        checkoutStarts: 0,
        successfulPurchases: 0,
        totalRevenueINR: 0,
        shareClicks: 0,
        leaderboardClicks: 0,
        instagramClicks: 0,
        websiteClicks: 0,
        challengeClicks: 0
      }
    };
  }

  public saveData() {
    if (process.env.NODE_ENV === 'production') {
      // Section 2C: In production, PostgreSQL is the exclusive single source of truth.
      // Do not write financial state to server-data.json.
      return;
    }
    try {
      const tempFile = `${DATA_FILE}.tmp.${Date.now()}.${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      const payload = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(tempFile, payload, 'utf-8');
      try {
        fs.renameSync(tempFile, DATA_FILE);
      } catch {
        // Windows atomic rename fallback if destination file is momentarily locked
        fs.copyFileSync(tempFile, DATA_FILE);
        try { fs.unlinkSync(tempFile); } catch {}
      }

      // Maintain synced backup file for point-in-time recovery
      try {
        fs.copyFileSync(DATA_FILE, `${DATA_FILE}.bak`);
      } catch {
        // Backup copy failure does not block primary state
      }
    } catch (err) {
      console.error('Database atomic write error:', err);
    }
  }

  /**
   * CANONICAL RANKING LOGIC (v2.0 / v2.1 Rule):
   * 1. Higher verified payment amount = Higher rank.
   * 2. Tie-breaker: earlier verification timestamp wins.
   * 3. Final deterministic tie-breaker: stable unique ID.
   * 4. Current #1 amount and minimum amount to beat #1 are derived dynamically.
   */
  public recalculateRanks(persist: boolean = true): { topAmount: number; minAmountToBeatTop: number } {
    // Calculate authoritative ranks for all verified active profiles (only admin 'removed' excludes)
    const allVerifiedProfiles = this.state.profiles.filter(
      p => p.isVerified && p.amount > 0 && p.moderationStatus !== 'removed' && p.reason !== '[Content Removed]'
    );

    allVerifiedProfiles.sort((a, b) => {
      // Primary: Verified Paid Amount (Higher is better)
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }
      // Tie-breaker: earlier verification timestamp wins
      const timeA = new Date(a.verifiedAt || a.createdAt).getTime();
      const timeB = new Date(b.verifiedAt || b.createdAt).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      // Final deterministic tie-breaker: unique ID
      return a.id.localeCompare(b.id);
    });

    // Assign ranks and dynamic badges based on position
    allVerifiedProfiles.forEach((profile, index) => {
      profile.rank = index + 1;

      if (profile.rank === 1) {
        profile.badge = '👑 Current #1';
        profile.title = 'Supreme Overlord of Inaction';
      } else if (profile.rank === 2) {
        profile.badge = '🥈 Rank #2';
        profile.title = 'Executive Director of Lethargy';
      } else if (profile.rank === 3) {
        profile.badge = '🥉 Rank #3';
        profile.title = 'Master of Postponement';
      } else if (profile.rank <= 10) {
        profile.badge = undefined;
        if (!profile.title || profile.title.includes('Supreme') || profile.title.includes('Executive')) {
          profile.title = 'Top 10 Sloth';
        }
      } else {
        profile.badge = undefined;
      }

      // Lazy Streak: track consecutive days maintained in Top 10 to encourage retention
      if (profile.rank <= 10) {
        profile.lazyStreakDays = Math.max(1, profile.lazyStreakDays || 1);
      } else {
        profile.lazyStreakDays = undefined;
      }
    });

    if (persist) {
      this.saveData();
    }

    const topAmount = allVerifiedProfiles.length > 0 ? allVerifiedProfiles[0].amount : 0;
    const minAmountToBeatTop = topAmount + 1;

    return { topAmount, minAmountToBeatTop };
  }

  public getTopAmount(): number {
    const verified = this.state.profiles.filter(
      p => p.isVerified && p.amount > 0 && !p.isReported
    );
    if (verified.length === 0) return 0;
    return Math.max(...verified.map(p => p.amount));
  }

  public getMinAmountToBeatTop(): number {
    return this.getTopAmount() + 1;
  }

  /**
   * Centralized period boundary calculation
   * Uses Indian Standard Time (IST, Asia/Kolkata, UTC+05:30) calendar boundaries
   * as authoritative for India-first payments and daily/weekly/monthly rankings.
   */
  public static getPeriodCutoff(period: 'today' | 'week' | 'month' | 'all'): number {
    if (period === 'all') return 0;
    
    // Indian Standard Time (IST) is UTC+05:30 (19,800,000 ms)
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowUtc = Date.now();
    const nowIst = new Date(nowUtc + IST_OFFSET_MS);

    if (period === 'today') {
      // 00:00:00.000 IST of the current day
      const istMidnightUtc = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate());
      return istMidnightUtc - IST_OFFSET_MS;
    }

    if (period === 'week') {
      // Monday 00:00:00.000 IST of current week
      const day = nowIst.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const diffToMonday = day === 0 ? 6 : day - 1;
      const istMidnightUtc = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate() - diffToMonday);
      return istMidnightUtc - IST_OFFSET_MS;
    }

    if (period === 'month') {
      // 1st day 00:00:00.000 IST of current month
      const istMonthStartUtc = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), 1);
      return istMonthStartUtc - IST_OFFSET_MS;
    }

    return 0;
  }

  /**
   * Scalable, paginated Leaderboard retrieval.
   * Preserves global rank indexing across all pages.
   * Supports offset/limit or page/pageSize. Default initial limit is 20 (Section 6).
   */
  public getLeaderboard(options?: {
    period?: 'today' | 'week' | 'month' | 'all';
    page?: number;
    pageSize?: number;
    offset?: number;
    limit?: number;
    filter?: 'verified' | 'all';
  }): {
    profiles: UserProfile[];
    totalCount: number;
    page: number;
    pageSize: number;
    offset: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
    period: 'today' | 'week' | 'month' | 'all';
    topAmount: number;
    minAmountToBeatTop: number;
    filter: 'verified' | 'all';
    periodStartUtc?: string;
    periodEndUtc?: string;
    rankingBasis?: string;
  } {
    const period = options?.period || 'all';
    const filter = options?.filter || 'verified';

    // Flexible offset & limit or page & pageSize (default initial batch = 20)
    let offset = 0;
    let limit = 20;
    let page = 1;

    if (options?.offset !== undefined || options?.limit !== undefined) {
      offset = Math.max(0, options?.offset || 0);
      limit = Math.max(1, Math.min(100, options?.limit !== undefined ? options.limit : 20));
      page = Math.floor(offset / limit) + 1;
    } else {
      page = Math.max(1, options?.page || 1);
      const pageSize = Math.max(1, Math.min(100, options?.pageSize || 20));
      offset = (page - 1) * pageSize;
      limit = pageSize;
    }

    // All-time top amount and minimum to beat top are ALWAYS all-time verified figures
    const allTimeVerified = this.state.profiles.filter(p => p.isVerified && p.amount > 0 && p.moderationStatus !== 'removed');
    allTimeVerified.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      const timeA = new Date(a.firstVerifiedAt || a.verifiedAt || a.createdAt).getTime();
      const timeB = new Date(b.firstVerifiedAt || b.verifiedAt || b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });
    const allTimeTopAmount = allTimeVerified.length > 0 ? allTimeVerified[0].amount : 0;
    const minAmountToBeatTop = allTimeTopAmount + 1;

    if (period === 'today') {
      const { startTodayMs, endTodayMs, startTodayUtc, endTodayUtc } = getIstTodayWindow();
      const qualifying: (UserProfile & { periodAmountINR: number; earliestCreditMs: number })[] = [];

      for (const p of this.state.profiles) {
        if (!p.isVerified || p.amount <= 0 || p.moderationStatus === 'removed' || p.reason === '[Content Removed]') {
          continue;
        }
        let todayAmount = 0;
        let earliestCreditMs = Infinity;

        if (p.claimHistory && p.claimHistory.length > 0) {
          for (const ch of p.claimHistory) {
            const t = new Date(ch.timestamp).getTime();
            if (t >= startTodayMs && t < endTodayMs) {
              todayAmount += ch.amount;
              if (t < earliestCreditMs) earliestCreditMs = t;
            }
          }
        } else if (p.verifiedAt) {
          const t = new Date(p.verifiedAt).getTime();
          if (t >= startTodayMs && t < endTodayMs) {
            todayAmount = p.amount;
            earliestCreditMs = t;
          }
        }

        if (todayAmount > 0) {
          qualifying.push({
            ...p,
            periodAmountINR: todayAmount,
            earliestCreditMs: earliestCreditMs === Infinity ? startTodayMs : earliestCreditMs
          });
        }
      }

      // Sort by todayAmount DESC, earliestCreditMs ASC, id ASC
      qualifying.sort((a, b) => {
        if (b.periodAmountINR !== a.periodAmountINR) return b.periodAmountINR - a.periodAmountINR;
        if (a.earliestCreditMs !== b.earliestCreditMs) return a.earliestCreditMs - b.earliestCreditMs;
        return a.id.localeCompare(b.id);
      });

      const totalCount = qualifying.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const paginated = qualifying.slice(offset, offset + limit).map((p, idx) => ({
        ...this.sanitizeProfile(p),
        // rank and amount retain ALL-TIME values
        periodRank: offset + idx + 1,
        periodAmountINR: p.periodAmountINR,
        periodCreditSettledAt: new Date(p.earliestCreditMs).toISOString()
      }));
      const hasMore = offset + paginated.length < totalCount;

      return {
        profiles: paginated,
        totalCount,
        page,
        pageSize: limit,
        offset,
        limit,
        totalPages,
        hasMore,
        period: 'today',
        topAmount: allTimeTopAmount,
        minAmountToBeatTop,
        filter: 'verified',
        periodStartUtc: startTodayUtc,
        periodEndUtc: endTodayUtc,
        rankingBasis: 'net_settled_credits_today_ist'
      };
    }

    const cutoff = LazyDatabase.getPeriodCutoff(period);

    // Filter verified profiles for the selected period
    const verifiedFiltered = this.state.profiles.filter(p => {
      if (!p.isVerified || p.amount <= 0) return false;
      if (p.moderationStatus === 'removed' || p.reason === '[Content Removed]') return false;
      if (cutoff === 0) return true;
      const t = new Date(p.verifiedAt || p.createdAt).getTime();
      return t >= cutoff;
    });

    // Authoritative sort:
    // 1. amount DESC
    // 2. verifiedAt || createdAt ASC (earlier verification timestamp wins)
    // 3. ID ASC (deterministic tie-breaker)
    verifiedFiltered.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      const timeA = new Date(a.verifiedAt || a.createdAt).getTime();
      const timeB = new Date(b.verifiedAt || b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

    // Assign globally correct ranks for this period
    const mappedVerified: UserProfile[] = verifiedFiltered.map((p, idx) => ({
      ...p,
      rank: idx + 1
    }));

    let allEntries: UserProfile[] = mappedVerified;

    if (filter === 'all') {
      // Include unverified / ₹0 participants (Section 5)
      const unverified = this.state.profiles.filter(p => {
        if (p.isVerified && p.amount > 0) return false;
        if (p.moderationStatus === 'removed' || p.reason === '[Content Removed]') return false;
        if (cutoff === 0) return true;
        const t = new Date(p.createdAt).getTime();
        return t >= cutoff;
      });

      unverified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const mappedUnverified: UserProfile[] = unverified.map(p => ({
        ...p,
        rank: 0, // No paid rank assigned to unpaid participants
        badge: 'Not Yet Proven',
        title: 'Unverified Participant'
      }));

      // Verified always rank above unverified
      allEntries = [...mappedVerified, ...mappedUnverified];
    }

    const totalCount = allEntries.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const paginated = allEntries.slice(offset, offset + limit);
    const hasMore = offset + paginated.length < totalCount;

    return {
      profiles: paginated.map(p => this.sanitizeProfile(p)),
      totalCount,
      page,
      pageSize: limit,
      offset,
      limit,
      totalPages,
      hasMore,
      period,
      topAmount: allTimeTopAmount,
      minAmountToBeatTop,
      filter
    };
  }

  /**
   * Sanitizes profile to strip private server-only tokens and internal fields before sending to public clients
   */
  public sanitizeProfile(profile: UserProfile): UserProfile {
    const { ownerToken, ownerTokenHash, owner_token_hash, ...safe } = profile as any;
    delete safe.isGhostMode;
    delete safe.is_ghost_mode;
    delete safe.adminNotes;
    return safe as UserProfile;
  }

  public async getOrderByIdempotencyKey(idempotencyKey: string): Promise<any | null> {
    if (!idempotencyKey) return null;
    if (this.isPostgresAuthoritative()) {
      return await this.pg.getOrderByIdempotencyKey(idempotencyKey);
    }
    if (!this.state.orders) return null;
    for (const key of Object.keys(this.state.orders)) {
      const ord = this.state.orders[key];
      if (ord.idempotencyKey === idempotencyKey) {
        return ord;
      }
    }
    return null;
  }

  public async updateOrderProviderSession(orderId: string, paymentSessionId?: string, providerOrderId?: string, checkoutUrl?: string): Promise<void> {
    if (this.isPostgresAuthoritative()) {
      await this.pg.updateOrderProviderSession(orderId, paymentSessionId, providerOrderId, checkoutUrl);
      return;
    }
    if (this.state.orders && this.state.orders[orderId]) {
      this.state.orders[orderId].paymentSessionId = paymentSessionId;
      this.state.orders[orderId].providerOrderId = providerOrderId;
      this.state.orders[orderId].checkoutUrl = checkoutUrl;
      this.saveData();
    }
  }

  public async createOrder(order: {
    orderId: string;
    name: string;
    amount: number;
    currency?: string;
    profileId?: string;
    ownerToken?: string;
    orderAccessToken?: string;
    quoteSnapshot?: any;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
    lazyReason?: string;
    idempotencyKey?: string;
    customerEmail?: string;
    customerPhone?: string;
    paymentMode?: string;
    consentAccepted?: boolean;
    consentTimestamp?: string;
    consentVersion?: string;
  }) {
    if (this.isPostgresAuthoritative()) {
      await this.pg.createOrder({
        ...order,
        currency: order.currency || 'INR',
        paymentMode: order.paymentMode || process.env.PAYMENT_MODE || 'disabled',
        provider: 'cashfree'
      });
      return await this.pg.getOrder(order.orderId);
    }

    if (!this.state.orders) this.state.orders = {};

    // IDOR / BOLA Prevention: Verify ownership if attempting to update an existing profile
    if (order.profileId) {
      const existing = this.getRawProfile(order.profileId);
      if (!existing) {
        throw new Error('Profile not found.');
      }
      if (!order.ownerToken || !verifyOwnerToken(existing.ownerTokenHash || existing.ownerToken, order.ownerToken)) {
        throw new Error('Unauthorized: Valid owner token is required to upgrade this profile.');
      }
    }

    this.state.orders[order.orderId] = {
      ...order,
      createdAt: new Date().toISOString(),
      status: 'PENDING'
    };
    this.saveData();
    return this.state.orders[order.orderId];
  }

  public getOrder(orderId: string) {
    return this.state.orders ? this.state.orders[orderId] : undefined;
  }

  public async getOrderAsync(orderId: string) {
    if (this.isPostgresAuthoritative()) {
      return await this.pg.getOrder(orderId);
    }
    return this.getOrder(orderId);
  }

  public constantTimeMatch(a?: string, b?: string): boolean {
    return constantTimeMatch(a, b);
  }

  public getNomination(id: string): Nomination | undefined {
    return this.state.nominations ? this.state.nominations.find(n => n.id === id) : undefined;
  }

  public getRawProfile(id: string): UserProfile | undefined {
    return this.state.profiles.find(p => p.id === id);
  }

  public getProfile(id: string): UserProfile | undefined {
    const p = this.getRawProfile(id);
    if (!p) return undefined;
    if (p.reason === '[Content Removed]' || p.moderationStatus === 'removed') return undefined;
    return this.sanitizeProfile(p);
  }

  public getTopProfile(): UserProfile | undefined {
    const verified = this.state.profiles.filter(
      p => p.isVerified && p.amount > 0 && p.reason !== '[Content Removed]' && p.moderationStatus !== 'removed'
    );
    if (verified.length === 0) return undefined;
    const top = verified.reduce((max, cur) => cur.amount > max.amount ? cur : max, verified[0]);
    return this.sanitizeProfile(top);
  }

  public getProfileByName(name: string): UserProfile | undefined {
    const p = this.state.profiles.find(
      prof => prof.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (!p) return undefined;
    if (p.reason === '[Content Removed]' || p.moderationStatus === 'removed') return undefined;
    return this.sanitizeProfile(p);
  }

  public isPaymentRefProcessed(paymentRef: string): boolean {
    return !!(this.state.processedPaymentRefs && this.state.processedPaymentRefs[paymentRef]);
  }

  public setProfileRoast(profileId: string, roast: string): UserProfile | undefined {
    const p = this.getRawProfile(profileId);
    if (!p) return undefined;
    p.roast = roast;
    p.updatedAt = new Date().toISOString();
    this.saveData();
    return this.sanitizeProfile(p);
  }

  public setProfileLazyReason(profileId: string, lazyReason: string, ownerToken?: string): UserProfile | undefined {
    const p = this.getRawProfile(profileId);
    if (!p) return undefined;

    // Strict authorization: owner token is mandatory and must match using constant-time comparison
    if (!ownerToken || typeof ownerToken !== 'string' || !ownerToken.trim()) {
      throw new Error('Unauthorized: Owner token is required to modify this profile.');
    }
    if (!verifyOwnerToken(p.ownerTokenHash || p.ownerToken, ownerToken.trim())) {
      throw new Error('Unauthorized: Invalid owner token for this profile.');
    }

    p.lazyReason = lazyReason.trim();
    p.updatedAt = new Date().toISOString();
    this.saveData();
    return this.sanitizeProfile(p);
  }

  /**
   * Safe URL / handle normalization
   */
  public normalizeInstagram(raw?: string): string | undefined {
    if (!raw || typeof raw !== 'string') return undefined;
    const clean = raw.trim().replace(/^@/, '');
    const match = clean.match(/^(?:https?:\/\/(?:www\.)?instagram\.com\/)?([a-zA-Z0-9._]{1,30})\/?$/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
    return undefined;
  }

  public normalizeWebsite(raw?: string): string | undefined {
    if (!raw || typeof raw !== 'string') return undefined;
    // Strip control characters and trim
    const trimmed = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
    // Strictly reject dangerous schemes
    if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) {
      return undefined;
    }
    let target = trimmed;
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }
    try {
      const parsed = new URL(target);
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.hostname &&
        parsed.hostname.includes('.') &&
        !parsed.hostname.includes(' ')
      ) {
        return parsed.href;
      }
    } catch {
      // Invalid URL
    }
    return undefined;
  }

  public normalizeLinkedIn(raw?: string): string | undefined {
    if (!raw || typeof raw !== 'string') return undefined;
    const trimmed = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) {
      return undefined;
    }
    const clean = trimmed.replace(/^@/, '');
    if (/^https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9_-]+\/?$/i.test(clean)) {
      return clean.startsWith('http') ? clean : 'https://' + clean;
    }
    if (/^(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9_-]+\/?$/i.test(clean)) {
      return 'https://' + clean;
    }
    const handleMatch = clean.match(/^(?:in\/)?([a-zA-Z0-9_-]{3,100})\/?$/i);
    if (handleMatch && handleMatch[1]) {
      return `https://linkedin.com/in/${handleMatch[1]}`;
    }
    return undefined;
  }

  /**
   * SERVER-AUTHORITATIVE VERIFICATION & CLAIM (v2.0 Core Mechanic)
   * Handles payment verification atomically.
   * Race condition rule: Evaluates true position at verification time.
   * Idempotency: Prevents duplicate payments from the same provider reference.
   */
  public verifyAndClaimRank(params: {
    name: string;
    amount: number;
    paymentRef: string;
    orderId?: string;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
    lazyReason?: string;
    profileId?: string; // Optional if existing user upgrades
    ownerToken?: string; // Ownership credential to prevent IDOR
  }): { success: boolean; profile?: UserProfile; previousTop?: UserProfile; message?: string } {
    const { name, amount, paymentRef, orderId, instagram, linkedin, website, reason, lazyReason, profileId, ownerToken } = params;

    // Defense-in-depth: Reject any settlement mutation when payment is disabled
    const paymentMode = (process.env.PAYMENT_MODE || 'disabled').toLowerCase().trim();
    const isProduction = process.env.NODE_ENV === 'production';
    if (paymentMode === 'disabled') {
      return {
        success: false,
        message: 'Settlement disabled: Live payment processing is currently disabled.'
      };
    }
    if (paymentMode === 'sandbox' && isProduction) {
      throw new Error('FATAL CONFIGURATION ERROR: PAYMENT_MODE=sandbox cannot be used in production environment.');
    }

    // Validate amount
    if (!amount || typeof amount !== 'number' || isNaN(amount) || amount < 1 || amount > 1000000) {
      return { success: false, message: 'Invalid payment amount. Must be between ₹1 and ₹10,00,000.' };
    }

    // Idempotency check: Don't process same payment twice
    if (this.isPaymentRefProcessed(paymentRef)) {
      const existing = this.state.purchases.find(p => p.providerReference === paymentRef);
      if (existing) {
        const prof = this.getRawProfile(existing.profileId);
        if (prof) return { success: true, profile: prof, message: 'Payment already processed.' };
      }
      return { success: false, message: 'Payment reference has already been used.' };
    }

    const previousTop = this.state.profiles.find(p => p.rank === 1 && p.isVerified);
    const prevTopName = previousTop?.name;
    const prevTopAmount = previousTop?.amount || 0;

    let targetProfile: UserProfile | undefined;

    // Upgrade existing profile ONLY when an explicit existing profileId is provided and ownerToken matches
    if (profileId) {
      targetProfile = this.getRawProfile(profileId);
      if (!targetProfile) {
        return {
          success: false,
          message: 'Referenced profile not found for upgrade.'
        };
      }
      if (!ownerToken || typeof ownerToken !== 'string' || !ownerToken.trim()) {
        return {
          success: false,
          message: 'Unauthorized: Owner token required to upgrade an existing profile.'
        };
      }
      if (!verifyOwnerToken(targetProfile.ownerTokenHash || targetProfile.ownerToken, ownerToken.trim())) {
        return {
          success: false,
          message: "Unauthorized: Invalid profile credentials. You cannot modify another participant's profile."
        };
      }
    }

    const normInsta = this.normalizeInstagram(instagram);
    const normLinkedIn = this.normalizeLinkedIn(linkedin);
    const normWeb = this.normalizeWebsite(website);

    if (targetProfile) {
      // Upgrade existing profile: accumulate amount
      targetProfile.amount += Math.round(amount);
      if (normInsta) targetProfile.instagram = normInsta;
      if (normLinkedIn) targetProfile.linkedin = normLinkedIn;
      if (normWeb) targetProfile.website = normWeb;
      if (reason && reason.trim().length > 0) targetProfile.reason = reason.trim();
      if (lazyReason && lazyReason.trim().length > 0) targetProfile.lazyReason = lazyReason.trim();
      targetProfile.isVerified = true;
      targetProfile.verifiedAt = new Date().toISOString();
      targetProfile.updatedAt = new Date().toISOString();
    } else {
      // Create new profile
      const newId = generateId('p');
      const newUserId = generateId('u');
      const newOwnerToken = crypto.randomBytes(24).toString('hex');
      const nowIso = new Date().toISOString();

      targetProfile = {
        id: newId,
        userId: newUserId,
        name: name.trim(),
        amount: Math.round(amount),
        rank: 999, // Will be computed immediately
        instagram: normInsta,
        linkedin: normLinkedIn,
        website: normWeb,
        reason: reason?.trim() || 'Paid to prove laziness. No excuses.',
        lazyReason: lazyReason?.trim() || undefined,
        isVerified: true,
        verifiedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        votesCount: 0,
        ownerToken: newOwnerToken
      };
      this.state.profiles.push(targetProfile);
    }

    // Record purchase
    const verifiedIso = new Date().toISOString();
    const purchase: PurchaseRecord = {
      id: generateId('pur'),
      profileId: targetProfile.id,
      amount: Math.round(amount),
      currency: 'INR',
      paymentProvider: 'UPI_GATEWAY',
      providerReference: paymentRef,
      paymentStatus: 'success',
      verifiedAt: verifiedIso,
      createdAt: verifiedIso
    };

    this.state.purchases.unshift(purchase);
    this.state.processedPaymentRefs[paymentRef] = true;

    // Mark order as completed if orderId is provided
    if (orderId && this.state.orders && this.state.orders[orderId]) {
      this.state.orders[orderId].status = 'completed';
      this.state.orders[orderId].profileId = targetProfile.id;
      (this.state.orders[orderId] as any).completedAt = verifiedIso;
    }

    // Update analytics
    this.state.analytics.successfulPurchases += 1;
    this.state.analytics.totalRevenueINR += Math.round(amount);

    // Recalculate ranks atomically
    this.recalculateRanks();

    const finalizedProfile = this.getRawProfile(targetProfile.id)!;

    // Maintain trajectory claimHistory
    if (!finalizedProfile.claimHistory) {
      finalizedProfile.claimHistory = [];
    }
    finalizedProfile.claimHistory.push({
      id: generateId('ch'),
      amount: Math.round(amount),
      totalAmount: finalizedProfile.amount,
      rank: finalizedProfile.rank,
      timestamp: verifiedIso,
      note: finalizedProfile.rank === 1 ? 'Crown Claim (#1)' : finalizedProfile.claimHistory.length === 0 ? 'Initial Claim' : 'Rank Upgrade'
    });
    // Set daily board reset indicator
    finalizedProfile.rankExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.saveData();

    // Log dynamic activity event
    if (finalizedProfile.rank === 1) {
      this.addActivity('top1', `${finalizedProfile.name} paid ₹${finalizedProfile.amount} and TOOK #1!`, finalizedProfile.amount, finalizedProfile.id);
      if (previousTop && previousTop.id !== finalizedProfile.id) {
        this.addActivity('displaced', `${prevTopName} was pushed to #${previousTop.rank} by ${finalizedProfile.name}.`, previousTop.amount, previousTop.id);

        // Check notification subscriptions for outranked alerts
        if (this.state.notificationSubscriptions && this.state.notificationSubscriptions.length > 0) {
          const outrankedSubs = this.state.notificationSubscriptions.filter(
            s => s.active && s.notifyOnOutranked && s.name && s.name.trim().toLowerCase() === prevTopName?.trim().toLowerCase()
          );
          if (outrankedSubs.length > 0) {
            console.log(`[Notification Alert] Triggered outranked alert email to ${outrankedSubs.map(s => s.email).join(', ')}: ${finalizedProfile.name} took Rank #${finalizedProfile.rank}`);
          }
        }
      }
    } else {
      this.addActivity('rank', `${finalizedProfile.name} paid ₹${amount} to claim Rank #${finalizedProfile.rank}.`, amount, finalizedProfile.id);

      // Check if any users behind this rank were shifted
      if (this.state.notificationSubscriptions && this.state.notificationSubscriptions.length > 0) {
        const matchingSubs = this.state.notificationSubscriptions.filter(
          s => s.active && s.notifyOnOutranked && s.name && s.name.trim().toLowerCase() !== finalizedProfile.name.trim().toLowerCase()
        );
        if (matchingSubs.length > 0) {
          // System can notify subscribers if their specific profile's rank dropped
        }
      }
    }

    this.saveData();

    return {
      success: true,
      profile: finalizedProfile,
      previousTop: previousTop && previousTop.id !== finalizedProfile.id ? previousTop : undefined,
      message: 'Legitimacy Verified.'
    };
  }

  public async reverseRefund(orderId: string, amount: number, reason: string, merchantRefundId: string, providerRefundId?: string): Promise<boolean> {
    if (this.isPostgresAuthoritative()) {
      try {
        const res = await this.pg.reverseRefundAtomic({ orderId, merchantRefundId, amount, reason, providerRefundId });
        return res.success;
      } catch (pgErr) {
        console.error('[PostgreSQL] Reverse refund error:', pgErr);
        return false;
      }
    }
    if (this.state.orders && this.state.orders[orderId]) {
      const ord = this.state.orders[orderId];
      if (!ord.refundedAmount) ord.refundedAmount = 0;
      if (ord.refundedAmount + amount > ord.amount + 0.01) {
        return false;
      }
      ord.refundedAmount += amount;
      ord.status = ord.refundedAmount >= ord.amount - 0.01 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      if (ord.profileId) {
        const prof = this.getRawProfile(ord.profileId);
        if (prof) {
          prof.amount = Math.max(0, prof.amount - Math.round(amount));
          prof.updatedAt = new Date().toISOString();
          this.recalculateRanks();
          this.saveData();
          return true;
        }
      }
      this.saveData();
      return true;
    }
    return false;
  }

  public async reserveRefundAtomic(orderId: string, refundPaise: number, merchantRefundId: string, reason: string): Promise<{ success: boolean; message?: string; remainingRefundablePaise?: number }> {
    if (this.isPostgresAuthoritative()) {
      return this.pg.reserveRefundAtomic(orderId, refundPaise, merchantRefundId, reason);
    }
    if (this.state.orders && this.state.orders[orderId]) {
      const ord = this.state.orders[orderId];
      if (!['PAID', 'PARTIALLY_REFUNDED', 'completed', 'PENDING'].includes(ord.status)) {
        return { success: false, message: 'Order is not refundable in this state' };
      }
      const orderPaise = Math.round(ord.amount * 100);
      const existingRefundedPaise = Math.round((ord.refundedAmount || 0) * 100);
      const remainingPaise = orderPaise - existingRefundedPaise;
      if (refundPaise > remainingPaise) {
        return { success: false, message: 'Refund amount exceeds remaining refundable amount', remainingRefundablePaise: remainingPaise };
      }
      ord.status = 'REFUND_PENDING';
      this.saveData();
      return { success: true, remainingRefundablePaise: remainingPaise - refundPaise };
    }
    return { success: false, message: 'Order not found' };
  }

  public async failRefundReservation(merchantRefundId: string, orderId: string): Promise<void> {
    if (this.isPostgresAuthoritative()) {
      return this.pg.failRefundReservation(merchantRefundId, orderId);
    }
    if (this.state.orders && this.state.orders[orderId]) {
      const ord = this.state.orders[orderId];
      if (ord.status === 'REFUND_PENDING') {
        ord.status = (ord.refundedAmount && ord.refundedAmount > 0) ? 'PARTIALLY_REFUNDED' : 'PAID';
        this.saveData();
      }
    }
  }

  public async recordWebhookEvent(eventId: string, eventType: string, orderId?: string | null, providerPaymentId?: string | null, payload?: any): Promise<boolean> {
    if (this.isPostgresAuthoritative()) {
      return this.pg.recordWebhookEvent(eventId, eventType, orderId, providerPaymentId, payload);
    }
    return true;
  }

  public createParticipant(params: {
    name: string;
    instagram?: string;
    website?: string;
    reason?: string;
  }): UserProfile {
    const normInsta = this.normalizeInstagram(params.instagram);
    const normWeb = this.normalizeWebsite(params.website);
    const newId = generateId('p');
    const newUserId = generateId('u');
    const ownerToken = crypto.randomBytes(24).toString('hex');

    const profile: UserProfile = {
      id: newId,
      userId: newUserId,
      name: params.name.trim(),
      amount: 0,
      rank: 0,
      instagram: normInsta,
      website: normWeb,
      reason: params.reason?.trim() || 'Claim initiated — awaiting payment verification.',
      isVerified: false,
      badge: 'Not Yet Proven',
      title: 'Unverified Participant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      votesCount: 0,
      ownerToken
    };

    this.state.profiles.push(profile);
    this.saveData();
    return profile;
  }

  public createNominationChallenge(
    nomineeName: string,
    reason: string,
    nominatorName?: string,
    targetAmount?: number,
    lazyReason?: string
  ): Nomination {
    const nomId = generateId('nom');
    const nomination: Nomination = {
      id: nomId,
      nomineeName: nomineeName.trim(),
      nominatorName: nominatorName?.trim() || 'A Friend',
      reason: reason.trim(),
      lazyReason: lazyReason?.trim() || undefined,
      targetAmount: targetAmount || this.getMinAmountToBeatTop(),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.state.nominations.unshift(nomination);
    const lazyReasonTag = nomination.lazyReason ? ` as "${nomination.lazyReason}"` : '';
    this.addActivity(
      'challenge',
      `${nomination.nominatorName} nominated ${nomination.nomineeName}${lazyReasonTag} on LAZY (Target: ₹${nomination.targetAmount}).`
    );

    this.saveData();
    return nomination;
  }

  public voteLazy(profileId: string, voterIp: string): { success: boolean; profile?: UserProfile; message: string } {
    const profile = this.getRawProfile(profileId);
    if (!profile) return { success: false, message: 'Profile not found' };

    // Bound in-memory vote keys to avoid unbounded memory growth
    const voteKeys = Object.keys(this.state.votes);
    if (voteKeys.length > 5000) {
      for (let i = 0; i < 500; i++) {
        delete this.state.votes[voteKeys[i]];
      }
    }

    const voteKey = `${profileId}-${voterIp}`;
    if (this.state.votes[voteKey]) {
      return { success: false, profile: this.sanitizeProfile(profile), message: 'You already voted for this person!' };
    }

    this.state.votes[voteKey] = true;
    profile.votesCount = (profile.votesCount || 0) + 1;
    profile.updatedAt = new Date().toISOString();

    this.saveData();
    return { success: true, profile: this.sanitizeProfile(profile), message: 'Vote recorded!' };
  }

  public reportContent(targetType: 'profile' | 'nomination', targetId: string, reason: string): boolean {
    if (targetType === 'profile') {
      const p = this.getRawProfile(targetId);
      if (!p) return false;
      p.isReported = true;
      p.moderationStatus = 'reported';
      p.updatedAt = new Date().toISOString();
    } else if (targetType === 'nomination') {
      const n = this.state.nominations.find(nom => nom.id === targetId);
      if (!n) return false;
      n.status = 'reported';
    } else {
      return false;
    }

    const repId = generateId('rep');
    this.state.reports.unshift({
      id: repId,
      targetType,
      targetId,
      reason: reason.trim().slice(0, 500),
      createdAt: new Date().toISOString(),
      status: 'pending'
    });

    if (this.state.reports.length > 200) {
      this.state.reports = this.state.reports.slice(0, 200);
    }

    this.saveData();
    return true;
  }

  public submitContact(params: {
    name: string;
    email: string;
    subject: string;
    orderId?: string;
    message: string;
    ip?: string;
  }): ContactMessage {
    if (!this.state.contactMessages) {
      this.state.contactMessages = [];
    }
    const msg: ContactMessage = {
      id: generateId('cnt'),
      name: params.name.trim().slice(0, 100),
      email: params.email.trim().slice(0, 150),
      subject: params.subject.trim().slice(0, 100),
      orderId: params.orderId?.trim().slice(0, 50),
      message: params.message.trim().slice(0, 2000),
      ip: params.ip,
      createdAt: new Date().toISOString(),
      status: 'new'
    };
    this.state.contactMessages.unshift(msg);
    if (this.state.contactMessages.length > 200) {
      this.state.contactMessages = this.state.contactMessages.slice(0, 200);
    }
    this.saveData();
    return msg;
  }

  public subscribeNotification(params: {
    email: string;
    name?: string;
    notifyOnOutranked?: boolean;
    notifyOnNomination?: boolean;
    ip?: string;
  }): { success: boolean; message: string; subscription: NotificationSubscription } {
    if (!params || typeof params.email !== 'string' || !params.email.includes('@')) {
      return {
        success: false,
        message: 'Valid email address is required',
        subscription: {} as NotificationSubscription
      };
    }

    if (!this.state.notificationSubscriptions) {
      this.state.notificationSubscriptions = [];
    }

    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name ? params.name.trim().slice(0, 50) : undefined;
    const notifyOnOutranked = params.notifyOnOutranked !== false;
    const notifyOnNomination = params.notifyOnNomination !== false;

    const existingIndex = this.state.notificationSubscriptions.findIndex(
      s => s.email.toLowerCase() === cleanEmail
    );

    if (existingIndex >= 0) {
      const existing = this.state.notificationSubscriptions[existingIndex];
      if (cleanName) existing.name = cleanName;
      existing.notifyOnOutranked = notifyOnOutranked;
      existing.notifyOnNomination = notifyOnNomination;
      existing.active = true;
      existing.updatedAt = new Date().toISOString();
      if (params.ip) existing.ip = params.ip;
      this.saveData();
      return {
        success: true,
        message: 'Notification preference saved. Email delivery is not active yet.',
        subscription: existing
      };
    }

    const newSub: NotificationSubscription = {
      id: generateId('sub'),
      email: cleanEmail,
      name: cleanName,
      notifyOnOutranked,
      notifyOnNomination,
      ip: params.ip,
      createdAt: new Date().toISOString(),
      active: true
    };

    this.state.notificationSubscriptions.push(newSub);
    this.saveData();
    return {
      success: true,
      message: 'Notification preference saved. Email delivery is not active yet.',
      subscription: newSub
    };
  }

  public getNotificationSubscriptions(): NotificationSubscription[] {
    return this.state.notificationSubscriptions || [];
  }

  public addActivity(type: ActivityEvent['type'], text: string, amount?: number, profileId?: string) {
    this.state.activities.unshift({
      id: generateId('act'),
      type,
      text,
      amount,
      profileId,
      timestamp: new Date().toISOString()
    });
    if (this.state.activities.length > 80) {
      this.state.activities = this.state.activities.slice(0, 80);
    }
  }

  public getActivities(): ActivityEvent[] {
    return this.state.activities.slice(0, 40);
  }

  private analyticsSaveTimeout: NodeJS.Timeout | null = null;

  public trackEvent(event: keyof AnalyticsSummary) {
    if (typeof this.state.analytics[event] === 'number') {
      (this.state.analytics[event] as number) += 1;
      // Debounce saving analytics to disk (max once per 30s)
      if (!this.analyticsSaveTimeout) {
        this.analyticsSaveTimeout = setTimeout(() => {
          this.analyticsSaveTimeout = null;
          this.saveData();
        }, 30000);
      }
    }
  }

  /**
   * Real active session heartbeat and genuine daily visits tracking (Section 4, 5, 6, 7).
   * Honest, real metrics only — strictly no synthetic counters or fake traffic.
   */
  public recordHeartbeat(sessionId: string): { online: number; visitsToday: number } {
    const now = Date.now();
    const cleanId = sessionId.trim().slice(0, 64);
    if (cleanId) {
      this.activeSessions.set(cleanId, now);

      // Prune sessions older than 5 minutes (300,000 ms)
      for (const [id, lastSeen] of this.activeSessions.entries()) {
        if (now - lastSeen > 5 * 60 * 1000) {
          this.activeSessions.delete(id);
        }
      }

      // Cap activeSessions collection size to prevent unbounded memory growth
      if (this.activeSessions.size > 2000) {
        const oldestKeys = Array.from(this.activeSessions.keys()).slice(0, 500);
        for (const k of oldestKeys) {
          this.activeSessions.delete(k);
        }
      }

      // Track unique daily sessions based on UTC calendar day
      const todayKey = new Date().toISOString().slice(0, 10);
      let todaySet = this.dailyVisits.get(todayKey);
      if (!todaySet) {
        todaySet = new Set();
        this.dailyVisits.set(todayKey, todaySet);
      }
      todaySet.add(cleanId);

      // Prune daily visits older than 7 days
      if (this.dailyVisits.size > 14) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        for (const dateKey of this.dailyVisits.keys()) {
          if (dateKey < sevenDaysAgo) {
            this.dailyVisits.delete(dateKey);
          }
        }
      }
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const todaySet = this.dailyVisits.get(todayKey);
    const visitsToday = todaySet ? todaySet.size : 0;
    const online = this.activeSessions.size;

    return { online, visitsToday };
  }

  /**
   * Live public statistics derived entirely from genuine application state.
   */
  public getLiveStats(sessionId?: string): LiveStats {
    if (sessionId) {
      this.recordHeartbeat(sessionId);
    }

    const now = Date.now();
    for (const [id, lastSeen] of this.activeSessions.entries()) {
      if (now - lastSeen > 5 * 60 * 1000) {
        this.activeSessions.delete(id);
      }
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const todaySet = this.dailyVisits.get(todayKey);
    const visitsToday = todaySet ? todaySet.size : 0;
    const online = this.activeSessions.size;

    const verifiedProfiles = this.state.profiles.filter(p => p.isVerified && p.amount > 0 && p.moderationStatus !== 'removed' && p.reason !== '[Content Removed]');
    const totalVerifiedParticipants = verifiedProfiles.length;
    const totalVerifiedRevenue = verifiedProfiles.reduce((sum, p) => sum + p.amount, 0);
    const totalClaims = this.state.purchases.length || verifiedProfiles.length;
    const topAmount = this.getTopAmount();
    const minAmountToBeatTop = this.getMinAmountToBeatTop();

    // Compute claims today for live stats
    const globalAct = this.getGlobalActivity();
    const claimsToday = globalAct.claimsToday;

    return {
      online,
      visitsToday,
      totalVerifiedParticipants,
      totalVerifiedRevenue,
      totalClaims,
      claimsToday,
      topAmount,
      minAmountToBeatTop
    };
  }

  /**
   * Authoritative Global Activity aggregation for heat map and social proof
   * Strictly truthful metrics derived from genuine database records.
   */
  public getGlobalActivity(): GlobalActivityData {
    const now = new Date();
    const nowMs = now.getTime();
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const twentyFourHoursAgoMs = nowMs - 24 * 60 * 60 * 1000;

    interface NormalizedClaim {
      id: string;
      amount: number;
      timestamp: string;
      dateStr: string;
      hour: number;
    }

    const allClaims: NormalizedClaim[] = [];
    const seenIds = new Set<string>();

    // 1. From completed purchases
    if (this.state.purchases && this.state.purchases.length > 0) {
      for (const pur of this.state.purchases) {
        if (pur.paymentStatus === 'success') {
          const ts = pur.verifiedAt || pur.createdAt || new Date().toISOString();
          const d = new Date(ts);
          allClaims.push({
            id: pur.id,
            amount: pur.amount || 0,
            timestamp: ts,
            dateStr: d.toISOString().slice(0, 10),
            hour: d.getHours()
          });
          seenIds.add(pur.id);
        }
      }
    }

    // 2. From verified profile claim history
    for (const prof of this.state.profiles) {
      if (prof.isVerified && prof.amount > 0 && !prof.isReported && prof.reason !== '[Content Removed]') {
        if (prof.claimHistory && prof.claimHistory.length > 0) {
          for (const ch of prof.claimHistory) {
            if (!seenIds.has(ch.id)) {
              const ts = ch.timestamp || prof.verifiedAt || prof.createdAt;
              const d = new Date(ts);
              allClaims.push({
                id: ch.id,
                amount: ch.amount || 0,
                timestamp: ts,
                dateStr: d.toISOString().slice(0, 10),
                hour: d.getHours()
              });
              seenIds.add(ch.id);
            }
          }
        } else {
          const cid = 'ch-' + prof.id;
          if (!seenIds.has(cid)) {
            const ts = prof.verifiedAt || prof.createdAt;
            const d = new Date(ts);
            allClaims.push({
              id: cid,
              amount: prof.amount,
              timestamp: ts,
              dateStr: d.toISOString().slice(0, 10),
              hour: d.getHours()
            });
            seenIds.add(cid);
          }
        }
      }
    }

    // Filter today's claims (either calendar day or past 24 hours)
    const todayClaims = allClaims.filter(c => {
      const cMs = new Date(c.timestamp).getTime();
      return cMs >= startOfTodayMs || cMs >= twentyFourHoursAgoMs;
    });

    // Truthful counts without synthetic padding
    const claimsToday = todayClaims.length;
    const claimsTotal = allClaims.length;
    const totalAmountToday = todayClaims.reduce((acc, c) => acc + c.amount, 0);

    // Build 24-hour activity buckets
    const currentHour = now.getHours();
    const hourlyActivity: HourlyActivityBucket[] = [];

    const formatHourLabel = (h: number): string => {
      if (h === 0) return '12 AM';
      if (h < 12) return `${h} AM`;
      if (h === 12) return '12 PM';
      return `${h - 12} PM`;
    };

    let peakClaims = 0;
    let peakHourIndex = currentHour;

    for (let h = 0; h < 24; h++) {
      const claimsInHour = todayClaims.filter(c => c.hour === h);
      const count = claimsInHour.length;
      const amt = claimsInHour.reduce((acc, c) => acc + c.amount, 0);

      let intensity = 0;
      if (count >= 5) intensity = 4;
      else if (count >= 3) intensity = 3;
      else if (count >= 2) intensity = 2;
      else if (count >= 1) intensity = 1;

      if (count > peakClaims) {
        peakClaims = count;
        peakHourIndex = h;
      }

      hourlyActivity.push({
        hour: h,
        label: formatHourLabel(h),
        claimsCount: count,
        amount: amt,
        intensity,
        isCurrentHour: h === currentHour
      });
    }

    // Build recent 7 days activity
    const recentDays: DayActivityBucket[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(nowMs - i * 24 * 60 * 60 * 1000);
      const dayDateStr = dayDate.toISOString().slice(0, 10);
      const dayName = dayNames[dayDate.getDay()];
      const isToday = i === 0;

      const claimsInDay = allClaims.filter(c => c.dateStr === dayDateStr);
      const count = isToday ? claimsToday : claimsInDay.length;
      const amt = isToday ? totalAmountToday : claimsInDay.reduce((acc, c) => acc + c.amount, 0);

      let intensity = 0;
      if (count >= 12) intensity = 4;
      else if (count >= 8) intensity = 3;
      else if (count >= 5) intensity = 2;
      else if (count >= 1) intensity = 1;

      recentDays.push({
        date: dayDateStr,
        dayName,
        claimsCount: count,
        amount: amt,
        intensity,
        isToday
      });
    }

    const peakHour = peakClaims > 0 ? `${formatHourLabel(peakHourIndex)} – ${formatHourLabel((peakHourIndex + 1) % 24)}` : 'None recorded yet';

    let latestClaimMinutesAgo: number | null = null;
    if (allClaims.length > 0) {
      const sorted = [...allClaims].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const diffMin = Math.floor((nowMs - new Date(sorted[0].timestamp).getTime()) / 60000);
      latestClaimMinutesAgo = Math.max(0, diffMin);
    }

    return {
      claimsToday,
      claimsTotal,
      totalAmountToday,
      hourlyActivity,
      recentDays,
      peakHour,
      latestClaimMinutesAgo,
      activeParticipantsNow: this.activeSessions.size,
      updatedAt: now.toISOString()
    };
  }

  public getAdminData() {
    return {
      analytics: this.state.analytics,
      nominations: this.state.nominations,
      reports: this.state.reports,
      profiles: this.state.profiles,
      purchases: this.state.purchases,
      contactMessages: this.state.contactMessages || [],
      notificationSubscriptions: this.state.notificationSubscriptions || []
    };
  }

  public moderate(action: 'remove' | 'restore' | 'resolve_report', targetId: string): boolean {
    let affected = false;
    if (action === 'remove') {
      const p = this.getRawProfile(targetId);
      if (p) {
        p.reason = '[Content Removed]';
        p.isReported = true;
        p.moderationStatus = 'removed';
        p.updatedAt = new Date().toISOString();
        affected = true;
      }
      const n = this.state.nominations.find(nom => nom.id === targetId);
      if (n) {
        n.reason = '[Content Removed]';
        n.status = 'removed';
        affected = true;
      }
    } else if (action === 'restore') {
      const p = this.getRawProfile(targetId);
      if (p) {
        p.isReported = false;
        p.moderationStatus = 'active';
        if (p.reason === '[Content Removed]') {
          p.reason = p.lazyReason || 'Verified Participant';
        }
        p.updatedAt = new Date().toISOString();
        affected = true;
      }
      const n = this.state.nominations.find(nom => nom.id === targetId);
      if (n) {
        n.status = 'active';
        if (n.reason === '[Content Removed]') {
          n.reason = 'Nomination active';
        }
        affected = true;
      }
    } else if (action === 'resolve_report') {
      const r = this.state.reports.find(rep => rep.id === targetId);
      if (r) {
        r.status = 'actioned';
        affected = true;
      }
    }
    if (affected) {
      this.recalculateRanks();
      this.saveData();
      return true;
    }
    return false;
  }

  // =========================================================================
  // WEEKLY LAZY DILEMMA POLL SYSTEM
  // =========================================================================
  private ensureDefaultDilemma(): LazyDilemma {
    if (!this.state.dilemma) {
      const isDemo = process.env.DEMO_MODE === 'true';
      this.state.dilemma = {
        id: 'dilemma-w37-food-delivery',
        title: 'Is ordering food lazy or smart?',
        description: 'You are lying on your couch. The kitchen is 15 steps away. A fresh Biryani is ₹249 on Swiggy. Are you an efficiency genius or unapologetically lazy?',
        weekLabel: 'Weekly Lazy Dilemma',
        category: 'Food & Survival',
        totalVotes: isDemo ? 842 : 0,
        options: [
          { id: 'opt-smart', label: 'Smart — Time is money & cooking has dishes', votes: isDemo ? 488 : 0, percentage: isDemo ? 58 : 0, emoji: '🧠' },
          { id: 'opt-lazy', label: 'Lazy — I literally could not walk 15 steps', votes: isDemo ? 312 : 0, percentage: isDemo ? 37 : 0, emoji: '🛋️' },
          { id: 'opt-both', label: 'Both — Smartly lazy in true LAZY fashion', votes: isDemo ? 42 : 0, percentage: isDemo ? 5 : 0, emoji: '👑' }
        ]
      };
    }
    if (!this.state.dilemmaVotes) {
      this.state.dilemmaVotes = {};
    }
    return this.state.dilemma;
  }

  public getDilemma(voterKey?: string): LazyDilemma {
    const dilemma = this.ensureDefaultDilemma();
    const totalVotes = dilemma.options.reduce((sum, opt) => sum + opt.votes, 0);
    
    // Recalculate percentages dynamically
    const options = dilemma.options.map(opt => ({
      ...opt,
      percentage: totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
    }));

    const userVotedOptionId = voterKey && this.state.dilemmaVotes ? this.state.dilemmaVotes[voterKey] || null : null;

    return {
      ...dilemma,
      totalVotes,
      options,
      userVotedOptionId
    };
  }

  public voteDilemma(optionId: string, voterKey: string): { success: boolean; dilemma: LazyDilemma; message?: string } {
    const dilemma = this.ensureDefaultDilemma();
    if (!this.state.dilemmaVotes) {
      this.state.dilemmaVotes = {};
    }

    // Bound voter keys to avoid unbounded memory growth
    const voterKeys = Object.keys(this.state.dilemmaVotes);
    if (voterKeys.length > 5000) {
      for (let i = 0; i < 500; i++) {
        delete this.state.dilemmaVotes[voterKeys[i]];
      }
    }

    const previousVote = this.state.dilemmaVotes[voterKey];
    if (previousVote === optionId) {
      return { success: true, dilemma: this.getDilemma(voterKey), message: 'Vote already recorded' };
    }

    // If changing vote, decrement old vote
    if (previousVote) {
      const oldOption = dilemma.options.find(o => o.id === previousVote);
      if (oldOption && oldOption.votes > 0) {
        oldOption.votes -= 1;
      }
    }

    // Increment new vote
    const newOption = dilemma.options.find(o => o.id === optionId);
    if (!newOption) {
      return { success: false, dilemma: this.getDilemma(voterKey), message: 'Invalid option selected' };
    }

    newOption.votes += 1;
    this.state.dilemmaVotes[voterKey] = optionId;
    this.saveData();

    return {
      success: true,
      dilemma: this.getDilemma(voterKey)
    };
  }

  public addProfile(profile: UserProfile): void {
    const existingIndex = this.state.profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
      this.state.profiles[existingIndex] = profile;
    } else {
      this.state.profiles.push(profile);
    }
    this.recalculateRanks();
    this.saveData();
  }
}

export const db = new LazyDatabase();

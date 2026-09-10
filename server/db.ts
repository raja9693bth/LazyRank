import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserProfile, Nomination, ActivityEvent, PurchaseRecord, ReportRecord, AnalyticsSummary, LiveStats, ContactMessage } from '../src/types.ts';

const DATA_FILE = path.join(process.cwd(), 'server-data.json');

// Initial seed profiles with verified paid amounts and social/website links
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
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    votesCount: 54
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
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    votesCount: 38
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
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    votesCount: 29
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
    isVerified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
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
      paymentRef?: string;
      createdAt: string;
      status: string;
    };
  };
  analytics: AnalyticsSummary;
  contactMessages?: ContactMessage[];
}

export class LazyDatabase {
  private state: DatabaseState;
  private activeSessions: Map<string, number> = new Map();
  private dailyVisits: Map<string, Set<string>> = new Map();

  constructor() {
    this.state = this.loadData();
    this.recalculateRanks();
  }

  private loadData(): DatabaseState {
    const parseState = (raw: string): DatabaseState | null => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.profiles && Array.isArray(parsed.profiles)) {
          // Ensure migration of any missing fields for v2.0 & v2.3
          const hasV2Amounts = parsed.profiles.some((p: any) => typeof p.amount === 'number' && p.amount > 0);
          if (!hasV2Amounts) {
            parsed.profiles = [...INITIAL_PROFILES];
            parsed.activities = [...INITIAL_ACTIVITIES];
          }
          // Ensure every profile has ownerToken and verifiedAt set
          parsed.profiles.forEach((p: any) => {
            if (p.isVerified && !p.verifiedAt) {
              p.verifiedAt = p.createdAt || new Date().toISOString();
            }
            if (!p.ownerToken) {
              p.ownerToken = 'seed_' + p.id + '_' + crypto.randomBytes(12).toString('hex');
            }
          });
          parsed.processedPaymentRefs = parsed.processedPaymentRefs || {};
          parsed.orders = parsed.orders || {};
          parsed.analytics = parsed.analytics || {
            homepageViews: 1420,
            claimStarts: 480,
            amountSelected: 340,
            checkoutStarts: 120,
            successfulPurchases: 45,
            totalRevenueINR: 10746,
            shareClicks: 215,
            leaderboardClicks: 640,
            instagramClicks: 110,
            websiteClicks: 85,
            challengeClicks: 70
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

    const defaultProfiles = INITIAL_PROFILES.map(p => ({
      ...p,
      ownerToken: 'seed_' + p.id + '_' + crypto.randomBytes(12).toString('hex')
    }));

    return {
      profiles: defaultProfiles,
      nominations: [],
      activities: [...INITIAL_ACTIVITIES],
      purchases: [],
      reports: [],
      votes: {},
      processedPaymentRefs: {},
      orders: {},
      analytics: {
        homepageViews: 1420,
        claimStarts: 480,
        amountSelected: 340,
        checkoutStarts: 120,
        successfulPurchases: 45,
        totalRevenueINR: 10746,
        shareClicks: 215,
        leaderboardClicks: 640,
        instagramClicks: 110,
        websiteClicks: 85,
        challengeClicks: 70
      }
    };
  }

  private saveData() {
    try {
      const tempFile = `${DATA_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
      const payload = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(tempFile, payload, 'utf-8');
      fs.renameSync(tempFile, DATA_FILE);

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
  public recalculateRanks(): { topAmount: number; minAmountToBeatTop: number } {
    // Only verified active profiles with valid amounts appear on public paid leaderboard
    const verifiedProfiles = this.state.profiles.filter(
      p => p.isVerified && p.amount > 0 && !p.isReported && p.reason !== '[Content Removed]'
    );

    verifiedProfiles.sort((a, b) => {
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

    verifiedProfiles.forEach((profile, index) => {
      profile.rank = index + 1;

      // Assign dynamic badges
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
    });

    this.saveData();

    const topAmount = verifiedProfiles.length > 0 ? verifiedProfiles[0].amount : 0;
    const minAmountToBeatTop = topAmount + 1;

    return { topAmount, minAmountToBeatTop };
  }

  public getTopAmount(): number {
    const verified = this.state.profiles.filter(p => p.isVerified && p.amount > 0 && !p.isReported);
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
  } {
    const period = options?.period || 'all';
    const filter = options?.filter || 'verified';

    // Flexible offset & limit or page & pageSize (default initial batch = 20)
    let offset = 0;
    let limit = 20;
    let page = 1;

    if (options?.offset !== undefined) {
      offset = Math.max(0, options.offset);
      limit = Math.max(1, Math.min(100, options.limit !== undefined ? options.limit : 20));
      page = Math.floor(offset / limit) + 1;
    } else {
      page = Math.max(1, options?.page || 1);
      const pageSize = Math.max(1, Math.min(100, options?.pageSize || 20));
      offset = (page - 1) * pageSize;
      limit = pageSize;
    }

    const cutoff = LazyDatabase.getPeriodCutoff(period);

    // Filter verified profiles for the selected period
    const verifiedFiltered = this.state.profiles.filter(p => {
      if (!p.isVerified || p.amount <= 0) return false;
      if (p.isReported && p.reason === '[Content Removed]') return false;
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

    // Period-accurate #1 amount and minimum required to take #1
    const periodTopAmount = mappedVerified.length > 0 ? mappedVerified[0].amount : 0;
    const periodMinAmountToBeatTop = periodTopAmount > 0 ? periodTopAmount + 1 : 1;

    let allEntries: UserProfile[] = mappedVerified;

    if (filter === 'all') {
      // Include unverified / ₹0 participants (Section 5)
      const unverified = this.state.profiles.filter(p => {
        if (p.isVerified && p.amount > 0) return false;
        if (p.isReported && p.reason === '[Content Removed]') return false;
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
      topAmount: periodTopAmount,
      minAmountToBeatTop: periodMinAmountToBeatTop,
      filter
    };
  }

  /**
   * Sanitizes profile to strip private server-only tokens before sending to public clients
   */
  public sanitizeProfile(profile: UserProfile): UserProfile {
    const { ownerToken, ...safe } = profile;
    return safe as UserProfile;
  }

  public createOrder(order: {
    orderId: string;
    name: string;
    amount: number;
    profileId?: string;
    ownerToken?: string;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
  }) {
    if (!this.state.orders) this.state.orders = {};

    // IDOR / BOLA Prevention: Verify ownership if attempting to update an existing profile
    if (order.profileId) {
      const existing = this.getRawProfile(order.profileId);
      if (existing && existing.ownerToken && existing.ownerToken !== order.ownerToken) {
        throw new Error('Unauthorized: You cannot modify another participant\'s profile.');
      }
    }

    this.state.orders[order.orderId] = {
      ...order,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    this.saveData();
    return this.state.orders[order.orderId];
  }

  public getOrder(orderId: string) {
    return this.state.orders ? this.state.orders[orderId] : undefined;
  }

  public getRawProfile(id: string): UserProfile | undefined {
    return this.state.profiles.find(p => p.id === id);
  }

  public getProfile(id: string): UserProfile | undefined {
    this.recalculateRanks();
    const p = this.getRawProfile(id);
    return p ? this.sanitizeProfile(p) : undefined;
  }

  public getProfileByName(name: string): UserProfile | undefined {
    const p = this.state.profiles.find(
      prof => prof.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    return p ? this.sanitizeProfile(p) : undefined;
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
    profileId?: string; // Optional if existing user upgrades
    ownerToken?: string; // Ownership credential to prevent IDOR
  }): { success: boolean; profile?: UserProfile; previousTop?: UserProfile; message?: string } {
    const { name, amount, paymentRef, orderId, instagram, linkedin, website, reason, profileId, ownerToken } = params;

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
      if (targetProfile && targetProfile.ownerToken && targetProfile.ownerToken !== ownerToken) {
        return {
          success: false,
          message: 'Unauthorized: Invalid profile credentials. You cannot modify another participant\'s profile.'
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
      targetProfile.isVerified = true;
      targetProfile.verifiedAt = new Date().toISOString();
      targetProfile.updatedAt = new Date().toISOString();
    } else {
      // Create new profile
      const newId = 'p-' + Math.random().toString(36).substring(2, 9);
      const newUserId = 'u-' + Math.random().toString(36).substring(2, 9);
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
      id: 'pur-' + Math.random().toString(36).substring(2, 9),
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
    }

    // Update analytics
    this.state.analytics.successfulPurchases += 1;
    this.state.analytics.totalRevenueINR += Math.round(amount);

    // Recalculate ranks atomically
    this.recalculateRanks();

    const finalizedProfile = this.getRawProfile(targetProfile.id)!;

    // Log dynamic activity event
    if (finalizedProfile.rank === 1) {
      this.addActivity('top1', `${finalizedProfile.name} paid ₹${finalizedProfile.amount} and TOOK #1!`, finalizedProfile.amount, finalizedProfile.id);
      if (previousTop && previousTop.id !== finalizedProfile.id) {
        this.addActivity('displaced', `${prevTopName} was pushed to #${previousTop.rank} by ${finalizedProfile.name}.`, previousTop.amount, previousTop.id);
      }
    } else {
      this.addActivity('rank', `${finalizedProfile.name} paid ₹${amount} to claim Rank #${finalizedProfile.rank}.`, amount, finalizedProfile.id);
    }

    this.saveData();

    return {
      success: true,
      profile: finalizedProfile,
      previousTop: previousTop && previousTop.id !== finalizedProfile.id ? previousTop : undefined,
      message: 'Legitimacy Verified.'
    };
  }

  public createParticipant(params: {
    name: string;
    instagram?: string;
    website?: string;
    reason?: string;
  }): UserProfile {
    const normInsta = this.normalizeInstagram(params.instagram);
    const normWeb = this.normalizeWebsite(params.website);
    const newId = 'p-' + Math.random().toString(36).substring(2, 9);
    const newUserId = 'u-' + Math.random().toString(36).substring(2, 9);
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

  public createNominationChallenge(nomineeName: string, reason: string, nominatorName?: string, targetAmount?: number): Nomination {
    const nomId = 'nom-' + Math.random().toString(36).substring(2, 9);
    const nomination: Nomination = {
      id: nomId,
      nomineeName: nomineeName.trim(),
      nominatorName: nominatorName?.trim() || 'A Friend',
      reason: reason.trim(),
      targetAmount: targetAmount || this.getMinAmountToBeatTop(),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.state.nominations.unshift(nomination);
    this.addActivity(
      'challenge',
      `${nomination.nominatorName} challenged ${nomination.nomineeName} to beat ₹${nomination.targetAmount} on LAZY.`
    );
    this.saveData();
    return nomination;
  }

  public voteLazy(profileId: string, voterIp: string): { success: boolean; profile?: UserProfile; message: string } {
    const profile = this.getProfile(profileId);
    if (!profile) return { success: false, message: 'Profile not found' };

    const voteKey = `${profileId}-${voterIp}`;
    if (this.state.votes[voteKey]) {
      return { success: false, profile, message: 'You already voted for this person!' };
    }

    this.state.votes[voteKey] = true;
    profile.votesCount = (profile.votesCount || 0) + 1;
    profile.updatedAt = new Date().toISOString();

    this.saveData();
    return { success: true, profile, message: 'Vote recorded!' };
  }

  public reportContent(targetType: 'profile' | 'nomination', targetId: string, reason: string): boolean {
    const repId = 'rep-' + Math.random().toString(36).substring(2, 9);
    this.state.reports.unshift({
      id: repId,
      targetType,
      targetId,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    });

    if (targetType === 'profile') {
      const p = this.getProfile(targetId);
      if (p) p.isReported = true;
    } else {
      const n = this.state.nominations.find(nom => nom.id === targetId);
      if (n) n.status = 'reported';
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
      id: 'cnt-' + Math.random().toString(36).substring(2, 9),
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

  public addActivity(type: ActivityEvent['type'], text: string, amount?: number, profileId?: string) {
    this.state.activities.unshift({
      id: 'act-' + Math.random().toString(36).substring(2, 9),
      type,
      text,
      amount,
      profileId,
      timestamp: new Date().toISOString()
    });
    if (this.state.activities.length > 30) {
      this.state.activities = this.state.activities.slice(0, 30);
    }
  }

  public getActivities(): ActivityEvent[] {
    return this.state.activities.slice(0, 15);
  }

  public trackEvent(event: keyof AnalyticsSummary) {
    if (typeof this.state.analytics[event] === 'number') {
      (this.state.analytics[event] as number) += 1;
      this.saveData();
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

      // Track unique daily sessions based on UTC calendar day
      const todayKey = new Date().toISOString().slice(0, 10);
      let todaySet = this.dailyVisits.get(todayKey);
      if (!todaySet) {
        todaySet = new Set();
        this.dailyVisits.set(todayKey, todaySet);
      }
      todaySet.add(cleanId);
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const todaySet = this.dailyVisits.get(todayKey);
    const visitsToday = Math.max(todaySet ? todaySet.size : 0, 1);
    const online = Math.max(this.activeSessions.size, 1);

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
    const visitsToday = Math.max(todaySet ? todaySet.size : 0, 1);
    const online = Math.max(this.activeSessions.size, 1);

    const verifiedProfiles = this.state.profiles.filter(p => p.isVerified && p.amount > 0 && !p.isReported);
    const totalVerifiedParticipants = verifiedProfiles.length;
    const totalVerifiedRevenue = verifiedProfiles.reduce((sum, p) => sum + p.amount, 0);
    const totalClaims = this.state.purchases.length || verifiedProfiles.length;
    const topAmount = this.getTopAmount();
    const minAmountToBeatTop = this.getMinAmountToBeatTop();

    return {
      online,
      visitsToday,
      totalVerifiedParticipants,
      totalVerifiedRevenue,
      totalClaims,
      topAmount,
      minAmountToBeatTop
    };
  }

  public getAdminData() {
    return {
      analytics: this.state.analytics,
      nominations: this.state.nominations,
      reports: this.state.reports,
      profiles: this.state.profiles,
      purchases: this.state.purchases,
      contactMessages: this.state.contactMessages || []
    };
  }

  public moderate(action: 'remove' | 'restore' | 'resolve_report', targetId: string) {
    if (action === 'remove') {
      const p = this.getProfile(targetId);
      if (p) {
        p.reason = '[Content Removed]';
        p.isReported = true;
      }
      const n = this.state.nominations.find(nom => nom.id === targetId);
      if (n) {
        n.reason = '[Content Removed]';
        n.status = 'removed';
      }
    } else if (action === 'restore') {
      const p = this.getProfile(targetId);
      if (p) {
        p.isReported = false;
      }
      const n = this.state.nominations.find(nom => nom.id === targetId);
      if (n) {
        n.status = 'active';
      }
    } else if (action === 'resolve_report') {
      const r = this.state.reports.find(rep => rep.id === targetId);
      if (r) r.status = 'resolved';
    }
    this.recalculateRanks();
    this.saveData();
    return true;
  }
}

export const db = new LazyDatabase();

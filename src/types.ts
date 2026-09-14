export type RankPeriod = 'today' | 'week' | 'month' | 'all';

export type UserTier = 'free' | 'verified';

export interface ClaimHistoryRecord {
  id: string;
  amount: number; // incremental amount paid in this claim
  totalAmount: number; // cumulative total amount after this claim
  rank: number; // rank achieved at this claim
  timestamp: string; // ISO string
  note?: string; // e.g. "Initial Claim", "Rank Upgrade", "Crown Claim"
}

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  amount: number; // Verified paid amount in INR (Canonical ranking metric!)
  rank: number; // 1-indexed derived rank
  instagram?: string; // Optional Instagram handle or URL (e.g., @username)
  linkedin?: string; // Optional LinkedIn profile URL or handle
  website?: string; // Optional Website URL (e.g., https://example.com)
  reason?: string; // Optional short laziness statement
  title?: string; // Humorous title or label
  badge?: string; // Badge for #1, top ranks, or verified
  isVerified: boolean; // Must be true for public legitimacy rank
  verifiedAt?: string; // Server verification timestamp
  createdAt: string;
  updatedAt: string;
  votesCount?: number; // Social +1 laziness votes
  ownerToken?: string; // Private authorization token for profile updates (stripped from public responses)
  isNomination?: boolean;
  nominatorName?: string;
  isReported?: boolean;
  challengeTargetRank?: number;
  roast?: string; // Optional AI Lazy Roast
  claimHistory?: ClaimHistoryRecord[]; // Chronological claim progression records
  rankExpiresAt?: string; // ISO string when rank protection expires and scheduled drop triggers
  lazyReason?: string; // Predefined selected Lazy Reason (e.g. 'Procrastination Master', 'Bed Connoisseur')
  lazyStreakDays?: number; // Consecutive days maintaining a Top 10 position to encourage retention
}

export interface Nomination {
  id: string;
  nomineeName: string;
  nomineeUserId?: string;
  nominatorName?: string;
  reason: string;
  lazyReason?: string; // Predefined selected Lazy Reason
  targetAmount?: number;
  status: 'active' | 'reported' | 'removed';
  createdAt: string;
  profileId?: string;
  rank?: number;
}

export const PREDEFINED_LAZY_REASONS = [
  'Procrastination Master',
  'Bed Connoisseur',
  'Professional Couch Potato',
  'Nap Enthusiast',
  'Horizontal Living Specialist',
  'Snooze Button Champion',
  'Will Do It Tomorrow',
  'Chief Sloth Officer',
  'Energy Conservation Expert',
  'Remote Control Archaeologist',
  'Master of Minimum Effort',
  'Serial Tab Accumulator'
] as const;

export type PredefinedLazyReason = (typeof PREDEFINED_LAZY_REASONS)[number];

export interface LazyReasonMeta {
  id: string;
  name: PredefinedLazyReason;
  tagline: string;
  emoji: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const LAZY_REASONS_CATALOG: LazyReasonMeta[] = [
  {
    id: 'procrastination-master',
    name: 'Procrastination Master',
    tagline: 'Why do today what you can delay indefinitely?',
    emoji: '⏳',
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-300',
    badgeText: 'text-amber-900'
  },
  {
    id: 'bed-connoisseur',
    name: 'Bed Connoisseur',
    tagline: 'Mattress enthusiast, pillow sommelier, blanket architect.',
    emoji: '🛏️',
    badgeBg: 'bg-indigo-50',
    badgeBorder: 'border-indigo-300',
    badgeText: 'text-indigo-900'
  },
  {
    id: 'professional-couch-potato',
    name: 'Professional Couch Potato',
    tagline: 'Living room fixture with zero intention of standing up.',
    emoji: '🛋️',
    badgeBg: 'bg-orange-50',
    badgeBorder: 'border-orange-300',
    badgeText: 'text-orange-900'
  },
  {
    id: 'nap-enthusiast',
    name: 'Nap Enthusiast',
    tagline: 'Can power nap in any orientation at any time of day.',
    emoji: '💤',
    badgeBg: 'bg-sky-50',
    badgeBorder: 'border-sky-300',
    badgeText: 'text-sky-900'
  },
  {
    id: 'horizontal-living-specialist',
    name: 'Horizontal Living Specialist',
    tagline: 'Gravity is meant to be shared with furniture.',
    emoji: '🛌',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-300',
    badgeText: 'text-purple-900'
  },
  {
    id: 'snooze-button-champion',
    name: 'Snooze Button Champion',
    tagline: '7 alarms set. Swiped all 7 without opening eyes.',
    emoji: '⏰',
    badgeBg: 'bg-rose-50',
    badgeBorder: 'border-rose-300',
    badgeText: 'text-rose-900'
  },
  {
    id: 'will-do-it-tomorrow',
    name: 'Will Do It Tomorrow',
    tagline: 'Tomorrow has endless possibilities. Today is booked for rest.',
    emoji: '📅',
    badgeBg: 'bg-teal-50',
    badgeBorder: 'border-teal-300',
    badgeText: 'text-teal-900'
  },
  {
    id: 'chief-sloth-officer',
    name: 'Chief Sloth Officer',
    tagline: 'Executive leadership in doing the absolute minimum.',
    emoji: '🦥',
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-300',
    badgeText: 'text-emerald-900'
  },
  {
    id: 'energy-conservation-expert',
    name: 'Energy Conservation Expert',
    tagline: 'Preserving precious calories for the future.',
    emoji: '🔋',
    badgeBg: 'bg-yellow-50',
    badgeBorder: 'border-yellow-300',
    badgeText: 'text-yellow-900'
  },
  {
    id: 'remote-control-archaeologist',
    name: 'Remote Control Archaeologist',
    tagline: 'Will reach between cushions before walking to the TV.',
    emoji: '📺',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-300',
    badgeText: 'text-blue-900'
  },
  {
    id: 'master-of-minimum-effort',
    name: 'Master of Minimum Effort',
    tagline: 'Finding the mathematically shortest path to lying down.',
    emoji: '📐',
    badgeBg: 'bg-stone-100',
    badgeBorder: 'border-stone-300',
    badgeText: 'text-stone-900'
  },
  {
    id: 'serial-tab-accumulator',
    name: 'Serial Tab Accumulator',
    tagline: '47 browser tabs open: "I will read them later."',
    emoji: '📑',
    badgeBg: 'bg-cyan-50',
    badgeBorder: 'border-cyan-300',
    badgeText: 'text-cyan-900'
  }
];

export function getLazyReasonEmoji(reason?: string): string {
  if (!reason) return '🏷️';
  const found = LAZY_REASONS_CATALOG.find(
    r => r.name.toLowerCase() === reason.toLowerCase() || reason.toLowerCase().includes(r.name.toLowerCase())
  );
  return found ? found.emoji : '🏷️';
}

export interface ActivityEvent {
  id: string;
  type: 'rank' | 'top1' | 'displaced' | 'upgrade' | 'challenge';
  text: string;
  timestamp: string;
  amount?: number;
  profileId?: string;
}

export interface PurchaseRecord {
  id: string;
  profileId: string;
  amount: number;
  currency: string;
  paymentProvider: string;
  providerReference: string;
  paymentStatus: 'pending' | 'success' | 'failed';
  verifiedAt?: string;
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  targetType: 'profile' | 'nomination';
  targetId: string;
  reason: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

export interface LeaderboardResponse {
  profiles: UserProfile[];
  totalCount: number;
  page: number;
  pageSize: number;
  offset?: number;
  limit?: number;
  totalPages: number;
  hasMore: boolean;
  period: RankPeriod;
  topAmount: number;
  minAmountToBeatTop: number;
  filter?: 'verified' | 'all';
  timestamp: string;
}

export interface LiveStats {
  online: number;
  visitsToday: number;
  totalVerifiedParticipants: number;
  totalVerifiedRevenue: number;
  totalClaims: number;
  claimsToday?: number;
  topAmount: number;
  minAmountToBeatTop: number;
}

export interface HourlyActivityBucket {
  hour: number; // 0 to 23
  label: string; // e.g. "2 PM" or "14:00"
  claimsCount: number;
  amount: number;
  intensity: number; // 0 (empty), 1 (light), 2 (moderate), 3 (active), 4 (peak)
  isCurrentHour: boolean;
}

export interface DayActivityBucket {
  date: string; // "YYYY-MM-DD"
  dayName: string; // "Mon", "Tue", etc.
  claimsCount: number;
  amount: number;
  intensity: number; // 0 to 4
  isToday: boolean;
}

export interface GlobalActivityData {
  claimsToday: number;
  claimsTotal: number;
  totalAmountToday: number;
  hourlyActivity: HourlyActivityBucket[];
  recentDays: DayActivityBucket[];
  peakHour?: string;
  latestClaimMinutesAgo?: number;
  activeParticipantsNow: number;
  updatedAt: string;
}

export interface AnalyticsSummary {
  homepageViews: number;
  claimStarts: number;
  amountSelected: number;
  checkoutStarts: number;
  successfulPurchases: number;
  totalRevenueINR: number;
  shareClicks: number;
  leaderboardClicks: number;
  instagramClicks: number;
  websiteClicks: number;
  challengeClicks: number;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  orderId?: string;
  message: string;
  ip?: string;
  createdAt: string;
  status: 'new' | 'in-review' | 'resolved';
}

export interface NotificationSubscription {
  id: string;
  email: string;
  name?: string;
  notifyOnOutranked: boolean;
  notifyOnNomination: boolean;
  ip?: string;
  createdAt: string;
  updatedAt?: string;
  active: boolean;
}

export interface LazyDilemmaOption {
  id: string;
  label: string;
  votes: number;
  percentage: number;
  emoji?: string;
}

export interface LazyDilemma {
  id: string;
  title: string;
  description: string;
  weekLabel: string;
  category: string;
  totalVotes: number;
  options: LazyDilemmaOption[];
  userVotedOptionId?: string | null;
  endDate?: string;
}

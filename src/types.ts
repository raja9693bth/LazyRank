export type RankPeriod = 'today' | 'week' | 'month' | 'all';

export type UserTier = 'free' | 'verified';

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
}

export interface Nomination {
  id: string;
  nomineeName: string;
  nomineeUserId?: string;
  nominatorName?: string;
  reason: string;
  targetAmount?: number;
  status: 'active' | 'reported' | 'removed';
  createdAt: string;
  profileId?: string;
  rank?: number;
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
  topAmount: number;
  minAmountToBeatTop: number;
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

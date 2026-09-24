-- ============================================================================
-- LazyProof / LAZY — Commercial Production Database Schema (PostgreSQL)
-- Operating Entity: Adabhra Group (Sole Proprietorship)
-- Product: LazyProof / LAZY (https://lazyproof.online)
-- ============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(60) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
  rank INTEGER NOT NULL DEFAULT 999999,
  instagram VARCHAR(100),
  linkedin VARCHAR(255),
  website VARCHAR(255),
  reason VARCHAR(255),
  title VARCHAR(120),
  badge VARCHAR(60),
  lazy_reason VARCHAR(120),
  lazy_streak_days INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  owner_token VARCHAR(128) NOT NULL,
  moderation_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (moderation_status IN ('active', 'reported', 'hidden', 'banned', 'removed', 'resolved')),
  votes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_amount_updated ON profiles (amount DESC, updated_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_profiles_moderation_status ON profiles (moderation_status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);

-- 2. Payment Orders Table
CREATE TABLE IF NOT EXISTS payment_orders (
  order_id VARCHAR(64) PRIMARY KEY,
  profile_id VARCHAR(64) REFERENCES profiles(id) ON DELETE SET NULL,
  owner_token VARCHAR(128),
  name VARCHAR(60) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'REVERSED', 'CHARGEBACK')),
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'disabled' CHECK (payment_mode IN ('disabled', 'sandbox', 'live')),
  provider VARCHAR(30) NOT NULL DEFAULT 'cashfree',
  provider_order_id VARCHAR(100),
  payment_session_id VARCHAR(255),
  idempotency_key VARCHAR(128),
  cf_payment_id VARCHAR(100),
  customer_email VARCHAR(120),
  customer_phone VARCHAR(30),
  instagram VARCHAR(100),
  linkedin VARCHAR(255),
  website VARCHAR(255),
  reason VARCHAR(255),
  lazy_reason VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_order_id ON payment_orders (provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_idempotency ON payment_orders (idempotency_key);

-- 3. Payment Transactions Table (Unique Gateway Settlements)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES payment_orders(order_id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL DEFAULT 'cashfree',
  provider_payment_id VARCHAR(100) NOT NULL UNIQUE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'USER_DROPPED', 'REFUNDED', 'REVERSED', 'CHARGEBACK')),
  payment_method VARCHAR(50),
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_provider_payment_id ON payment_transactions (provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_order_id ON payment_transactions (order_id);

-- 4. Rank Ledger Table (Double-Entry Balance & Reversal Ledger)
CREATE TABLE IF NOT EXISTS rank_ledger (
  id VARCHAR(64) PRIMARY KEY,
  profile_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id VARCHAR(64) NOT NULL REFERENCES payment_orders(order_id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT_REFUND', 'DEBIT_CHARGEBACK')),
  amount NUMERIC(14, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('SETTLED', 'REVERSED')),
  note VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rank_ledger_profile_id ON rank_ledger (profile_id);
CREATE INDEX IF NOT EXISTS idx_rank_ledger_order_id ON rank_ledger (order_id);

-- 5. Claim History Table (Audit Trail of User Rank Events)
CREATE TABLE IF NOT EXISTS claim_history (
  id VARCHAR(64) PRIMARY KEY,
  profile_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id VARCHAR(64) REFERENCES payment_orders(order_id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL,
  total_amount NUMERIC(14, 2) NOT NULL,
  rank INTEGER NOT NULL,
  note VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_history_profile_id ON claim_history (profile_id);

-- 6. Refund Reversals Table
CREATE TABLE IF NOT EXISTS refund_reversals (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES payment_orders(order_id) ON DELETE CASCADE,
  provider_refund_id VARCHAR(100),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  reason VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_reversals_order_id ON refund_reversals (order_id);

-- 7. Moderation Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  target_id VARCHAR(64) NOT NULL,
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('profile', 'comment', 'nomination')),
  reason VARCHAR(100) NOT NULL,
  details TEXT,
  client_ip VARCHAR(64),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

-- 8. Nominations & Challenges Table
CREATE TABLE IF NOT EXISTS nominations (
  id VARCHAR(64) PRIMARY KEY,
  nominator_name VARCHAR(60) NOT NULL,
  nominee_name VARCHAR(60) NOT NULL,
  target_amount NUMERIC(14, 2),
  reason VARCHAR(255),
  lazy_reason VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(120) NOT NULL,
  profile_id VARCHAR(64) REFERENCES profiles(id) ON DELETE CASCADE,
  notify_displaced BOOLEAN NOT NULL DEFAULT TRUE,
  notify_daily_summary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_email ON notification_preferences (email);

-- 10. Contact Inquiries Table
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  email VARCHAR(120) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  order_id VARCHAR(64),
  message TEXT NOT NULL,
  client_ip VARCHAR(64),
  status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Lazy Dilemma Votes Table
CREATE TABLE IF NOT EXISTS dilemma_votes (
  id VARCHAR(64) PRIMARY KEY,
  option_id VARCHAR(30) NOT NULL,
  voter_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_voter_dilemma UNIQUE (voter_id)
);

-- ============================================================================
-- Migration 002: Remediation & Durability Hardening
-- Transaction-safe, idempotent migration for LazyProof production database.
-- ============================================================================

-- 0. Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT
);

-- 1. Preflight duplicate check: Abort safely if duplicate provider_refund_id or duplicate CREDIT exists
DO $$
BEGIN
  -- Check duplicate provider_refund_id in refund_reversals
  IF EXISTS (
    SELECT provider_refund_id FROM refund_reversals
    WHERE provider_refund_id IS NOT NULL
    GROUP BY provider_refund_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: Duplicate provider_refund_id found in refund_reversals.';
  END IF;

  -- Check duplicate CREDIT per order_id in rank_ledger
  IF EXISTS (
    SELECT order_id FROM rank_ledger
    WHERE type = 'CREDIT'
    GROUP BY order_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: Multiple CREDIT entries found for single order_id in rank_ledger.';
  END IF;
END $$;

-- 2. Alter refund_reversals: add updated_at, merchant_refund_id, and unique indexes
ALTER TABLE refund_reversals
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE refund_reversals
  ADD COLUMN IF NOT EXISTS merchant_refund_id VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS refund_reversals_provider_refund_id_unique
  ON refund_reversals(provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS refund_reversals_merchant_refund_id_unique
  ON refund_reversals(merchant_refund_id)
  WHERE merchant_refund_id IS NOT NULL;

-- 3. Alter payment_orders: status check including PARTIALLY_REFUNDED, order_access_token_hash, quote_snapshot
ALTER TABLE payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_status_check;

ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_status_check CHECK (status IN (
    'CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUND_PENDING',
    'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED', 'CHARGEBACK'
  ));

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS order_access_token_hash VARCHAR(128);

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS quote_snapshot JSONB;

-- 4. Alter profiles: add first_verified_at, stable rank tie-breaking index
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_verified_at TIMESTAMPTZ;

-- Backfill first_verified_at for paid profiles from earliest successful settlement
UPDATE profiles p
SET first_verified_at = COALESCE(
  (
    SELECT MIN(pt.created_at)
    FROM payment_transactions pt
    JOIN payment_orders po ON pt.order_id = po.order_id
    WHERE po.profile_id = p.id AND pt.status = 'SUCCESS'
  ),
  (
    SELECT MIN(ch.created_at)
    FROM claim_history ch
    WHERE ch.profile_id = p.id
  ),
  p.created_at
)
WHERE p.is_verified = true AND p.first_verified_at IS NULL;

CREATE INDEX IF NOT EXISTS profiles_rank_stable_idx
  ON profiles(amount DESC, first_verified_at ASC, id ASC)
  WHERE moderation_status = 'active' AND is_verified = true;

-- 5. Rank Ledger: Unique Credit index
CREATE UNIQUE INDEX IF NOT EXISTS rank_ledger_one_credit_per_order
  ON rank_ledger(order_id) WHERE type = 'CREDIT';

-- 6. Payment Webhook Events Table (Idempotent Webhook Deduplication)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(128) NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  order_id VARCHAR(64),
  provider_payment_id VARCHAR(100),
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order_id ON payment_webhook_events(order_id);

-- 7. API Rate Limits Table (Bounded Shared Rate Limiter for Multi-replica Deployments)
CREATE TABLE IF NOT EXISTS api_rate_limits (
  key VARCHAR(128) PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 1,
  expire_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expire ON api_rate_limits(expire_at);

-- 8. Daily IST Snapshot Table (Immutable daily winners)
CREATE TABLE IF NOT EXISTS daily_snapshots (
  date_ist DATE NOT NULL,
  rank INTEGER NOT NULL,
  profile_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (date_ist, rank)
);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_profile ON daily_snapshots(profile_id);

-- 9. Composite indexes on orders, contact_inquiries, and reports
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_created ON payment_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status_created ON contact_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);

-- Record migration in schema_migrations
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('002_remediation', NOW(), 'Remediation migration: order_access_token_hash, first_verified_at, partial refunds, webhook deduplication, and rate limits')
ON CONFLICT (version) DO NOTHING;

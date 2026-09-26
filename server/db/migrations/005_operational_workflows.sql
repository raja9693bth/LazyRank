-- ============================================================================
-- Migration 005: Operational Workflows, Durable Votes, and Optional X Links
-- Product: LazyProof / LAZY (https://lazyproof.online)
-- Operating Entity: ADABHRA GROUP (Proprietor: Raja Babu)
-- ============================================================================

-- 1. Operational Outbox Table for Durable Event Dispatch (Founder Alerts)
CREATE TABLE IF NOT EXISTS operational_outbox (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  order_id VARCHAR(64) NOT NULL REFERENCES payment_orders(order_id) ON DELETE CASCADE,
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'EXHAUSTED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_event_order ON operational_outbox (event_type, order_id);
CREATE INDEX IF NOT EXISTS idx_outbox_pending_dispatch ON operational_outbox (delivery_status, next_attempt_at) WHERE delivery_status IN ('PENDING', 'PROCESSING', 'FAILED');

-- 2. Durable Profile Votes Table for Rate-Limited, Idempotent Social Voting
CREATE TABLE IF NOT EXISTS profile_votes (
  id VARCHAR(64) PRIMARY KEY,
  profile_id VARCHAR(64) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  voter_fingerprint VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_profile_voter UNIQUE (profile_id, voter_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_profile_votes_profile_id ON profile_votes (profile_id);

-- 3. Additive Nullable X Handle / Link Fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);

-- 4. Record migration in schema_migrations
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('005_operational_workflows', 'Operational outbox, durable profile votes, and optional X link fields', NOW())
ON CONFLICT (version) DO NOTHING;

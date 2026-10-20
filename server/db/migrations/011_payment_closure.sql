-- ============================================================================
-- Migration 011: Product Namespace Integrity, Durable Quotes, and Event Capacity
-- ============================================================================

-- 1. Correct product namespace unique constraints
-- Safely drop old cross-environment unique constraint if present
ALTER TABLE payment_products DROP CONSTRAINT IF EXISTS uq_payment_products_provider_amt;

-- Deduplicate any existing ambiguous rows before adding the scoped constraint
DELETE FROM payment_products a USING payment_products b
WHERE a.ctid < b.ctid
  AND a.provider = b.provider
  AND a.environment = b.environment
  AND a.account_id = b.account_id
  AND a.currency = b.currency
  AND a.amount_minor = b.amount_minor
  AND a.pricing_version = b.pricing_version;

-- Add authoritative scoped unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_payment_products_scoped'
  ) THEN
    ALTER TABLE payment_products
      ADD CONSTRAINT uq_payment_products_scoped
      UNIQUE (provider, environment, account_id, currency, amount_minor, pricing_version);
  END IF;
END $$;

-- 2. Widen payment_webhook_events event_id column to prevent prefix overflow
ALTER TABLE payment_webhook_events ALTER COLUMN event_id TYPE VARCHAR(256);
ALTER TABLE payment_webhook_events ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED';

-- 3. Create durable payment_quotes table for atomic server-authoritative quote snapshots
CREATE TABLE IF NOT EXISTS payment_quotes (
  id VARCHAR(64) PRIMARY KEY,
  quote_id VARCHAR(64) UNIQUE NOT NULL,
  provider VARCHAR(32) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  amount_minor BIGINT NOT NULL,
  rank_credit_paise BIGINT NOT NULL,
  tax_mode VARCHAR(32) NOT NULL DEFAULT 'tax_inclusive',
  pricing_version VARCHAR(32) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  profile_id VARCHAR(64),
  claimant_name VARCHAR(128),
  auth_hash VARCHAR(128) NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_order_id VARCHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  quote_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_quotes_lookup ON payment_quotes (quote_id, expires_at);

-- 4. Record migration in schema_migrations
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('011_payment_closure', NOW(), 'Product namespace unique constraints, durable quote snapshots, and webhook event capacity')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Migration 009: Durable Payment Product Mapping
-- Maps provider fixed-price products (e.g. Dodo INR amounts) across restarts
-- and concurrent instances to prevent duplicate product creation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_products (
  id VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL DEFAULT 'dodo',
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  amount_paise BIGINT NOT NULL,
  product_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payment_products_provider_amt UNIQUE (provider, currency, amount_paise)
);

CREATE INDEX IF NOT EXISTS idx_payment_products_lookup
  ON payment_products (provider, currency, amount_paise);

-- Record migration in schema_migrations
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('009_dodo_products', NOW(), 'Durable payment product mapping for multi-instance coordination')
ON CONFLICT (version) DO NOTHING;

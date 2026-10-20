-- ============================================================================
-- Migration 010: Multi-currency, namespaced products, and provider hardening
-- ============================================================================

-- 1. Extend payment_products for multi-currency, environment, account, and pricing version
ALTER TABLE payment_products ADD COLUMN IF NOT EXISTS environment VARCHAR(32) NOT NULL DEFAULT 'live_mode';
ALTER TABLE payment_products ADD COLUMN IF NOT EXISTS account_id VARCHAR(64) NOT NULL DEFAULT 'primary';
ALTER TABLE payment_products ADD COLUMN IF NOT EXISTS pricing_version VARCHAR(32) NOT NULL DEFAULT 'v1';
ALTER TABLE payment_products ADD COLUMN IF NOT EXISTS amount_minor BIGINT;

-- Backfill amount_minor from amount_paise if amount_minor is NULL
UPDATE payment_products SET amount_minor = amount_paise WHERE amount_minor IS NULL;

-- Ensure default and create namespaced index
CREATE INDEX IF NOT EXISTS idx_payment_products_namespaced
  ON payment_products (provider, environment, account_id, currency, amount_minor, pricing_version);

-- 2. Extend payment_orders with charge currency, minor units, and canonical rank credit
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS charge_currency VARCHAR(10) NOT NULL DEFAULT 'INR';
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS charge_amount_minor BIGINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS canonical_rank_credit_paise BIGINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fx_quote_id VARCHAR(64);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fx_rate_numerator BIGINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fx_rate_denominator BIGINT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS provider_account_id VARCHAR(64);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS provider_environment VARCHAR(32);

-- Backfill historical orders: charge_amount_minor and canonical_rank_credit_paise from amount
UPDATE payment_orders
SET charge_amount_minor = ROUND(amount * 100),
    canonical_rank_credit_paise = ROUND(amount * 100)
WHERE charge_amount_minor IS NULL;

-- 3. Extend refund_reversals for charge currency and rank credit reversal
ALTER TABLE refund_reversals ADD COLUMN IF NOT EXISTS charge_currency VARCHAR(10) NOT NULL DEFAULT 'INR';
ALTER TABLE refund_reversals ADD COLUMN IF NOT EXISTS charge_refund_amount_minor BIGINT;
ALTER TABLE refund_reversals ADD COLUMN IF NOT EXISTS reversed_rank_credit_paise BIGINT;

-- Record migration in schema_migrations
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('010_payment_hardening', NOW(), 'Multi-currency, namespaced product mapping, and sticky provider hardening')
ON CONFLICT (version) DO NOTHING;

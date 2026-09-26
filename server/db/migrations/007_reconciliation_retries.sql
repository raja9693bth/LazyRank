-- ============================================================================
-- Migration 007: Fair Bounded Reconciliation Retries & Stalled Alerting
-- Additive migration for fair, starvation-free payment and refund reconciliation.
-- ============================================================================

-- 1. Add reconciliation retry tracking columns to payment_orders
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS reconciliation_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_reconcile_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reconciliation_error TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_orders_reconcile
  ON payment_orders (status, next_reconcile_at, created_at)
  WHERE status IN ('PENDING', 'CREATED');

-- 2. Add reconciliation retry tracking columns to refund_reversals
ALTER TABLE refund_reversals
  ADD COLUMN IF NOT EXISTS reconciliation_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_reconcile_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reconciliation_error TEXT;

CREATE INDEX IF NOT EXISTS idx_refund_reversals_reconcile
  ON refund_reversals (status, next_reconcile_at, created_at)
  WHERE status = 'PENDING';

-- 3. Record migration in schema_migrations
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('007_reconciliation_retries', NOW(), 'Fair bounded reconciliation retries and next-attempt scheduling without 24h starvation')
ON CONFLICT (version) DO NOTHING;
